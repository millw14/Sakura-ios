/**
 * High-level Percolator trading client.
 * Composes instruction encoding, account specs, PDA derivation, and slab parsing
 * into a clean API for market operations.
 */
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SendOptions,
    ComputeBudgetProgram,
} from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
    PERCOLATOR_PROGRAM_ID,
    PERCOLATOR_MATCHER_PROGRAM_ID,
    MARKET_CONFIG,
    DEFAULT_LP,
    PASSIVE_LP,
    VAMM_LP,
    getDevnetConnection,
    getServerWallet,
} from "./config";
import {
    encodeInitUser,
    encodeDepositCollateral,
    encodeWithdrawCollateral,
    encodeKeeperCrank,
    encodeTradeCpi,
} from "./instructions";
import {
    ACCOUNTS_INIT_USER,
    ACCOUNTS_DEPOSIT_COLLATERAL,
    ACCOUNTS_WITHDRAW_COLLATERAL,
    ACCOUNTS_KEEPER_CRANK,
    ACCOUNTS_TRADE_CPI,
    WELL_KNOWN,
    buildAccountMetas,
} from "./accounts";
import { deriveLpPda } from "./pda";
import {
    fetchSlab,
    parseHeader,
    parseConfig,
    parseEngine,
    parseAccount,
    findAccountByOwner,
    parseAllAccounts,
    type SlabAccount,
    type SlabEngine,
} from "./slab";

// ============ Types ============

export interface MarketState {
    markPriceE6: string;
    markPriceUsd: number;
    oraclePriceE6: string;
    oraclePriceUsd: number;
    fundingAccumE6: string;
    fundingRateBps: number;
    lastCrankSlot: string;
    lastFullSweepSlot: string;
    insuranceFundLamports: string;
    insuranceFundSol: number;
    isInverted: boolean;
    totalAccounts: number;
    activePositions: number;
}

export interface PositionInfo {
    index: number;
    owner: string;
    collateralLamports: string;
    collateralSol: number;
    sizeRaw: string;
    isLong: boolean;
    entryPriceE6: string;
    entryPriceUsd: number;
    unrealizedPnlLamports: string;
    unrealizedPnlSol: number;
    marginRatio: number;
    liquidationPriceUsd: number;
}

export interface TradeResult {
    success: boolean;
    signature?: string;
    error?: string;
    slot?: number;
}

// ============ Helpers ============

function buildIx(
    programId: PublicKey,
    keys: ReturnType<typeof buildAccountMetas>,
    data: Buffer
): TransactionInstruction {
    return new TransactionInstruction({ programId, keys, data });
}

async function sendTransaction(
    connection: Connection,
    ix: TransactionInstruction,
    signers: Keypair[],
    computeUnits?: number
): Promise<TradeResult> {
    try {
        const tx = new Transaction();

        if (computeUnits) {
            tx.add(
                ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits })
            );
        }

        tx.add(ix);
        const latestBlockhash = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = latestBlockhash.blockhash;
        tx.feePayer = signers[0].publicKey;

        const options: SendOptions = {
            skipPreflight: false,
            preflightCommitment: "confirmed",
        };

        const signature = await connection.sendTransaction(tx, signers, options);

        const confirmation = await connection.confirmTransaction(
            {
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            },
            "confirmed"
        );

        if (confirmation.value.err) {
            return {
                success: false,
                signature,
                error: JSON.stringify(confirmation.value.err),
            };
        }

        return { success: true, signature };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message };
    }
}

// ============ Market State ============

