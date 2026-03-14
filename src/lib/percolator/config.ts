import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

// ============ Percolator Devnet Configuration ============

export const PERCOLATOR_NETWORK = "devnet";
export const PERCOLATOR_RPC_URL =
    process.env.PERCOLATOR_RPC_URL || "https://api.devnet.solana.com";

// Program IDs
export const PERCOLATOR_PROGRAM_ID = new PublicKey(
    "2SSnp35m7FQ7cRLNKGdW5UzjYFF6RBUNq7d3m5mqNByp"
);
export const PERCOLATOR_MATCHER_PROGRAM_ID = new PublicKey(
    "4HcGCsyjAqnFua5ccuXyt8KRRQzKFbGTJkVChpS7Yfzy"
);

// ============ Devnet Market ============

export const MARKET_CONFIG = {
    slab: new PublicKey("A7wQtRT9DhFqYho8wTVqQCDc7kYPTUXGPATiyVbZKVFs"),
    mint: new PublicKey("So11111111111111111111111111111111111111112"), // Wrapped SOL
    vault: new PublicKey("63juJmvm1XHCHveWv9WdanxqJX6tD6DLFTZD7dvH12dc"),
    vaultPda: new PublicKey("4C6cZFwwDnEyL81YZPY9xBUnnBuM9gWHcvjpHa71y3V6"),
    oracle: new PublicKey("99B2bTijsU6f1GCT73HmdR7HCFFjGMBcPZY6jZ96ynrR"),
    oracleType: "chainlink" as const,
    inverted: true,
} as const;

// ============ LP Configurations ============

export const PASSIVE_LP = {
    index: 0,
    pda: new PublicKey("7YgxweQCVnBDfnP7hBdrBLV5NXpSLPS9mx6fgaGnH3jd"),
    matcherCtx: new PublicKey("5n3jT6iy9TK3XNMQarC1sK26zS8ofjLG3dvE9iDEFYhK"),
    spreadBps: 50,
} as const;

export const VAMM_LP = {
    index: 4,
    pda: new PublicKey("CwfVwVayiuVxXmagcP8Rha7eow29NUtHzFNdzikCzA8h"),
    matcherCtx: new PublicKey("BUWfYszAAUuGkGiaMT9ahnkHeHFQ5MbC7STQdhS28cZF"),
    tradingFeeBps: 5,
    baseSpreadBps: 10,
    maxTotalBps: 200,
    impactKBps: 100,
} as const;

// Default LP to use for trades (vAMM has tighter spreads)
export const DEFAULT_LP = VAMM_LP;

// ============ Risk Parameters ============

export const RISK_PARAMS = {
    maintenanceMarginBps: 500, // 5%
    initialMarginBps: 1000, // 10%
    tradingFeeBps: 10, // 0.1%
    maxCrankStalenessSlots: 200, // ~80 seconds
} as const;

// ============ Fee Configuration ============

export const TRADING_FEE_SAKURA = 10; // 10 $SAKURA per trade
export const FEE_SPLITS = {
    creators: 30, // 30%
    ops: 20, // 20%
    provenance: 30, // 30%
    community: 20, // 20%
} as const;

// Fee recipient wallets (placeholder addresses — replace with real ones)
export const FEE_RECIPIENTS = {
    creators: new PublicKey("11111111111111111111111111111111"),
    ops: new PublicKey("11111111111111111111111111111111"),
    provenance: new PublicKey("11111111111111111111111111111111"),
    community: new PublicKey("11111111111111111111111111111111"),
} as const;

// ============ Connection ============

let devnetConnection: Connection | null = null;

export function getDevnetConnection(): Connection {
    if (!devnetConnection) {
        devnetConnection = new Connection(PERCOLATOR_RPC_URL, "confirmed");
    }
    return devnetConnection;
}

// ============ Server Wallet ============

let serverWallet: Keypair | null = null;

export function getServerWallet(): Keypair {
    if (!serverWallet) {
        const key = process.env.PERCOLATOR_WALLET_KEY;
        if (!key) {
            throw new Error(
                "PERCOLATOR_WALLET_KEY not set in environment variables"
            );
        }
        const secretKey = bs58.decode(key);
        serverWallet = Keypair.fromSecretKey(secretKey);
    }
    return serverWallet;
}
