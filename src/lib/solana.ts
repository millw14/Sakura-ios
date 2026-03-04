import { Connection, PublicKey } from "@solana/web3.js";

// ============ Network Config ============
export const SOLANA_NETWORK = "mainnet-beta";
export const RPC_ENDPOINT = "https://methodical-damp-scion.solana-mainnet.quiknode.pro/472e366da66699252c8bc1e4cae44f8ea9dc4265/";

// ============ $SAKURA Token Config ============
// $SAKURA SPL token mint address
export const SAKURA_MINT = new PublicKey(
    "EWiVNxCqNatzV2paBHyfKUwGLnk7WKs9uZTA5jkTpump"
);
export const SAKURA_DECIMALS = 9;

// ============ Pass Config ============
export const MONTHLY_PASS_PRICE = 100; // 100 $SAKURA for a monthly pass
export const PASS_DURATION_DAYS = 30;
export const PASS_COLLECTION_NAME = "Sakura Monthly Pass";

// ============ Payment Split Configuration ============
// The SakuraFeeRouter program handles splitting this automatically. 
// Hardcoded split in Program: 50% Insurance, 50% SPL Burn.

export const FEE_ROUTER_PROGRAM_ID = new PublicKey(
    "FNoE2JUhn981hBDyBMvWJYkw9DThhtYwWoPbw6wgz1rg"
);

export const PERCOLATOR_INSURANCE_VAULT = new PublicKey(
    "63juJmvm1XHCHveWv9WdanxqJX6tD6DLFTZD7dvH12dc"
);

export const INSURANCE_SPLIT = 50;
export const BURN_SPLIT = 50;


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

export function sakuraToSmallestUnit(amount: number): number {
    return Math.round(amount * 10 ** SAKURA_DECIMALS);
}
