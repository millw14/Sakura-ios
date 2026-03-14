/**
 * Percolator instruction data encoders.
 * Directly ported from percolator-cli/src/abi/instructions.ts
 */
import { encU8, encU16, encU64, encI128, encU128 } from "./encode";

// Instruction tags matching Rust ix::Instruction::decode
export const IX_TAG = {
    InitMarket: 0,
    InitUser: 1,
    InitLP: 2,
    DepositCollateral: 3,
    WithdrawCollateral: 4,
    KeeperCrank: 5,
    TradeNoCpi: 6,
    LiquidateAtOracle: 7,
    CloseAccount: 8,
    TopUpInsurance: 9,
    TradeCpi: 10,
    SetRiskThreshold: 11,
    UpdateAdmin: 12,
    CloseSlab: 13,
    UpdateConfig: 14,
} as const;

// ============ InitUser (tag 1) — 9 bytes ============

export interface InitUserArgs {
    feePayment: bigint | string;
}

export function encodeInitUser(args: InitUserArgs): Buffer {
    return Buffer.concat([encU8(IX_TAG.InitUser), encU64(args.feePayment)]);
}

// ============ DepositCollateral (tag 3) — 11 bytes ============

export interface DepositCollateralArgs {
    userIdx: number;
    amount: bigint | string;
}

export function encodeDepositCollateral(args: DepositCollateralArgs): Buffer {
    return Buffer.concat([
        encU8(IX_TAG.DepositCollateral),
        encU16(args.userIdx),
        encU64(args.amount),
    ]);
}

// ============ WithdrawCollateral (tag 4) — 11 bytes ============

export interface WithdrawCollateralArgs {
    userIdx: number;
    amount: bigint | string;
}

export function encodeWithdrawCollateral(args: WithdrawCollateralArgs): Buffer {
    return Buffer.concat([
        encU8(IX_TAG.WithdrawCollateral),
        encU16(args.userIdx),
        encU64(args.amount),
    ]);
}

// ============ KeeperCrank (tag 5) — 4 bytes ============

const CRANK_NO_CALLER = 65535; // u16::MAX — permissionless

export interface KeeperCrankArgs {
    callerIdx?: number;
    allowPanic?: boolean;
}

export function encodeKeeperCrank(args: KeeperCrankArgs = {}): Buffer {
    return Buffer.concat([
        encU8(IX_TAG.KeeperCrank),
        encU16(args.callerIdx ?? CRANK_NO_CALLER),
        encU8(args.allowPanic ? 1 : 0),
    ]);
}

// ============ TradeNoCpi (tag 6) — 21 bytes ============

export interface TradeNoCpiArgs {
    lpIdx: number;
    userIdx: number;
    size: bigint | string;
}

export function encodeTradeNoCpi(args: TradeNoCpiArgs): Buffer {
    return Buffer.concat([
        encU8(IX_TAG.TradeNoCpi),
        encU16(args.lpIdx),
        encU16(args.userIdx),
        encI128(args.size),
    ]);
}

// ============ TradeCpi (tag 10) — 21 bytes ============

export interface TradeCpiArgs {
    lpIdx: number;
    userIdx: number;
    size: bigint | string;
}

export function encodeTradeCpi(args: TradeCpiArgs): Buffer {
    return Buffer.concat([
        encU8(IX_TAG.TradeCpi),
        encU16(args.lpIdx),
        encU16(args.userIdx),
        encI128(args.size),
    ]);
}

// ============ CloseAccount (tag 8) — 3 bytes ============

export interface CloseAccountArgs {
    userIdx: number;
}

export function encodeCloseAccount(args: CloseAccountArgs): Buffer {
    return Buffer.concat([encU8(IX_TAG.CloseAccount), encU16(args.userIdx)]);
}

// ============ TopUpInsurance (tag 9) — 9 bytes ============

export interface TopUpInsuranceArgs {
    amount: bigint | string;
}

export function encodeTopUpInsurance(args: TopUpInsuranceArgs): Buffer {
    return Buffer.concat([encU8(IX_TAG.TopUpInsurance), encU64(args.amount)]);
}
