import {
    createTransferCheckedInstruction,
    getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
    Connection,
    PublicKey,
    Transaction,
    TransactionSignature,
} from "@solana/web3.js";
import {
    USDC_MINT,
    USDC_DECIMALS,
    TREASURY_WALLET,
    WEEKLY_PASS_PRICE,
    getConnection,
    usdcToSmallestUnit,
} from "./solana";

export interface PaymentResult {
    success: boolean;
    signature?: TransactionSignature;
    error?: string;
}

/**
 * Create and send a USDC payment transaction for a weekly pass.
 * The user pays WEEKLY_PASS_PRICE USDC to the treasury wallet.
 */
export async function payForWeeklyPass(
    walletPublicKey: PublicKey,
    signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<PaymentResult> {
    try {
        const connection = getConnection();
        const amount = usdcToSmallestUnit(WEEKLY_PASS_PRICE);

        // Get the user's USDC token account
        const userTokenAccount = await getAssociatedTokenAddress(
            USDC_MINT,
            walletPublicKey
        );

        // Get the treasury's USDC token account
        const treasuryTokenAccount = await getAssociatedTokenAddress(
            USDC_MINT,
            TREASURY_WALLET
        );

        // Create transfer instruction
        const transferInstruction = createTransferCheckedInstruction(
            userTokenAccount,
            USDC_MINT,
            treasuryTokenAccount,
            walletPublicKey,
            amount,
            USDC_DECIMALS
        );

        // Build transaction
        const transaction = new Transaction().add(transferInstruction);
        const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = walletPublicKey;

        // Sign with user's wallet
        const signed = await signTransaction(transaction);

        // Send and confirm
        const signature = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            "confirmed"
        );

        return { success: true, signature };
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : "Payment failed";
        console.error("USDC payment error:", error);
        return { success: false, error: message };
    }
}
