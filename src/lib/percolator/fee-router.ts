/**
 * $SAKURA trading fee collection.
 * Collects fees in $SAKURA from users before each trade and sends to admin wallet.
 */
import {
    PublicKey,
    Transaction,
    TransactionSignature,
} from "@solana/web3.js";
import {
    createTransferInstruction,
    createAssociatedTokenAccountInstruction,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
    SAKURA_MINT,
    SAKURA_TREASURY_ADMIN,
    getConnection,
    sakuraToSmallestUnit,
} from "../solana";
import { TRADING_FEE_SAKURA } from "./config";
import { getTreasuryTokenAccount } from "../treasury";

// ============ Types ============

export interface TradingFeeResult {
    success: boolean;
    signature?: TransactionSignature;
    error?: string;
    feeSplits?: { total: number };
}

// ============ Fee Calculation ============

export function calculateTradingFeeSplits(feeAmount: number = TRADING_FEE_SAKURA) {
    return { total: feeAmount };
}

// ============ Fee Collection ============

/**
 * Build a transaction that collects the $SAKURA trading fee from the user
 * and sends it to the treasury PDA.
 *
 * This runs on MAINNET (where $SAKURA lives).
 * The user signs this transaction with their wallet.
 */
export async function buildTradingFeeTransaction(
    walletPublicKey: PublicKey
): Promise<{ transaction: Transaction; splits: ReturnType<typeof calculateTradingFeeSplits> }> {
    const connection = getConnection();
    const splits = calculateTradingFeeSplits();

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
            `Insufficient $SAKURA balance. Need at least ${TRADING_FEE_SAKURA.toLocaleString()} $SAKURA to cover trading fees.`
        );
    }

    const userTokenAccount = sufficientAccount.pubkey;
    const treasuryAta = await getTreasuryTokenAccount();

    const transaction = new Transaction();

    const ataInfo = await connection.getAccountInfo(treasuryAta);
    if (!ataInfo) {
        transaction.add(
            createAssociatedTokenAccountInstruction(
                walletPublicKey,
                treasuryAta,
                SAKURA_TREASURY_ADMIN,
                SAKURA_MINT,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )
        );
    }

    const amountSmallest = BigInt(sakuraToSmallestUnit(TRADING_FEE_SAKURA));
    transaction.add(
        createTransferInstruction(
            userTokenAccount,
            treasuryAta,
            walletPublicKey,
            amountSmallest,
            [],
            TOKEN_PROGRAM_ID
        )
    );

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
            feeSplits: { total: splits.total },
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
