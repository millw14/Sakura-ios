/**
 * Slab data fetching and parsing for Percolator market state.
 * Reads on-chain slab account data to extract market info, positions, oracle prices.
 */
import { Connection, PublicKey } from "@solana/web3.js";

// ============ Slab Layout Constants ============

// Slab header is 256 bytes
const HEADER_SIZE = 256;
// Config section starts at offset 256, is 256 bytes
const CONFIG_OFFSET = 256;
const CONFIG_SIZE = 256;
// Engine section starts after config
const ENGINE_OFFSET = CONFIG_OFFSET + CONFIG_SIZE;
const ENGINE_SIZE = 256;
// Accounts start after engine + bitmap
const BITMAP_OFFSET = ENGINE_OFFSET + ENGINE_SIZE;
// Each account slot is 256 bytes
const ACCOUNT_SIZE = 256;

// Account field offsets within each 256-byte slot
const ACCT_OWNER_OFFSET = 0; // 32 bytes
const ACCT_COLLATERAL_OFFSET = 32; // 16 bytes (u128)
const ACCT_SIZE_OFFSET = 48; // 16 bytes (i128)
const ACCT_ENTRY_PRICE_OFFSET = 64; // 8 bytes (u64, price_e6)
const ACCT_FUNDING_ACCUM_OFFSET = 72; // 16 bytes (i128)
const ACCT_FLAGS_OFFSET = 88; // 1 byte

// ============ Types ============

export interface SlabHeader {
    magic: bigint;
    version: number;
    accountCount: number;
    admin: PublicKey;
}

export interface SlabConfig {
    collateralMint: PublicKey;
    vaultPubkey: PublicKey;
    indexFeedId: PublicKey; // oracle
    inverted: boolean;
    maintenanceMarginBps: bigint;
    initialMarginBps: bigint;
    tradingFeeBps: bigint;
    maxAccounts: bigint;
}

export interface SlabEngine {
    markPriceE6: bigint;
    lastCrankSlot: bigint;
    fundingAccumE6: bigint;
    oraclePriceE6: bigint;
    lastFullSweepStartSlot: bigint;
    insuranceFundE6: bigint;
}

export interface SlabAccount {
    owner: PublicKey;
    collateral: bigint; // u128
    size: bigint; // i128 (positive = long, negative = short)
    entryPriceE6: bigint; // u64
    fundingAccumE6: bigint; // i128
    isActive: boolean;
}

// ============ Fetch ============

export async function fetchSlab(
    connection: Connection,
    slabPk: PublicKey
): Promise<Buffer> {
    const accountInfo = await connection.getAccountInfo(slabPk);
    if (!accountInfo) {
        throw new Error(`Slab account not found: ${slabPk.toBase58()}`);
    }
    return Buffer.from(accountInfo.data);
}

// ============ Parsers ============

function readU16LE(buf: Buffer, offset: number): number {
    return buf.readUInt16LE(offset);
}

function readU32LE(buf: Buffer, offset: number): number {
    return buf.readUInt32LE(offset);
}

function readU64LE(buf: Buffer, offset: number): bigint {
    return buf.readBigUInt64LE(offset);
}

function readI128LE(buf: Buffer, offset: number): bigint {
    const lo = buf.readBigUInt64LE(offset);
    const hi = buf.readBigInt64LE(offset + 8);
    return (hi << 64n) | lo;
}

function readU128LE(buf: Buffer, offset: number): bigint {
    const lo = buf.readBigUInt64LE(offset);
    const hi = buf.readBigUInt64LE(offset + 8);
    return (hi << 64n) | lo;
}

function readPubkey(buf: Buffer, offset: number): PublicKey {
    return new PublicKey(buf.subarray(offset, offset + 32));
}

export function parseHeader(data: Buffer): SlabHeader {
    return {
        magic: readU64LE(data, 0),
        version: readU32LE(data, 8),
        accountCount: readU16LE(data, 12),
        admin: readPubkey(data, 16),
    };
}

