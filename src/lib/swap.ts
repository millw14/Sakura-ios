import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { SAKURA_MINT, getConnection, SOLANA_NETWORK } from "./solana";
import { CapacitorHttp } from "@capacitor/core";

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";
const WSOL_MINT = "So11111111111111111111111111111111111111112";

export interface SwapQuote {
    inAmount: string;
    outAmount: string;
    priceImpactPct: string;
    routePlan: any[];
    // Raw quote response to pass to swap API
    _raw: any;
}

export interface SwapResult {
    success: boolean;
    txid?: string;
    error?: string;
}

/**
 * Gets a quote from Jupiter to swap SOL -> $SAKURA
 * @param amountSol The amount of SOL to swap
 * @returns Quote data or null if failed
 */
export async function getSakuraSwapQuote(amountSol: number): Promise<SwapQuote | null> {
    if ((SOLANA_NETWORK as string) !== "mainnet-beta") {
        console.warn("Jupiter Swap is only available on mainnet-beta.");
        // We throw here so the UI can gracefully disable the feature
        throw new Error("Jupiter Swap requires Mainnet.");
    }

    try {
        const lamports = Math.round(amountSol * 1e9);
        const url = `${JUPITER_QUOTE_API}?inputMint=${WSOL_MINT}&outputMint=${SAKURA_MINT.toBase58()}&amount=${lamports}&slippageBps=50`;

        const response = await CapacitorHttp.get({ url });

        if (response.status !== 200) {
            let errorText = "Failed to fetch quote from Jupiter.";
            try {
                errorText = response.data.error || errorText;
            } catch {
                errorText = `Jupiter API returned HTTP ${response.status}`;
            }
            throw new Error(errorText);
        }

        // CapacitorHttp directly parses JSON into .data
        const data = response.data;
        return {
            inAmount: data.inAmount,
            outAmount: data.outAmount,
            priceImpactPct: data.priceImpactPct,
            routePlan: data.routePlan,
            _raw: data // Keep raw data for the execution POST request
        };
    } catch (e: any) {
        console.error("Jupiter Quote Error:", e);
        if (e.message && e.message.includes("Failed to fetch")) {
            throw new Error("Network error: Could not reach Jupiter API. If on Android emulator, check connections or VPN.");
        }
        throw e;
    }
}

/**
 * Executes the swap using the selected quote.
 */
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

        // 1. Get serialized transaction from Jupiter API
        const swapResponse = await CapacitorHttp.post({
            url: JUPITER_SWAP_API,
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                quoteResponse: quote._raw,
                userPublicKey: walletPublicKey.toBase58(),
                wrapAndUnwrapSol: true,
            }
        });

        if (swapResponse.status !== 200) {
            let errorText = "Failed to get swap transaction";
            try {
                errorText = swapResponse.data.error || errorText;
            } catch {
                errorText = `Jupiter Swap API returned HTTP ${swapResponse.status}`;
            }
            throw new Error(errorText);
        }

        const { swapTransaction } = swapResponse.data;

        // 2. Deserialize the Base64 transaction into a VersionedTransaction
        const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

        // 3. Sign the transaction
        const signedTransaction = await signTransaction(transaction);

        // 4. Send and confirm
        const latestBlockHash = await connection.getLatestBlockhash();

        // Execute the transaction
        const rawTransaction = signedTransaction.serialize()
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
