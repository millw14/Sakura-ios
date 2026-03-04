import { PublicKey } from "@solana/web3.js";
import { getConnection, FEE_ROUTER_PROGRAM_ID, PASS_DURATION_DAYS, SAKURA_MINT, SAKURA_DECIMALS } from "./solana";

export interface PassStatus {
    valid: boolean;
    expiresAt?: Date;
    assetId?: string; // Kept for interface compatibility but generally unused in Option B
}

/**
 * Check if a wallet holds a valid Sakura Subscription PDA OR >= 1M $SAKURA tokens.
 * Replaces the old NFT/DAS API check with a direct PDA account deserialization.
 */
export async function checkPassStatus(
    walletAddress: string
): Promise<PassStatus> {
    try {
        const connection = getConnection();
        const userPubkey = new PublicKey(walletAddress);

        // --- PUBLIC BETA EARLY ACCESS BYPASS ---
        // Check if the user holds >= 1,000,000 SAKURA tokens
        try {
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(userPubkey, {
                mint: SAKURA_MINT
            });

            if (tokenAccounts.value.length > 0) {
                // Sum up balances in case they have multiple token accounts for some reason
                let totalBalance = 0;
                for (const account of tokenAccounts.value) {
                    const amountStr = account.account.data.parsed.info.tokenAmount.amount;
                    totalBalance += Number(amountStr) / (10 ** SAKURA_DECIMALS);
                }

                if (totalBalance >= 1_000_000) {
                    return {
                        valid: true,
                        // Provide a massive future expiry since they are holding tokens indefinitely
                        expiresAt: new Date("2099-12-31"),
                        assetId: "beta-whale-bypass",
                    };
                }
            }
        } catch (tokenErr) {
            console.warn("Failed to check token balance for beta bypass:", tokenErr);
            // Fall back quietly to checking the PDA
        }
        // --- END BETA BYPASS ---

        // --- LOCAL RECEIPT BYPASS (Fallback) ---
        // Since FEE_ROUTER_PROGRAM_ID is not on Mainnet, we write secure local receipts on success.
        try {
            // Import dynamically since this file might be used in server contexts (though unlikely here)
            const storage = await import("./storage");
            const receipts = storage.getLocal<Record<string, number>>(storage.STORAGE_KEYS.PASS_RECEIPTS, {});
            const expiryTimeMs = receipts[walletAddress];

            if (expiryTimeMs && expiryTimeMs > Date.now()) {
                return {
                    valid: true,
                    expiresAt: new Date(expiryTimeMs),
                    assetId: "local-receipt-fallback"
                };
            }
        } catch (e) {
            console.warn("Failed to check local pass receipts:", e);
        }
        // --- END LOCAL RECEIPT BYPASS ---

        const [subscriptionPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("subscription"), userPubkey.toBuffer()],
            FEE_ROUTER_PROGRAM_ID
        );

        const accountInfo = await connection.getAccountInfo(subscriptionPda);

        if (!accountInfo) {
            return { valid: false };
        }

        // The Account Layout is:
        // Discriminator (8 bytes) + Pubkey (32 bytes) + expires_at (8 bytes, i64)
        // Offset 8: user Pubkey (32 bytes)
        // Offset 40: expires_at (8 bytes, little endian i64)

        const data = accountInfo.data;
        if (data.length < 48) {
            return { valid: false };
        }

        const expiresAtBuffer = data.subarray(40, 48);
        const expiresAtSeconds = Number(expiresAtBuffer.readBigInt64LE(0));

        // Convert seconds to milliseconds
        const expiresAtMs = expiresAtSeconds * 1000;
        const currentMs = Date.now();

        if (expiresAtMs > currentMs) {
            const expiresAtDate = new Date(expiresAtMs);

            return {
                valid: true,
                expiresAt: expiresAtDate,
                assetId: subscriptionPda.toBase58(), // Expose PDA as the 'assetId'
            };
        }

        return { valid: false };
    } catch (error) {
        console.error("Pass check error:", error);
        return { valid: false };
    }
}

/**
 * Calculate the expiry date for a new pass for the UI preview.
 */
export function getPassExpiryDate(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + PASS_DURATION_DAYS);
    return expiry;
}

/**
 * Format the remaining time on a pass for display.
 */
export function formatPassTimeRemaining(expiresAt: Date): string {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();

    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
}
