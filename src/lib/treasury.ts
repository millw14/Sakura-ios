/**
 * Sakura Treasury client.
 * Donations go to admin wallet. Creator tips go directly to the creator's wallet.
 * No on-chain program deployment needed.
 */
import { PublicKey, Transaction } from "@solana/web3.js";
import {
    getAssociatedTokenAddress,
    createTransferInstruction,
    createAssociatedTokenAccountInstruction,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
    SAKURA_MINT,
    SAKURA_TREASURY_ADMIN,
    getConnection,
    sakuraToSmallestUnit,
} from "./solana";

const MIN_SAKURA = 100_000;

/**
 * Get the treasury SAKURA token account (admin wallet's ATA).
 */
export async function getTreasuryTokenAccount(): Promise<PublicKey> {
    return getAssociatedTokenAddress(
        SAKURA_MINT,
        SAKURA_TREASURY_ADMIN,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
}

/**
 * Build a transaction to send SAKURA to a specific recipient.
 * If receiverAddress is provided, sends directly to creator.
 * Otherwise sends to the treasury (admin wallet).
 * Enforces minimum 100,000 SAKURA.
 */
export async function buildDepositTx(
    userWallet: PublicKey,
    amountSakura: number,
    receiverAddress?: string
): Promise<Transaction> {
    if (amountSakura < MIN_SAKURA) {
        throw new Error(
            `Minimum amount is ${MIN_SAKURA.toLocaleString()} SAKURA`
        );
    }

    const connection = getConnection();

    const receiver = receiverAddress
        ? new PublicKey(receiverAddress)
        : SAKURA_TREASURY_ADMIN;

    const receiverAta = await getAssociatedTokenAddress(
        SAKURA_MINT,
        receiver,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const userAta = await getAssociatedTokenAddress(
        SAKURA_MINT,
        userWallet,
        true,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction();

    const userAtaInfo = await connection.getAccountInfo(userAta);
    if (!userAtaInfo) {
        transaction.add(
            createAssociatedTokenAccountInstruction(
                userWallet,
                userAta,
                userWallet,
                SAKURA_MINT,
                TOKEN_2022_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )
        );
    }

    const ataInfo = await connection.getAccountInfo(receiverAta);
    if (!ataInfo) {
        transaction.add(
            createAssociatedTokenAccountInstruction(
                userWallet,
                receiverAta,
                receiver,
                SAKURA_MINT,
                TOKEN_2022_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )
        );
    }

    const amountSmallest = BigInt(sakuraToSmallestUnit(amountSakura));
    transaction.add(
        createTransferInstruction(
            userAta,
            receiverAta,
            userWallet,
            amountSmallest,
            [],
            TOKEN_2022_PROGRAM_ID
        )
    );

    const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = userWallet;

    return transaction;
}

/**
 * Get treasury SAKURA balance (human-readable).
 * Returns 0 if account does not exist.
 */
export async function getTreasuryBalance(): Promise<number> {
    try {
        const connection = getConnection();
        const treasuryAta = await getTreasuryTokenAccount();
        const info = await connection.getTokenAccountBalance(treasuryAta);
        if (!info.value) return 0;
        return Number(info.value.uiAmount ?? 0);
    } catch {
        return 0;
    }
}

/**
 * Get SAKURA balance for any wallet (human-readable).
 */
export async function getWalletSakuraBalance(walletAddress: string): Promise<number> {
    try {
        const connection = getConnection();
        const wallet = new PublicKey(walletAddress);
        const ata = await getAssociatedTokenAddress(
            SAKURA_MINT,
            wallet,
            false,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const info = await connection.getTokenAccountBalance(ata);
        if (!info.value) return 0;
        return Number(info.value.uiAmount ?? 0);
    } catch {
        return 0;
    }
}