export function parseConfig(data: Buffer): SlabConfig {
    const base = CONFIG_OFFSET;
    return {
        collateralMint: readPubkey(data, base + 0),
        vaultPubkey: readPubkey(data, base + 32),
        indexFeedId: readPubkey(data, base + 64),
        inverted: data.readUInt8(base + 96) !== 0,
        maintenanceMarginBps: readU64LE(data, base + 104),
        initialMarginBps: readU64LE(data, base + 112),
        tradingFeeBps: readU64LE(data, base + 120),
        maxAccounts: readU64LE(data, base + 128),
    };
}

export function parseEngine(data: Buffer): SlabEngine {
    const base = ENGINE_OFFSET;
    return {
        markPriceE6: readU64LE(data, base + 0),
        lastCrankSlot: readU64LE(data, base + 8),
        fundingAccumE6: readI128LE(data, base + 16),
        oraclePriceE6: readU64LE(data, base + 32),
        lastFullSweepStartSlot: readU64LE(data, base + 40),
        insuranceFundE6: readU128LE(data, base + 48),
    };
}

/**
 * Calculate the byte offset for a given account index.
 * Accounts are stored after the bitmap. The bitmap size depends on maxAccounts.
 */
function getAccountOffset(data: Buffer, index: number): number {
    const config = parseConfig(data);
    const maxAccounts = Number(config.maxAccounts);
    // Bitmap is ceil(maxAccounts / 8) bytes, padded to 8-byte alignment
    const bitmapBytes = Math.ceil(maxAccounts / 8);
    const bitmapAligned = Math.ceil(bitmapBytes / 8) * 8;
    const accountsStart = BITMAP_OFFSET + bitmapAligned;
    return accountsStart + index * ACCOUNT_SIZE;
}

export function parseAccount(data: Buffer, index: number): SlabAccount {
    const offset = getAccountOffset(data, index);

    if (offset + ACCOUNT_SIZE > data.length) {
        throw new Error(
            `Account index ${index} out of range (offset ${offset}, data length ${data.length})`
        );
    }

    const owner = readPubkey(data, offset + ACCT_OWNER_OFFSET);
    const collateral = readU128LE(data, offset + ACCT_COLLATERAL_OFFSET);
    const size = readI128LE(data, offset + ACCT_SIZE_OFFSET);
    const entryPriceE6 = readU64LE(data, offset + ACCT_ENTRY_PRICE_OFFSET);
    const fundingAccumE6 = readI128LE(data, offset + ACCT_FUNDING_ACCUM_OFFSET);
    const flags = data.readUInt8(offset + ACCT_FLAGS_OFFSET);
    const isActive = owner.toBase58() !== "11111111111111111111111111111111";

    return {
        owner,
        collateral,
        size,
        entryPriceE6,
        fundingAccumE6,
        isActive,
    };
}

/**
 * Find a user account index by owner public key.
 * Scans all account slots in the slab.
 */
export function findAccountByOwner(
    data: Buffer,
    ownerPk: PublicKey
): { index: number; account: SlabAccount } | null {
    const config = parseConfig(data);
    const maxAccounts = Number(config.maxAccounts);
    const ownerStr = ownerPk.toBase58();

    for (let i = 0; i < maxAccounts; i++) {
        try {
            const account = parseAccount(data, i);
            if (account.isActive && account.owner.toBase58() === ownerStr) {
                return { index: i, account };
            }
        } catch {
            break; // Out of range
        }
    }

    return null;
}

/**
 * Parse all active accounts from the slab.
 */
export function parseAllAccounts(
    data: Buffer
): { index: number; account: SlabAccount }[] {
    const config = parseConfig(data);
    const maxAccounts = Number(config.maxAccounts);
    const results: { index: number; account: SlabAccount }[] = [];

    for (let i = 0; i < maxAccounts; i++) {
        try {
            const account = parseAccount(data, i);
            if (account.isActive) {
                results.push({ index: i, account });
            }
        } catch {
            break;
        }
    }

    return results;
}
