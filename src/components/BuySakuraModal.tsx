"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { SOLANA_NETWORK, SAKURA_DECIMALS, getConnection } from "@/lib/solana";
import { getSakuraSwapQuote, executeSakuraSwap } from "@/lib/swap";
import { useSwapToast } from "@/components/SwapToast";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const TRANSAK_ENV = (SOLANA_NETWORK as string) === "mainnet-beta" ? "PRODUCTION" : "STAGING";
const TRANSAK_BASE = TRANSAK_ENV === "PRODUCTION"
    ? "https://global.transak.com"
    : "https://global-stg.transak.com";
const TRANSAK_API_KEY = process.env.NEXT_PUBLIC_TRANSAK_API_KEY || "";

type Step = "amount" | "processing" | "buying-sol" | "swapping" | "done" | "error";

interface Props {
    onClose: () => void;
    solBalance: number;
    onComplete: () => void;
}

export default function BuySakuraModal({ onClose, solBalance, onComplete }: Props) {
    const { publicKey, signTransaction } = useWallet();
    const swapToast = useSwapToast();

    const [step, setStep] = useState<Step>("amount");
    const [sakuraAmount, setSakuraAmount] = useState("");
    const [solNeeded, setSolNeeded] = useState<number | null>(null);
    const [sakuraEstimate, setSakuraEstimate] = useState<string | null>(null);
    const [quoteLoading, setQuoteLoading] = useState(false);
    const [error, setError] = useState("");
    const [txid, setTxid] = useState("");
    const [sakuraReceived, setSakuraReceived] = useState("");
    const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const hasSol = solBalance > 0.02;
    const walletAddress = publicKey?.toBase58() || "";

    // Debounced quote fetching
    const fetchQuote = useCallback(async (solAmt: number) => {
        if (solAmt <= 0) { setSakuraEstimate(null); return; }
        setQuoteLoading(true);
        try {
            const quote = await getSakuraSwapQuote(solAmt);
            if (quote) {
                const out = Number(quote.outAmount) / (10 ** SAKURA_DECIMALS);
                setSakuraEstimate(out.toLocaleString(undefined, { maximumFractionDigits: 0 }));
            }
        } catch {
            setSakuraEstimate(null);
        } finally {
            setQuoteLoading(false);
        }
    }, []);

    // When user types SOL amount (hasSol mode), fetch quote
    useEffect(() => {
        if (!hasSol || !sakuraAmount) { setSakuraEstimate(null); return; }
        const val = parseFloat(sakuraAmount);
        if (isNaN(val) || val <= 0) { setSakuraEstimate(null); return; }
        if (quoteTimer.current) clearTimeout(quoteTimer.current);
        quoteTimer.current = setTimeout(() => fetchQuote(val), 500);
        return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current); };
    }, [sakuraAmount, hasSol, fetchQuote]);

    const handleMaxClick = () => {
        if (hasSol && solBalance > 0.02) {
            const max = Math.floor((solBalance - 0.02) * 10000) / 10000;
            setSakuraAmount(max.toString());
        }
    };

    // Direct SOL → SAKURA swap
    const handleSwap = async () => {
        if (!publicKey || !signTransaction) return;
        const solAmt = parseFloat(sakuraAmount);
        if (isNaN(solAmt) || solAmt <= 0) { setError("Enter a valid amount"); return; }
        if (solAmt > solBalance - 0.015) { setError("Not enough SOL (need to keep ~0.015 for fees)"); return; }

        setStep("swapping");
        setError("");

        try {
            const quote = await getSakuraSwapQuote(solAmt);
            if (!quote) throw new Error("Could not get swap route");

            swapToast.show({ state: "pending", amountIn: solAmt.toString(), tokenIn: "SOL", tokenOut: "$SAKURA" });

            const result = await executeSakuraSwap(quote, publicKey, signTransaction as any);
            if (!result.success) throw new Error(result.error || "Swap failed");

            const out = (Number(quote.outAmount) / (10 ** SAKURA_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 0 });
            setSakuraReceived(out);
            setTxid(result.txid || "");

            swapToast.update({ state: "success", amountIn: solAmt.toString(), amountOut: out, txid: result.txid });

            setStep("done");
            onComplete();
        } catch (e: any) {
            setError(e.message || "Swap failed");
            swapToast.update({ state: "error", error: e.message });
            setStep("error");
        }
    };

    // Fiat flow: buy SOL via Transak then auto-swap
    const handleBuyWithFiat = () => {
        const usdAmount = parseFloat(sakuraAmount);
        if (isNaN(usdAmount) || usdAmount <= 0) { setError("Enter a valid USD amount"); return; }
        setStep("buying-sol");
        setError("");
    };

    // Listen for Transak completion
    useEffect(() => {
        if (step !== "buying-sol") return;

        const handler = (event: MessageEvent) => {
            if (!event.data || typeof event.data !== "object") return;
            const { event_id } = event.data;

            if (event_id === "TRANSAK_ORDER_SUCCESSFUL" || event_id === "TRANSAK_ORDER_COMPLETED") {
                setStep("processing");
                // Wait for SOL to arrive, then auto-swap
                waitForSolAndSwap();
            }
        };

        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, [step]);

    const waitForSolAndSwap = async () => {
        if (!publicKey || !signTransaction) return;

        // Poll for increased SOL balance
        const conn = getConnection();
        const startBal = await conn.getBalance(publicKey);
        let attempts = 0;

        const poll = setInterval(async () => {
            attempts++;
            try {
                const newBal = await conn.getBalance(publicKey);
                if (newBal > startBal + 0.001 * LAMPORTS_PER_SOL) {
                    clearInterval(poll);
                    const availableSol = (newBal / LAMPORTS_PER_SOL) - 0.02;
                    if (availableSol > 0.001) {
                        setStep("swapping");
                        try {
                            const quote = await getSakuraSwapQuote(Math.floor(availableSol * 10000) / 10000);
                            if (!quote) throw new Error("Could not route swap");

                            const result = await executeSakuraSwap(quote, publicKey, signTransaction as any);
                            if (!result.success) throw new Error(result.error);

                            const out = (Number(quote.outAmount) / (10 ** SAKURA_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 0 });
                            setSakuraReceived(out);
                            setTxid(result.txid || "");
                            setStep("done");
                            onComplete();
                        } catch (e: any) {
                            setError(e.message);
                            setStep("error");
                        }
                    }
                }
            } catch {}
            if (attempts > 120) {
                clearInterval(poll);
                setError("SOL deposit timed out. Check your wallet balance.");
                setStep("error");
            }
        }, 5000);
    };

    const transakUrl = step === "buying-sol" ? buildTransakUrl(walletAddress, sakuraAmount) : "";

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && step === "amount") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose, step]);

    return (
        <div className="buy-sakura-overlay" onClick={() => step === "amount" && onClose()}>
            <div className="buy-sakura-modal" onClick={e => e.stopPropagation()}>

                {step === "amount" && (
                    <>
                        <button className="bsm-close" onClick={onClose}>✕</button>
                        <div className="bsm-header">
                            <div className="bsm-icon">🌸</div>
                            <h2>Buy $SAKURA</h2>
                            <p className="bsm-subtitle">
                                {hasSol ? "Swap your SOL for $SAKURA tokens" : "Purchase $SAKURA with card or bank"}
                            </p>
                        </div>

                        <div className="bsm-input-section">
                            <label className="bsm-label">
                                {hasSol ? "Amount (SOL)" : "Amount (USD)"}
                            </label>
                            <div className="bsm-input-row">
                                <div className="bsm-input-icon">
                                    {hasSol ? "◎" : "$"}
                                </div>
                                <input
                                    type="number"
                                    className="bsm-input"
                                    value={sakuraAmount}
                                    onChange={e => { setSakuraAmount(e.target.value); setError(""); }}
                                    placeholder={hasSol ? "0.00" : "0.00"}
                                    step={hasSol ? "0.05" : "1"}
                                    min="0"
                                    autoFocus
                                />
                                {hasSol && (
                                    <button className="bsm-max-btn" onClick={handleMaxClick}>MAX</button>
                                )}
                            </div>

                            {hasSol && (
                                <div className="bsm-balance-row">
                                    <span>Available: {solBalance.toFixed(4)} SOL</span>
                                    {sakuraEstimate && (
                                        <span className="bsm-estimate">
                                            ≈ {quoteLoading ? "..." : sakuraEstimate} $SAKURA
                                        </span>
                                    )}
                                </div>
                            )}

                            {!hasSol && (
                                <div className="bsm-balance-row">
                                    <span style={{ opacity: 0.7 }}>Powered by Transak · Visa · Mastercard · Apple Pay</span>
                                </div>
                            )}
                        </div>

                        {error && <div className="bsm-error">{error}</div>}

                        <div className="bsm-presets">
                            {hasSol ? (
                                [0.05, 0.1, 0.25, 0.5].map(v => (
                                    <button key={v} className={`bsm-preset ${sakuraAmount === v.toString() ? "active" : ""}`} onClick={() => setSakuraAmount(v.toString())}>
                                        {v} SOL
                                    </button>
                                ))
                            ) : (
                                [10, 25, 50, 100].map(v => (
                                    <button key={v} className={`bsm-preset ${sakuraAmount === v.toString() ? "active" : ""}`} onClick={() => setSakuraAmount(v.toString())}>
                                        ${v}
                                    </button>
                                ))
                            )}
                        </div>

                        <button
                            className="bsm-confirm-btn"
                            onClick={hasSol ? handleSwap : handleBuyWithFiat}
                            disabled={!sakuraAmount || parseFloat(sakuraAmount) <= 0}
                        >
                            {hasSol
                                ? `Swap${sakuraEstimate ? ` for ~${sakuraEstimate} $SAKURA` : ""}`
                                : `Buy $SAKURA`
                            }
                        </button>

                        {hasSol && !TRANSAK_API_KEY ? null : hasSol ? (
                            <button className="bsm-alt-btn" onClick={() => {
                                setSakuraAmount("");
                                // Temporarily act as no-SOL mode
                            }}>
                                Or buy more with card →
                            </button>
                        ) : null}
                    </>
                )}

                {step === "buying-sol" && (
                    <div className="bsm-transak-container">
                        <div className="bsm-transak-header">
                            <span>Purchasing SOL...</span>
                            <button className="bsm-close" onClick={() => setStep("amount")}>✕</button>
                        </div>
                        <iframe
                            ref={iframeRef}
                            src={transakUrl}
                            className="bsm-transak-iframe"
                            allow="camera;microphone;payment"
                        />
                    </div>
                )}

                {step === "processing" && (
                    <div className="bsm-processing">
                        <div className="bsm-spinner" />
                        <h3>Waiting for SOL deposit...</h3>
                        <p>Your SOL is on its way. It will be automatically swapped to $SAKURA once it arrives.</p>
                    </div>
                )}

                {step === "swapping" && (
                    <div className="bsm-processing">
                        <div className="bsm-spinner" />
                        <h3>Swapping to $SAKURA...</h3>
                        <p>Converting SOL to $SAKURA via Jupiter. This takes a few seconds.</p>
                    </div>
                )}

                {step === "done" && (
                    <div className="bsm-done">
                        <div className="bsm-done-icon">✓</div>
                        <h3>Purchase Complete!</h3>
                        <p className="bsm-done-amount">You received <strong>{sakuraReceived} $SAKURA</strong></p>
                        {txid && (
                            <a
                                href={`https://solscan.io/tx/${txid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bsm-tx-link"
                            >
                                View on Solscan →
                            </a>
                        )}
                        <button className="bsm-confirm-btn" onClick={onClose}>Done</button>
                    </div>
                )}

                {step === "error" && (
                    <div className="bsm-done">
                        <div className="bsm-done-icon" style={{ background: "rgba(255,107,107,0.15)", color: "#ff6b6b" }}>✕</div>
                        <h3>Something went wrong</h3>
                        <p className="bsm-done-amount" style={{ color: "#ff6b6b" }}>{error}</p>
                        <button className="bsm-confirm-btn" onClick={() => { setStep("amount"); setError(""); }}>Try Again</button>
                    </div>
                )}
            </div>
        </div>
    );
}

function buildTransakUrl(walletAddress: string, fiatAmount: string): string {
    const params = new URLSearchParams({
        apiKey: TRANSAK_API_KEY,
        environment: TRANSAK_ENV,
        cryptoCurrencyCode: "SOL",
        network: "solana",
        defaultPaymentMethod: "credit_debit_card",
        themeColor: "ff6b9d",
        hideMenu: "true",
        exchangeScreenTitle: "Buy SOL → $SAKURA",
        disableWalletAddressForm: "true",
    });

    if (walletAddress) params.set("walletAddress", walletAddress);
    if (fiatAmount) params.set("defaultFiatAmount", fiatAmount);

    return `${TRANSAK_BASE}?${params.toString()}`;
}
