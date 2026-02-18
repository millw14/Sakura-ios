import { Connection, PublicKey } from "@solana/web3.js";

// ============ Network Config ============
export const SOLANA_NETWORK = "devnet";
export const RPC_ENDPOINT = "https://api.devnet.solana.com";

// ============ USDC Config ============
// Devnet USDC mint address (SPL token)
export const USDC_MINT = new PublicKey(
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" // devnet USDC
);
export const USDC_DECIMALS = 6;

// ============ Treasury ============
// Devnet treasury wallet — receives USDC payments for passes
// Replace with your own wallet for mainnet
export const TREASURY_WALLET = new PublicKey(
    "11111111111111111111111111111111" // placeholder — will be updated
);

// ============ Pass Config ============
// ============ Pass Config ============
export const WEEKLY_PASS_PRICE = 10; // 10 USDC (Monthly)
export const PASS_DURATION_DAYS = 30; // 30 Days
export const PASS_COLLECTION_NAME = "Sakura Premium Pass";

// ============ Merkle Tree ============
// Will be populated after running scripts/create-tree.ts
export const MERKLE_TREE_ADDRESS = "";

// ============ Connection ============
let connectionInstance: Connection | null = null;

export function getConnection(): Connection {
    if (!connectionInstance) {
        connectionInstance = new Connection(RPC_ENDPOINT, "confirmed");
    }
    return connectionInstance;
}

// ============ Helpers ============
export function truncateAddress(address: string): string {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function lamportsToSol(lamports: number): number {
    return lamports / 1e9;
}

export function usdcToSmallestUnit(amount: number): number {
    return Math.round(amount * 10 ** USDC_DECIMALS);
}
