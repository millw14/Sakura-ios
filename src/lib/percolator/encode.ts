/**
 * Low-level encoding utilities for Percolator instruction data.
 * Matches the ABI encoding from percolator-cli/src/abi/encode.ts
 */
import { PublicKey } from "@solana/web3.js";

export function encU8(val: number): Buffer {
    const buf = Buffer.alloc(1);
    buf.writeUInt8(val, 0);
    return buf;
}

export function encU16(val: number): Buffer {
    const buf = Buffer.alloc(2);
    buf.writeUInt16LE(val, 0);
    return buf;
}

export function encU32(val: number): Buffer {
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE(val, 0);
    return buf;
}

export function encU64(val: bigint | string | number): Buffer {
    const buf = Buffer.alloc(8);
    const n = typeof val === "bigint" ? val : BigInt(val);
    buf.writeBigUInt64LE(n, 0);
    return buf;
}

export function encI64(val: bigint | string | number): Buffer {
    const buf = Buffer.alloc(8);
    const n = typeof val === "bigint" ? val : BigInt(val);
    buf.writeBigInt64LE(n, 0);
    return buf;
}

export function encU128(val: bigint | string | number): Buffer {
    const buf = Buffer.alloc(16);
    const n = typeof val === "bigint" ? val : BigInt(val);
    // Write as two 64-bit LE words
    buf.writeBigUInt64LE(n & 0xFFFFFFFFFFFFFFFFn, 0);
    buf.writeBigUInt64LE(n >> 64n, 8);
    return buf;
}

export function encI128(val: bigint | string | number): Buffer {
    const buf = Buffer.alloc(16);
    let n = typeof val === "bigint" ? val : BigInt(val);

    // For negative numbers, compute two's complement
    if (n < 0n) {
        n = (1n << 128n) + n;
    }

    buf.writeBigUInt64LE(n & 0xFFFFFFFFFFFFFFFFn, 0);
    buf.writeBigUInt64LE((n >> 64n) & 0xFFFFFFFFFFFFFFFFn, 8);
    return buf;
}

export function encPubkey(pk: PublicKey | string): Buffer {
    const pubkey = typeof pk === "string" ? new PublicKey(pk) : pk;
    return Buffer.from(pubkey.toBytes());
}
