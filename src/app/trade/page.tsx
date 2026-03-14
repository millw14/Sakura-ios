"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Header from "@/components/Header";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSakuraWalletModal } from "@/components/SakuraWalletModal";
import {
    TRADING_FEE_SAKURA,
    FEE_SPLITS,
    RISK_PARAMS,
    MARKET_CONFIG,
    PERCOLATOR_PROGRAM_ID,
    getDevnetConnection,
} from "@/lib/percolator/config";
import { calculateTradingFeeSplits } from "@/lib/percolator/fee-router";

// ============ Types ============

type TradeSide = "long" | "short";
type OrderType = "market" | "limit";
type MarginMode = "cross" | "isolated";
type TradeState = "idle" | "paying_fee" | "executing" | "success" | "error";

interface MarketData {
    markPrice: number;
    indexPrice: number;
    fundingRate: number;
    nextFunding: number;
    volume24h: number;
    openInterest: number;
    high24h: number;
    low24h: number;
    change24h: number;
}

interface Position {
    side: TradeSide;
    size: number;
    notional: number;
    entryPrice: number;
    markPrice: number;
    pnl: number;
    pnlPercent: number;
    margin: number;
    leverage: number;
    liquidationPrice: number;
}

interface OrderBookLevel {
    price: number;
    size: number;
    total: number;
}

// ============ Mock Data Generators ============

function generateOrderBook(midPrice: number): { bids: OrderBookLevel[]; asks: OrderBookLevel[] } {
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];
    let bidTotal = 0;
    let askTotal = 0;

    for (let i = 0; i < 12; i++) {
        const bidSize = Math.round((Math.random() * 15 + 2) * 100) / 100;
        bidTotal += bidSize;
        bids.push({
            price: Math.round((midPrice - 0.05 * (i + 1)) * 100) / 100,
            size: bidSize,
            total: Math.round(bidTotal * 100) / 100,
        });

        const askSize = Math.round((Math.random() * 15 + 2) * 100) / 100;
        askTotal += askSize;
        asks.push({
            price: Math.round((midPrice + 0.05 * (i + 1)) * 100) / 100,
            size: askSize,
            total: Math.round(askTotal * 100) / 100,
        });
    }

    return { bids, asks: asks.reverse() };
}

