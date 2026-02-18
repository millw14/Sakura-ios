import { getConnection, PASS_COLLECTION_NAME, PASS_DURATION_DAYS } from "./solana";

export interface PassStatus {
    valid: boolean;
    expiresAt?: Date;
    assetId?: string;
}

/**
 * Check if a wallet holds a valid (non-expired) Sakura Weekly Pass cNFT.
 * Uses the DAS (Digital Asset Standard) API to query compressed NFTs.
 */
export async function checkPassStatus(
    walletAddress: string
): Promise<PassStatus> {
    try {
        const connection = getConnection();

        // Use DAS API to get all assets owned by the wallet
        // This works with RPC providers that support DAS (Helius, Triton, etc.)
        const response = await fetch(connection.rpcEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "sakura-pass-check",
                method: "getAssetsByOwner",
                params: {
                    ownerAddress: walletAddress,
                    page: 1,
                    limit: 100,
                },
            }),
        });

        const data = await response.json();

        if (!data.result?.items) {
            return { valid: false };
        }

        // Find Sakura Weekly Pass cNFTs
        for (const asset of data.result.items) {
            const name = asset.content?.metadata?.name || "";
            if (!name.includes(PASS_COLLECTION_NAME)) continue;

            // Check expiry from attributes
            const attributes = asset.content?.metadata?.attributes || [];
            const expiryAttr = attributes.find(
                (a: { trait_type: string; value: string }) => a.trait_type === "expires_at"
            );

            if (expiryAttr) {
                const expiresAt = new Date(expiryAttr.value);
                if (expiresAt > new Date()) {
                    return {
                        valid: true,
                        expiresAt,
                        assetId: asset.id,
                    };
                }
            }
        }

        return { valid: false };
    } catch (error) {
        console.error("Pass check error:", error);
        return { valid: false };
    }
}

/**
 * Calculate the expiry date for a new pass (7 days from now).
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
