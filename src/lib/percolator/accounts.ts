/**
 * Percolator account specs and meta builders.
 * Account orderings match the on-chain Rust processor exactly.
 */
import {
    PublicKey,
    AccountMeta,
    SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export interface AccountSpec {
    name: string;
    signer: boolean;
    writable: boolean;
}

// ============ Well-Known Accounts ============

export const WELL_KNOWN = {
    clock: SYSVAR_CLOCK_PUBKEY,
    tokenProgram: TOKEN_PROGRAM_ID,
} as const;

// ============ Account Orderings ============

/** InitUser: 5 accounts */
export const ACCOUNTS_INIT_USER: readonly AccountSpec[] = [
    { name: "user", signer: true, writable: false },
    { name: "slab", signer: false, writable: true },
    { name: "userAta", signer: false, writable: true },
    { name: "vault", signer: false, writable: true },
    { name: "tokenProgram", signer: false, writable: false },
] as const;

/** DepositCollateral: 6 accounts */
export const ACCOUNTS_DEPOSIT_COLLATERAL: readonly AccountSpec[] = [
    { name: "user", signer: true, writable: false },
    { name: "slab", signer: false, writable: true },
    { name: "userAta", signer: false, writable: true },
    { name: "vault", signer: false, writable: true },
    { name: "tokenProgram", signer: false, writable: false },
    { name: "clock", signer: false, writable: false },
] as const;

/** WithdrawCollateral: 8 accounts */
export const ACCOUNTS_WITHDRAW_COLLATERAL: readonly AccountSpec[] = [
    { name: "user", signer: true, writable: false },
    { name: "slab", signer: false, writable: true },
    { name: "vault", signer: false, writable: true },
    { name: "userAta", signer: false, writable: true },
    { name: "vaultPda", signer: false, writable: false },
    { name: "tokenProgram", signer: false, writable: false },
    { name: "clock", signer: false, writable: false },
    { name: "oracleIdx", signer: false, writable: false },
] as const;

/** KeeperCrank: 4 accounts */
export const ACCOUNTS_KEEPER_CRANK: readonly AccountSpec[] = [
    { name: "caller", signer: true, writable: false },
    { name: "slab", signer: false, writable: true },
    { name: "clock", signer: false, writable: false },
    { name: "oracle", signer: false, writable: false },
] as const;

/** TradeCpi: 8 accounts */
export const ACCOUNTS_TRADE_CPI: readonly AccountSpec[] = [
    { name: "user", signer: true, writable: false },
    { name: "lpOwner", signer: false, writable: false },
    { name: "slab", signer: false, writable: true },
    { name: "clock", signer: false, writable: false },
    { name: "oracle", signer: false, writable: false },
    { name: "matcherProg", signer: false, writable: false },
    { name: "matcherCtx", signer: false, writable: true },
    { name: "lpPda", signer: false, writable: false },
] as const;

/** TradeNoCpi: 5 accounts */
export const ACCOUNTS_TRADE_NOCPI: readonly AccountSpec[] = [
    { name: "user", signer: true, writable: false },
    { name: "lp", signer: true, writable: false },
    { name: "slab", signer: false, writable: true },
    { name: "clock", signer: false, writable: false },
    { name: "oracle", signer: false, writable: false },
] as const;

/** CloseAccount: 8 accounts */
export const ACCOUNTS_CLOSE_ACCOUNT: readonly AccountSpec[] = [
    { name: "user", signer: true, writable: false },
    { name: "slab", signer: false, writable: true },
    { name: "vault", signer: false, writable: true },
    { name: "userAta", signer: false, writable: true },
    { name: "vaultPda", signer: false, writable: false },
    { name: "tokenProgram", signer: false, writable: false },
    { name: "clock", signer: false, writable: false },
    { name: "oracle", signer: false, writable: false },
] as const;

/** TopUpInsurance: 5 accounts */
export const ACCOUNTS_TOPUP_INSURANCE: readonly AccountSpec[] = [
    { name: "user", signer: true, writable: false },
    { name: "slab", signer: false, writable: true },
    { name: "userAta", signer: false, writable: true },
    { name: "vault", signer: false, writable: true },
    { name: "tokenProgram", signer: false, writable: false },
] as const;

// ============ Account Meta Builder ============

/**
 * Build AccountMeta array from spec + pubkeys in order.
 */
export function buildAccountMetas(
    specs: readonly AccountSpec[],
    pubkeys: PublicKey[]
): AccountMeta[] {
    if (specs.length !== pubkeys.length) {
        throw new Error(
            `Account count mismatch: expected ${specs.length}, got ${pubkeys.length}`
        );
    }
    return specs.map((spec, i) => ({
        pubkey: pubkeys[i],
        isSigner: spec.signer,
        isWritable: spec.writable,
    }));
}
