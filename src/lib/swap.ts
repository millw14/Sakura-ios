import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { SAKURA_MINT, getConnection, SOLANA_NETWORK, JUPITER_API_KEY } from "./solana";

const JUPITER_BASE = "https://api.jup.ag/swap/v1";
const WSOL_MINT = "So11111111111111111111111111111111111111112";

export interface SwapQuote {
    inAmount: string;
    outAmount: string;
    priceImpactPct: string;
    routePlan: any[];
    _raw: any;
}

export interface SwapResult {
    success: boolean;
    txid?: string;
    error?: string;
}

function jupiterHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (JUPITER_API_KEY) h["x-api-key"] = JUPITER_API_KEY;
    return h;
}

export async function getSakuraSwapQuote(amountSol: number): Promise<SwapQuote | null> {
    if ((SOLANA_NETWORK as string) !== "mainnet-beta") {
        throw new Error("Jupiter Swap requires Mainnet.");
    }

    if (!JUPITER_API_KEY) {
        throw new Error("Jupiter API key not configured. Get a free key at portal.jup.ag and add it in Settings.");
    }

    try {
        const lamports = Math.round(amountSol * 1e9);
        const url = `${JUPITER_BASE}/quote?inputMint=${WSOL_MINT}&outputMint=${SAKURA_MINT.toBase58()}&amount=${lamports}&slippageBps=50&restrictIntermediateTokens=true`;

        const response = await fetch(url, { headers: jupiterHeaders() });

        if (!response.ok) {
            let errorText = "Failed to fetch quote from Jupiter.";
            try {
                const errBody = await response.json();
                errorText = errBody.message || errBody.error || errorText;
            } catch {
                errorText = `Jupiter API returned HTTP ${response.status}`;
            }
            throw new Error(errorText);
        }

        const data = await response.json();
        return {
            inAmount: data.inAmount,
            outAmount: data.outAmount,
            priceImpactPct: data.priceImpactPct || "0",
            routePlan: data.routePlan || [],
            _raw: data
        };
    } catch (e: any) {
        console.error("Jupiter Quote Error:", e);
        throw e;
    }
}

export async function executeSakuraSwap(
    quote: SwapQuote,
    walletPublicKey: PublicKey,
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<SwapResult> {
    if ((SOLANA_NETWORK as string) !== "mainnet-beta") {
        return { success: false, error: "Jupiter Swap requires Mainnet." };
    }

    try {
        const connection = getConnection();

        const swapResponse = await fetch(`${JUPITER_BASE}/swap`, {
            method: "POST",
            headers: jupiterHeaders(),
            body: JSON.stringify({
                quoteResponse: quote._raw,
                userPublicKey: walletPublicKey.toBase58(),
                wrapAndUnwrapSol: true,
                dynamicComputeUnitLimit: true,
                dynamicSlippage: true,
                prioritizationFeeLamports: {
                    priorityLevelWithMaxLamports: {
                        maxLamports: 1000000,
                        priorityLevel: "veryHigh"
                    }
                }
            })
        });

        if (!swapResponse.ok) {
            let errorText = "Failed to get swap transaction";
            try {
                const errBody = await swapResponse.json();
                errorText = errBody.message || errBody.error || errorText;
            } catch {
                errorText = `Jupiter Swap API returned HTTP ${swapResponse.status}`;
            }
            throw new Error(errorText);
        }

        const swapData = await swapResponse.json();
        const { swapTransaction } = swapData;

        const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

        const signedTransaction = await signTransaction(transaction);

        const latestBlockHash = await connection.getLatestBlockhash();

        const rawTransaction = signedTransaction.serialize();
        const txid = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: true,
            maxRetries: 2
        });

        await connection.confirmTransaction({
            blockhash: latestBlockHash.blockhash,
            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            signature: txid
        }, 'confirmed');

        return { success: true, txid };

    } catch (error: any) {
        console.error("Jupiter Swap Error:", error);
        return { success: false, error: error.message || "Unknown error occurred during swap" };
    }
}