export async function getMarketState(): Promise<MarketState> {
    const connection = getDevnetConnection();
    const data = await fetchSlab(connection, MARKET_CONFIG.slab);
    const header = parseHeader(data);
    const config = parseConfig(data);
    const engine = parseEngine(data);
    const allAccounts = parseAllAccounts(data);

    const markPriceE6 = engine.markPriceE6;
    const oraclePriceE6 = engine.oraclePriceE6;

    // For inverted markets, displayed price = 1 / (priceE6 / 1e6)
    const rawMarkPrice = Number(markPriceE6) / 1e6;
    const rawOraclePrice = Number(oraclePriceE6) / 1e6;
    const markPriceUsd = config.inverted && rawMarkPrice > 0
        ? 1 / rawMarkPrice
        : rawMarkPrice;
    const oraclePriceUsd = config.inverted && rawOraclePrice > 0
        ? 1 / rawOraclePrice
        : rawOraclePrice;

    // Approximate funding rate from accumulator
    const fundingRateBps = Number(engine.fundingAccumE6) / 1e6;

    return {
        markPriceE6: markPriceE6.toString(),
        markPriceUsd: Math.round(markPriceUsd * 100) / 100,
        oraclePriceE6: oraclePriceE6.toString(),
        oraclePriceUsd: Math.round(oraclePriceUsd * 100) / 100,
        fundingAccumE6: engine.fundingAccumE6.toString(),
        fundingRateBps,
        lastCrankSlot: engine.lastCrankSlot.toString(),
        lastFullSweepSlot: engine.lastFullSweepStartSlot.toString(),
        insuranceFundLamports: engine.insuranceFundE6.toString(),
        insuranceFundSol: Number(engine.insuranceFundE6) / 1e9,
        isInverted: config.inverted,
        totalAccounts: header.accountCount,
        activePositions: allAccounts.length,
    };
}

// ============ User Account ============

export async function getUserPosition(
    userIdx: number
): Promise<PositionInfo | null> {
    const connection = getDevnetConnection();
    const data = await fetchSlab(connection, MARKET_CONFIG.slab);
    const config = parseConfig(data);
    const engine = parseEngine(data);

    try {
        const account = parseAccount(data, userIdx);
        if (!account.isActive) return null;
        return buildPositionInfo(userIdx, account, engine, config.inverted);
    } catch {
        return null;
    }
}

export async function findUserPosition(
    ownerPubkey: string
): Promise<PositionInfo | null> {
    const connection = getDevnetConnection();
    const data = await fetchSlab(connection, MARKET_CONFIG.slab);
    const config = parseConfig(data);
    const engine = parseEngine(data);

    const result = findAccountByOwner(data, new PublicKey(ownerPubkey));
    if (!result) return null;

    return buildPositionInfo(result.index, result.account, engine, config.inverted);
}

function buildPositionInfo(
    index: number,
    account: SlabAccount,
    engine: SlabEngine,
    inverted: boolean
): PositionInfo {
    const collateralLamports = account.collateral;
    const collateralSol = Number(collateralLamports) / 1e9;
    const sizeRaw = account.size;
    const isLong = sizeRaw > 0n;
    const absSize = isLong ? sizeRaw : -sizeRaw;
    const entryPriceE6 = account.entryPriceE6;

    const rawEntryPrice = Number(entryPriceE6) / 1e6;
    const entryPriceUsd = inverted && rawEntryPrice > 0
        ? 1 / rawEntryPrice
        : rawEntryPrice;

    const rawMarkPrice = Number(engine.markPriceE6) / 1e6;
    const markPriceUsd = inverted && rawMarkPrice > 0
        ? 1 / rawMarkPrice
        : rawMarkPrice;

    // Calculate unrealized PnL
    // For inverted market: PnL = size * (1/entryPrice - 1/markPrice)
    // Simplified: PnL = size * (markPrice - entryPrice) / (entryPrice * markPrice)
    let pnlLamports = 0n;
    if (entryPriceE6 > 0n && engine.markPriceE6 > 0n && absSize > 0n) {
        const priceDiff = engine.markPriceE6 - entryPriceE6;
        // Simplified PnL approximation in lamports
        const pnlE6 = (sizeRaw * (inverted ? -priceDiff : priceDiff)) / entryPriceE6;
        pnlLamports = pnlE6;
    }

    const pnlSol = Number(pnlLamports) / 1e6;

    // Margin ratio
    const notional = Number(absSize) * rawMarkPrice;
    const marginRatio = notional > 0
        ? (collateralSol + pnlSol) / (notional / 1e9)
        : 0;

    // Estimated liquidation price (simplified)
    const maintenanceMarginBps = 500; // 5%
    const maintenanceRatio = maintenanceMarginBps / 10000;
    let liquidationPriceUsd = 0;
    if (Number(absSize) > 0) {
        if (isLong) {
            liquidationPriceUsd = entryPriceUsd * (1 - (collateralSol / (Number(absSize) / 1e9)) + maintenanceRatio);
        } else {
            liquidationPriceUsd = entryPriceUsd * (1 + (collateralSol / (Number(absSize) / 1e9)) - maintenanceRatio);
        }
    }

    return {
        index,
        owner: account.owner.toBase58(),
        collateralLamports: collateralLamports.toString(),
        collateralSol,
        sizeRaw: sizeRaw.toString(),
        isLong,
        entryPriceE6: entryPriceE6.toString(),
        entryPriceUsd: Math.round(entryPriceUsd * 100) / 100,
        unrealizedPnlLamports: pnlLamports.toString(),
        unrealizedPnlSol: Math.round(pnlSol * 10000) / 10000,
        marginRatio: Math.round(marginRatio * 10000) / 10000,
        liquidationPriceUsd: Math.round(liquidationPriceUsd * 100) / 100,
    };
}

