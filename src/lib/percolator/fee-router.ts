/**
 * $SAKURA trading fee collection and splitting.
 * Collects fees in $SAKURA from users before each trade,
 * then splits them between creators, ops, provenance pool, and community/LPs.
 */
import {
    Connection,
    PublicKey,
    Transaction,
    TransactionSignature,
} from "@solana/web3.js";
import {
    getAssociatedTokenAddress,
    createTransferInstruction,
    createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import {
    SAKURA_MINT,
    SAKURA_DECIMALS,
    getConnection,
    sakuraToSmallestUnit,
} from "../solana";
import {
    TRADING_FEE_SAKURA,
    FEE_SPLITS,
    FEE_RECIPIENTS,
} from "./config";

// ============ Types ============

export interface TradingFeeResult {
    success: boolean;
    signature?: TransactionSignature;
    error?: string;
    feeSplits?: {
        creators: number;
        ops: number;
        provenance: number;
        community: number;
    };
}

// ============ Fee Calculation ============

export function calculateTradingFeeSplits(feeAmount: number = TRADING_FEE_SAKURA) {
    return {
        creators: (feeAmount * FEE_SPLITS.creators) / 100,
        ops: (feeAmount * FEE_SPLITS.ops) / 100,
        provenance: (feeAmount * FEE_SPLITS.provenance) / 100,
        community: (feeAmount * FEE_SPLITS.community) / 100,
        total: feeAmount,
    };
}

// ============ Fee Collection ============

/**
 * Build a transaction that collects the $SAKURA trading fee from the user
 * and splits it to the 4 fee recipients.
 *
 * This runs on MAINNET (where $SAKURA lives).
 * The user signs this transaction with their wallet.
 */
export async function buildTradingFeeTransaction(
    walletPublicKey: PublicKey
): Promise<{ transaction: Transaction; splits: ReturnType<typeof calculateTradingFeeSplits> }> {
    const connection = getConnection(); // Mainnet connection
    const splits = calculateTradingFeeSplits();

    // Find user's $SAKURA token account
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        { mint: SAKURA_MINT }
    );

    if (tokenAccounts.value.length === 0) {
        throw new Error(
            "No $SAKURA token account found. Swap some SOL for $SAKURA first."
        );
    }

    const sufficientAccount = tokenAccounts.value.find(
        (acc) =>
            Number(acc.account.data.parsed.info.tokenAmount.uiAmount) >=
            TRADING_FEE_SAKURA
    );

    if (!sufficientAccount) {
        throw new Error(
            `Insufficient $SAKURA balance. Need at least ${TRADING_FEE_SAKURA} $SAKURA to cover trading fees.`
        );
    }

    const userTokenAccount = sufficientAccount.pubkey;
    const transaction = new Transaction();

    // Build transfer instructions for each fee recipient
    const recipients = [
        { wallet: FEE_RECIPIENTS.creators, amount: splits.creators, label: "creators" },
        { wallet: FEE_RECIPIENTS.ops, amount: splits.ops, label: "ops" },
        { wallet: FEE_RECIPIENTS.provenance, amount: splits.provenance, label: "provenance" },
        { wallet: FEE_RECIPIENTS.community, amount: splits.community, label: "community" },
    ];

    for (const recipient of recipients) {
        if (recipient.amount <= 0) continue;

        const recipientAta = await getAssociatedTokenAddress(
            SAKURA_MINT,
            recipient.wallet
        );

        // Ensure recipient ATA exists
        const ataInfo = await connection.getAccountInfo(recipientAta);
        if (!ataInfo) {
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    walletPublicKey,
                    recipientAta,
                    recipient.wallet,
                    SAKURA_MINT
                )
            );
        }

        const amountSmallest = BigInt(sakuraToSmallestUnit(recipient.amount));
        transaction.add(
            createTransferInstruction(
                userTokenAccount,
                recipientAta,
                walletPublicKey,
                amountSmallest
            )
        );
    }

    // Set recent blockhash
    const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = walletPublicKey;

    return { transaction, splits };
}

/**
 * Pay the trading fee (user signs and sends the tx).
 */
export async function payTradingFee(
    walletPublicKey: PublicKey,
    signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<TradingFeeResult> {
    try {
        const { transaction, splits } =
            await buildTradingFeeTransaction(walletPublicKey);

        const signed = await signTransaction(transaction);
        const connection = getConnection();
        const signature = await connection.sendRawTransaction(signed.serialize());

        await connection.confirmTransaction(
            {
                signature,
                blockhash: transaction.recentBlockhash!,
                lastValidBlockHeight: transaction.lastValidBlockHeight!,
            },
            "confirmed"
        );

        return {
            success: true,
            signature,
            feeSplits: splits,
        };
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : "Fee payment failed";
        console.error("Trading fee payment error:", error);
        return { success: false, error: message };
    }
}

/**
 * Verify that a $SAKURA fee was paid by checking the transaction signature.
 */
export async function verifyFeePaid(
    signature: string
): Promise<boolean> {
    try {
        const connection = getConnection();
        const tx = await connection.getTransaction(signature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
        });

        if (!tx || tx.meta?.err) return false;

        // Verify the transaction includes transfers to our fee recipients
        // For now, we trust that the signature is valid if the tx succeeded
        return true;
    } catch {
        return false;
    }
}