function generateRecentTrades(midPrice: number) {
    return Array.from({ length: 15 }, (_, i) => ({
        price: Math.round((midPrice + (Math.random() - 0.5) * 0.6) * 100) / 100,
        size: Math.round((Math.random() * 8 + 0.5) * 100) / 100,
        side: Math.random() > 0.5 ? ("buy" as const) : ("sell" as const),
        time: new Date(Date.now() - i * 3000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    }));
}

// ============ Component ============

export default function TradePage() {
    const { publicKey, signTransaction, connected } = useWallet();
    const { setVisible } = useSakuraWalletModal();

    // Market
    const [market, setMarket] = useState<MarketData>({
        markPrice: 142.58,
        indexPrice: 142.55,
        fundingRate: 0.0045,
        nextFunding: 3600,
        volume24h: 847_520_000,
        openInterest: 125_400_000,
        high24h: 145.20,
        low24h: 138.90,
        change24h: 2.67,
    });
    const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
    const [fundingCountdown, setFundingCountdown] = useState(3600);

    // Order book & trades
    const [orderBook, setOrderBook] = useState(() => generateOrderBook(142.58));
    const [recentTrades, setRecentTrades] = useState(() => generateRecentTrades(142.58));

    // Trading controls
    const [tradeSide, setTradeSide] = useState<TradeSide>("long");
    const [orderType, setOrderType] = useState<OrderType>("market");
    const [marginMode, setMarginMode] = useState<MarginMode>("cross");
    const [leverage, setLeverage] = useState(5);
    const [tradeSize, setTradeSize] = useState("");
    const [limitPrice, setLimitPrice] = useState("");
    const [tradeState, setTradeState] = useState<TradeState>("idle");
    const [tradeError, setTradeError] = useState("");
    const [showSettings, setShowSettings] = useState(false);

    // Positions & orders
    const [activeTab, setActiveTab] = useState<"positions" | "orders" | "trades">("positions");
    const [positions, setPositions] = useState<Position[]>([
        {
            side: "long",
            size: 2.5,
            notional: 356.45,
            entryPrice: 140.22,
            markPrice: 142.58,
            pnl: 5.90,
            pnlPercent: 4.21,
            margin: 35.64,
            leverage: 10,
            liquidationPrice: 126.20,
        },
    ]);

    const feeSplits = calculateTradingFeeSplits();

    // ============ Simulated Live Data ============

    useEffect(() => {
        let isMounted = true;

        const fetchSolPrice = async () => {
            try {
                // Use CoinGecko for better reliability across regions (Binance often blocks US IPs)
                const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true");
                if (!res.ok) return;
                const data = await res.json();
                
                if (!isMounted || !data.solana) return;

                const lastPrice = data.solana.usd;
                const change = data.solana.usd_24h_change;
                const volume = data.solana.usd_24h_vol;
                
                // Mock high/low based on change since CG simple endpoint doesn't provide them
                const high = change > 0 ? lastPrice : lastPrice / (1 + change/100);
                const low = change < 0 ? lastPrice : lastPrice / (1 + change/100);

                setMarket((prev) => {
                    // Add micro-jitter so the UI looks active even if API caches for 30s
                    const jitter = (Math.random() - 0.5) * 0.02;
                    const displayPrice = Math.round((lastPrice + jitter) * 100) / 100;

                    if (prev.markPrice !== displayPrice) {
                        setPriceFlash(displayPrice > prev.markPrice ? "up" : "down");
                        setTimeout(() => setPriceFlash(null), 400);
                    }
                    return {
                        ...prev,
                        markPrice: displayPrice,
                        indexPrice: lastPrice, 
                        change24h: change,
                        high24h: high,
                        low24h: low,
                        volume24h: volume,
                    };
                });

                setOrderBook(() => generateOrderBook(lastPrice));
                
                if (Math.random() > 0.3) {
                    setRecentTrades((prev) => {
                        const newTrade = {
                            price: Math.round((lastPrice + (Math.random() - 0.5) * 0.2) * 100) / 100,
                            size: Math.round((Math.random() * 8 + 0.5) * 100) / 100,
                            side: Math.random() > 0.5 ? ("buy" as const) : ("sell" as const),
                            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                        };
                        return [newTrade, ...prev.slice(0, 14)];
                    });
                }
            } catch (err) {
                console.error("Failed to fetch SOL price", err);
            }
        };

        fetchSolPrice();
        const interval = setInterval(fetchSolPrice, 3500);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // Funding countdown
    useEffect(() => {
        const interval = setInterval(() => {
            setFundingCountdown((prev) => (prev <= 0 ? 3600 : prev - 1));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Update position PnL
    useEffect(() => {
        setPositions((prev) =>
            prev.map((pos) => {
                const pnl = pos.side === "long"
                    ? (market.markPrice - pos.entryPrice) * pos.size
                    : (pos.entryPrice - market.markPrice) * pos.size;
                return {
                    ...pos,
                    markPrice: market.markPrice,
                    pnl: Math.round(pnl * 100) / 100,
                    pnlPercent: Math.round((pnl / pos.margin) * 10000) / 100,
                };
            })
        );
    }, [market.markPrice]);

    // ============ Calculations ============

    const sizeNum = parseFloat(tradeSize) || 0;
    const notional = sizeNum * market.markPrice;
    const marginRequired = notional / leverage;
    const liquidationPrice = useMemo(() => {
        if (sizeNum <= 0) return 0;
        const mmRatio = RISK_PARAMS.maintenanceMarginBps / 10000;
        if (tradeSide === "long") {
            return Math.round((market.markPrice * (1 - 1 / leverage + mmRatio)) * 100) / 100;
        }
        return Math.round((market.markPrice * (1 + 1 / leverage - mmRatio)) * 100) / 100;
    }, [sizeNum, market.markPrice, leverage, tradeSide]);

    const formatFunding = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    const formatUsd = (v: number) => v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${v.toLocaleString()}`;

    // Max depth for order book visualization
    const maxDepth = Math.max(
        ...orderBook.bids.map((l) => l.total),
        ...orderBook.asks.map((l) => l.total)
    );

    // ============ Trade Execution ============

    const handleTrade = async () => {
        if (!connected || !publicKey) {
            setVisible(true);
            return;
        }
        if (!tradeSize || sizeNum <= 0) {
            setTradeError("Enter a valid size");
            setTradeState("error");
            return;
        }

        try {
            setTradeState("paying_fee");
            setTradeError("");

            // Simulate fee payment + trade execution
            await new Promise((r) => setTimeout(r, 1500));
            setTradeState("executing");
            await new Promise((r) => setTimeout(r, 2000));

            // Add mock position
            const newPos: Position = {
                side: tradeSide,
                size: sizeNum,
                notional: Math.round(notional * 100) / 100,
                entryPrice: market.markPrice,
                markPrice: market.markPrice,
                pnl: 0,
                pnlPercent: 0,
                margin: Math.round(marginRequired * 100) / 100,
                leverage,
                liquidationPrice,
            };
            setPositions((prev) => [newPos, ...prev]);
            setTradeState("success");
            setTradeSize("");
            setTimeout(() => setTradeState("idle"), 3000);
        } catch (error: unknown) {
            setTradeError(error instanceof Error ? error.message : "Trade failed");
            setTradeState("error");
        }
    };

    // ============ Render ============

    return (
        <>
            <Header />
            <main className="main-content perp-page">
                {/* ===== Top Market Info Bar ===== */}
                <div className="perp-market-bar">
                    <div className="perp-pair">
                        <div className="perp-pair-icon">◎</div>
                        <div>
                            <span className="perp-pair-name">SOL-PERP</span>
                            <span className="perp-pair-badge">{leverage}x</span>
                        </div>
                    </div>

                    <div className={`perp-mark-price ${priceFlash ? `flash-${priceFlash}` : ""}`}>
                        ${market.markPrice.toFixed(2)}
                    </div>

                    <div className="perp-stats-row">
                        <div className="perp-stat-pill">
                            <span className="perp-stat-k">Index</span>
                            <span className="perp-stat-v">${market.indexPrice.toFixed(2)}</span>
                        </div>
                        <div className="perp-stat-pill">
                            <span className="perp-stat-k">24h Change</span>
                            <span className={`perp-stat-v ${market.change24h >= 0 ? "green" : "red"}`}>
                                {market.change24h >= 0 ? "+" : ""}{market.change24h.toFixed(2)}%
                            </span>
                        </div>
                        <div className="perp-stat-pill">
                            <span className="perp-stat-k">24h High</span>
                            <span className="perp-stat-v">${market.high24h.toFixed(2)}</span>
                        </div>
                        <div className="perp-stat-pill">
                            <span className="perp-stat-k">24h Low</span>
                            <span className="perp-stat-v">${market.low24h.toFixed(2)}</span>
                        </div>
                        <div className="perp-stat-pill">
                            <span className="perp-stat-k">24h Vol</span>
                            <span className="perp-stat-v">{formatUsd(market.volume24h)}</span>
                        </div>
                        <div className="perp-stat-pill">
                            <span className="perp-stat-k">Open Interest</span>
                            <span className="perp-stat-v">{formatUsd(market.openInterest)}</span>
                        </div>
                        <div className="perp-stat-pill funding">
                            <span className="perp-stat-k">Funding / Countdown</span>
                            <span className={`perp-stat-v ${market.fundingRate >= 0 ? "green" : "red"}`}>
                                {market.fundingRate >= 0 ? "+" : ""}{market.fundingRate.toFixed(4)}% / {formatFunding(fundingCountdown)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ===== Main Trading Grid ===== */}
                <div className="perp-grid">
                    {/* Left: Order Book */}
                    <div className="perp-orderbook">
                        <div className="perp-panel-header">
                            <span>Order Book</span>
                            <div className="perp-ob-modes">
                                <button className="perp-ob-mode active" title="Both">
                                    <span className="ob-icon-both" />
                                </button>
                                <button className="perp-ob-mode" title="Bids">
                                    <span className="ob-icon-bids" />
                                </button>
                                <button className="perp-ob-mode" title="Asks">
                                    <span className="ob-icon-asks" />
                                </button>
                            </div>
                        </div>

                        <div className="perp-ob-header-row">
                            <span>Price (USD)</span>
                            <span>Size (SOL)</span>
                            <span>Total</span>
                        </div>

                        {/* Asks (reversed so lowest is at bottom) */}
                        <div className="perp-ob-asks">
                            {orderBook.asks.map((level, i) => (
                                <div key={`a${i}`} className="perp-ob-row ask">
                                    <div
                                        className="perp-ob-depth ask"
                                        style={{ width: `${(level.total / maxDepth) * 100}%` }}
                                    />
                                    <span className="perp-ob-price red">{level.price.toFixed(2)}</span>
                                    <span className="perp-ob-size">{level.size.toFixed(2)}</span>
                                    <span className="perp-ob-total">{level.total.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>

                        {/* Spread */}
                        <div className="perp-ob-spread">
                            <span className={`perp-ob-mid ${priceFlash ? `flash-${priceFlash}` : ""}`}>
                                ${market.markPrice.toFixed(2)}
                            </span>
                            <span className="perp-ob-spread-val">
                                Spread: ${(orderBook.asks[orderBook.asks.length - 1]?.price - orderBook.bids[0]?.price || 0.10).toFixed(2)}
                            </span>
                        </div>

                        {/* Bids */}
                        <div className="perp-ob-bids">
                            {orderBook.bids.map((level, i) => (
                                <div key={`b${i}`} className="perp-ob-row bid">
                                    <div
                                        className="perp-ob-depth bid"
                                        style={{ width: `${(level.total / maxDepth) * 100}%` }}
                                    />
                                    <span className="perp-ob-price green">{level.price.toFixed(2)}</span>
                                    <span className="perp-ob-size">{level.size.toFixed(2)}</span>
                                    <span className="perp-ob-total">{level.total.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Center: Chart */}
                    <div className="perp-chart">
                        <div className="perp-chart-toolbar">
                            <div className="perp-chart-tf-group">
                                {["1m", "5m", "15m", "1H", "4H", "1D"].map((tf) => (
                                    <button key={tf} className={`perp-chart-tf ${tf === "15m" ? "active" : ""}`}>{tf}</button>
                                ))}
                            </div>
                            <div className="perp-chart-indicators">
                                <button className="perp-chart-ind">MA</button>
                                <button className="perp-chart-ind">EMA</button>
                                <button className="perp-chart-ind">BOLL</button>
                                <button className="perp-chart-ind">VOL</button>
                            </div>
                        </div>
                        <div className="perp-chart-body">
                            <div className="perp-chart-price-overlay">
                                <span className="perp-chart-big">${market.markPrice.toFixed(2)}</span>
                                <span className={`perp-chart-change ${market.change24h >= 0 ? "green" : "red"}`}>
                                    {market.change24h >= 0 ? "▲" : "▼"} {Math.abs(market.change24h).toFixed(2)}%
                                </span>
                            </div>
                            <div className="perp-chart-candles-bg">
                                {Array.from({ length: 40 }).map((_, i) => {
                                    const isGreen = Math.sin(i * 0.5 + Date.now() / 5000) > -0.2;
                                    const h = 15 + Math.abs(Math.sin(i * 0.7)) * 45 + Math.random() * 15;
                                    const wickH = h + 5 + Math.random() * 10;
                                    return (
                                        <div key={i} className="perp-candle-col" style={{ animationDelay: `${i * 0.03}s` }}>
                                            <div className={`perp-wick ${isGreen ? "green" : "red"}`} style={{ height: `${wickH}%` }} />
                                            <div className={`perp-candle-bar ${isGreen ? "green" : "red"}`} style={{ height: `${h}%` }} />
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Price scale */}
                            <div className="perp-price-scale">
                                {[2, 1, 0, -1, -2].map((offset) => (
                                    <span key={offset}>${(market.markPrice + offset * 0.8).toFixed(2)}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Order Entry */}
                    <div className="perp-order-panel">
                        {/* Margin Mode Toggle */}
                        <div className="perp-margin-toggle">
                            <button className={`perp-margin-btn ${marginMode === "cross" ? "active" : ""}`} onClick={() => setMarginMode("cross")}>Cross</button>
                            <button className={`perp-margin-btn ${marginMode === "isolated" ? "active" : ""}`} onClick={() => setMarginMode("isolated")}>Isolated</button>
                        </div>

                        {/* Side Toggle */}
                        <div className="perp-side-toggle">
                            <button className={`perp-side-btn ${tradeSide === "long" ? "active-long" : ""}`} onClick={() => setTradeSide("long")}>
                                Long
                            </button>
                            <button className={`perp-side-btn ${tradeSide === "short" ? "active-short" : ""}`} onClick={() => setTradeSide("short")}>
                                Short
                            </button>
                        </div>

                        {/* Order Type */}
                        <div className="perp-order-types">
                            {(["market", "limit"] as const).map((t) => (
                                <button key={t} className={`perp-ot-btn ${orderType === t ? "active" : ""}`} onClick={() => setOrderType(t)}>
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </button>
                            ))}
                        </div>

                        {/* Limit Price (if limit order) */}
                        {orderType === "limit" && (
                            <div className="perp-field">
                                <label>Price (USD)</label>
                                <div className="perp-input-row">
                                    <button className="perp-input-btn" onClick={() => setLimitPrice(String(Math.max(0, (parseFloat(limitPrice) || market.markPrice) - 0.1).toFixed(2)))}>−</button>
                                    <input type="number" className="perp-input" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder={market.markPrice.toFixed(2)} />
                                    <button className="perp-input-btn" onClick={() => setLimitPrice(String(((parseFloat(limitPrice) || market.markPrice) + 0.1).toFixed(2)))}>+</button>
                                </div>
                            </div>
                        )}

                        {/* Size */}
                        <div className="perp-field">
                            <label>Size (SOL)</label>
                            <div className="perp-input-row">
                                <input
                                    type="number"
                                    className="perp-input"
                                    value={tradeSize}
                                    onChange={(e) => { setTradeSize(e.target.value); if (tradeState === "error") setTradeState("idle"); }}
                                    placeholder="0.00"
                                />
                                <span className="perp-input-unit">SOL</span>
                            </div>
                            <div className="perp-size-pct">
                                {[10, 25, 50, 75, 100].map((p) => (
                                    <button key={p} className="perp-pct-btn" onClick={() => setTradeSize(String((p * 10 / 100).toFixed(2)))}>
                                        {p}%
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Leverage Slider */}
                        <div className="perp-field">
                            <div className="perp-lev-header">
                                <label>Leverage</label>
                                <span className="perp-lev-val">{leverage}x</span>
                            </div>
                            <input
                                type="range"
                                className="perp-slider"
                                min={1}
                                max={20}
                                step={1}
                                value={leverage}
                                onChange={(e) => setLeverage(parseInt(e.target.value))}
                            />
                            <div className="perp-lev-marks">
                                {[1, 5, 10, 15, 20].map((v) => (
                                    <button key={v} className={`perp-lev-mark ${leverage === v ? "active" : ""}`} onClick={() => setLeverage(v)}>{v}x</button>
                                ))}
                            </div>
                        </div>

                        {/* Order Info */}
                        <div className="perp-order-info">
                            <div className="perp-info-row">
                                <span>Notional Value</span>
                                <span>${notional.toFixed(2)}</span>
                            </div>
                            <div className="perp-info-row">
                                <span>Margin Required</span>
                                <span>${marginRequired.toFixed(2)}</span>
                            </div>
                            <div className="perp-info-row">
                                <span>Est. Liq. Price</span>
                                <span className="red">${liquidationPrice.toFixed(2)}</span>
                            </div>
                            <div className="perp-info-row">
                                <span>Trading Fee</span>
                                <span>{RISK_PARAMS.tradingFeeBps / 100}%</span>
                            </div>
                            <div className="perp-info-row sakura-fee">
                                <span>🌸 Sakura Fee</span>
                                <span>{TRADING_FEE_SAKURA} $SAKURA</span>
                            </div>
                        </div>

                        {/* Execute */}
                        {!connected ? (
                            <button className="perp-execute-btn connect-btn" onClick={() => setVisible(true)}>
                                Connect Wallet
                            </button>
                        ) : tradeState === "paying_fee" || tradeState === "executing" ? (
                            <button className={`perp-execute-btn ${tradeSide}-btn`} disabled>
                                <span className="perp-spinner" />
                                {tradeState === "paying_fee" ? "Paying Fee..." : "Executing..."}
                            </button>
                        ) : tradeState === "success" ? (
                            <button className="perp-execute-btn success-btn" disabled>
                                ✓ Order Filled
                            </button>
                        ) : (
                            <>
                                {tradeState === "error" && <div className="perp-error">{tradeError}</div>}
                                <button
                                    className={`perp-execute-btn ${tradeSide}-btn`}
                                    onClick={handleTrade}
                                    disabled={sizeNum <= 0}
                                >
                                    {tradeSide === "long" ? "Buy / Long" : "Sell / Short"}
                                </button>
                            </>
                        )}
                    </div>

                    {/* Recent Trades */}
                    <div className="perp-recent-trades">
                        <div className="perp-panel-header">
                            <span>Recent Trades</span>
                        </div>
                        <div className="perp-rt-header">
                            <span>Price</span>
                            <span>Size</span>
                            <span>Time</span>
                        </div>
                        <div className="perp-rt-list">
                            {recentTrades.map((t, i) => (
                                <div key={i} className="perp-rt-row">
                                    <span className={t.side === "buy" ? "green" : "red"}>{t.price.toFixed(2)}</span>
                                    <span>{t.size.toFixed(2)}</span>
                                    <span className="perp-rt-time">{t.time}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ===== Bottom: Positions / Orders / History ===== */}
                <div className="perp-bottom">
                    <div className="perp-bottom-tabs">
                        <button className={`perp-bt-tab ${activeTab === "positions" ? "active" : ""}`} onClick={() => setActiveTab("positions")}>
                            Positions ({positions.length})
                        </button>
                        <button className={`perp-bt-tab ${activeTab === "orders" ? "active" : ""}`} onClick={() => setActiveTab("orders")}>
                            Open Orders (0)
                        </button>
                        <button className={`perp-bt-tab ${activeTab === "trades" ? "active" : ""}`} onClick={() => setActiveTab("trades")}>
                            Trade History
                        </button>
                    </div>

                    {activeTab === "positions" && (
                        positions.length === 0 ? (
                            <div className="perp-empty">No open positions</div>
                        ) : (
                            <div className="perp-positions-table">
                                <div className="perp-pt-header">
                                    <span>Symbol</span>
                                    <span>Size</span>
                                    <span>Entry Price</span>
                                    <span>Mark Price</span>
                                    <span>PnL (ROE%)</span>
                                    <span>Margin</span>
                                    <span>Liq. Price</span>
                                    <span>Actions</span>
                                </div>
                                {positions.map((pos, i) => (
                                    <div key={i} className="perp-pt-row">
                                        <div className="perp-pt-symbol">
                                            <span className={`perp-pt-side ${pos.side}`}>{pos.side.toUpperCase()}</span>
                                            SOL-PERP
                                        </div>
                                        <span>{pos.size.toFixed(2)} SOL</span>
                                        <span>${pos.entryPrice.toFixed(2)}</span>
                                        <span>${pos.markPrice.toFixed(2)}</span>
                                        <span className={pos.pnl >= 0 ? "green" : "red"}>
                                            {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}
                                            <small> ({pos.pnlPercent >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(2)}%)</small>
                                        </span>
                                        <span>${pos.margin.toFixed(2)} ({pos.leverage}x)</span>
                                        <span className="red">${pos.liquidationPrice.toFixed(2)}</span>
                                        <div className="perp-pt-actions">
                                            <button className="perp-close-btn" onClick={() => setPositions((prev) => prev.filter((_, idx) => idx !== i))}>
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Total PnL Footer */}
                                <div className="perp-pt-footer">
                                    <span>Total Unrealized PnL:</span>
                                    <span className={positions.reduce((s, p) => s + p.pnl, 0) >= 0 ? "green" : "red"}>
                                        {positions.reduce((s, p) => s + p.pnl, 0) >= 0 ? "+" : ""}
                                        ${positions.reduce((s, p) => s + p.pnl, 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        )
                    )}

                    {activeTab === "orders" && <div className="perp-empty">No open orders</div>}
                    {activeTab === "trades" && <div className="perp-empty">No trade history</div>}
                </div>

                {/* Powered by */}
                <div className="perp-powered">
                    <span className="perp-powered-dot" />
                    Powered by Percolator Protocol on Solana · {TRADING_FEE_SAKURA} $SAKURA per trade
                </div>
            </main>
        </>
    );
}