// ============ Trading Operations ============

/**
 * Run keeper crank to update mark price and funding.
 * Must be called before risk-increasing trades.
 */
export async function runKeeperCrank(): Promise<TradeResult> {
    const connection = getDevnetConnection();
    const payer = getServerWallet();

    const ixData = encodeKeeperCrank({ allowPanic: false });
    const keys = buildAccountMetas(ACCOUNTS_KEEPER_CRANK, [
        payer.publicKey,
        MARKET_CONFIG.slab,
        WELL_KNOWN.clock,
        MARKET_CONFIG.oracle,
    ]);

    const ix = buildIx(PERCOLATOR_PROGRAM_ID, keys, ixData);
    return sendTransaction(connection, ix, [payer], 200_000);
}

/**
 * Initialize a new user account on the Percolator market.
 */
export async function initUserAccount(): Promise<TradeResult & { userIdx?: number }> {
    const connection = getDevnetConnection();
    const payer = getServerWallet();

    // Get user ATA for wrapped SOL
    const userAta = await getAssociatedTokenAddress(
        MARKET_CONFIG.mint,
        payer.publicKey
    );

    // Fee of 1_000_000 lamports (0.001 SOL)
    const ixData = encodeInitUser({ feePayment: "1000000" });
    const keys = buildAccountMetas(ACCOUNTS_INIT_USER, [
        payer.publicKey,
        MARKET_CONFIG.slab,
        userAta,
        MARKET_CONFIG.vault,
        WELL_KNOWN.tokenProgram,
    ]);

    const ix = buildIx(PERCOLATOR_PROGRAM_ID, keys, ixData);
    const result = await sendTransaction(connection, ix, [payer]);

    if (result.success) {
        // Find the newly created account
        const data = await fetchSlab(connection, MARKET_CONFIG.slab);
        const found = findAccountByOwner(data, payer.publicKey);
        return { ...result, userIdx: found?.index };
    }

    return result;
}

/**
 * Deposit collateral into a user account.
 */
export async function depositCollateral(
    userIdx: number,
    amountLamports: string
): Promise<TradeResult> {
    const connection = getDevnetConnection();
    const payer = getServerWallet();

    const userAta = await getAssociatedTokenAddress(
        MARKET_CONFIG.mint,
        payer.publicKey
    );

    const ixData = encodeDepositCollateral({
        userIdx,
        amount: amountLamports,
    });
    const keys = buildAccountMetas(ACCOUNTS_DEPOSIT_COLLATERAL, [
        payer.publicKey,
        MARKET_CONFIG.slab,
        userAta,
        MARKET_CONFIG.vault,
        WELL_KNOWN.tokenProgram,
        WELL_KNOWN.clock,
    ]);

    const ix = buildIx(PERCOLATOR_PROGRAM_ID, keys, ixData);
    return sendTransaction(connection, ix, [payer]);
}

/**
 * Withdraw collateral from a user account.
 */
export async function withdrawCollateral(
    userIdx: number,
    amountLamports: string
): Promise<TradeResult> {
    const connection = getDevnetConnection();
    const payer = getServerWallet();

    const userAta = await getAssociatedTokenAddress(
        MARKET_CONFIG.mint,
        payer.publicKey
    );

    const ixData = encodeWithdrawCollateral({
        userIdx,
        amount: amountLamports,
    });
    const keys = buildAccountMetas(ACCOUNTS_WITHDRAW_COLLATERAL, [
        payer.publicKey,
        MARKET_CONFIG.slab,
        MARKET_CONFIG.vault,
        userAta,
        MARKET_CONFIG.vaultPda,
        WELL_KNOWN.tokenProgram,
        WELL_KNOWN.clock,
        MARKET_CONFIG.oracle,
    ]);

    const ix = buildIx(PERCOLATOR_PROGRAM_ID, keys, ixData);
    return sendTransaction(connection, ix, [payer]);
}

/**
 * Execute a trade via CPI through a matcher.
 * Automatically runs keeper crank first to ensure fresh prices.
 *
 * @param userIdx - User account index on the slab
 * @param size - Trade size as string. Positive = long, negative = short.
 * @param lpIndex - LP index to trade against (defaults to vAMM LP)
 */
export async function executeTrade(
    userIdx: number,
    size: string,
    lpIndex?: number
): Promise<TradeResult> {
    const connection = getDevnetConnection();
    const payer = getServerWallet();

    // Step 1: Run keeper crank for fresh prices
    const crankResult = await runKeeperCrank();
    if (!crankResult.success) {
        return {
            success: false,
            error: `Keeper crank failed: ${crankResult.error}`,
        };
    }

    // Step 2: Determine which LP to use
    const lp = lpIndex === 0 ? PASSIVE_LP : DEFAULT_LP;
    const lpIdx = lp.index;

    // Step 3: Read LP owner from slab
    const data = await fetchSlab(connection, MARKET_CONFIG.slab);
    const lpAccount = parseAccount(data, lpIdx);
    const lpOwnerPk = lpAccount.owner;

    // Step 4: Derive LP PDA
    const [lpPda] = deriveLpPda(PERCOLATOR_PROGRAM_ID, MARKET_CONFIG.slab, lpIdx);

    // Step 5: Build trade-cpi instruction
    const ixData = encodeTradeCpi({
        lpIdx,
        userIdx,
        size,
    });

    const keys = buildAccountMetas(ACCOUNTS_TRADE_CPI, [
        payer.publicKey,    // user (signer)
        lpOwnerPk,          // lpOwner (read from slab, not signer)
        MARKET_CONFIG.slab,
        WELL_KNOWN.clock,
        MARKET_CONFIG.oracle,
        PERCOLATOR_MATCHER_PROGRAM_ID, // matcherProg
        lp.matcherCtx,      // matcherCtx
        lpPda,               // lpPda
    ]);

    const ix = buildIx(PERCOLATOR_PROGRAM_ID, keys, ixData);
    return sendTransaction(connection, ix, [payer]);
}

/**
 * Get all active positions on the market.
 */
export async function getAllPositions(): Promise<PositionInfo[]> {
    const connection = getDevnetConnection();
    const data = await fetchSlab(connection, MARKET_CONFIG.slab);
    const config = parseConfig(data);
    const engine = parseEngine(data);
    const allAccounts = parseAllAccounts(data);

    return allAccounts
        .filter(({ account }) => account.size !== 0n) // Only accounts with open positions
        .map(({ index, account }) =>
            buildPositionInfo(index, account, engine, config.inverted)
        );
}
