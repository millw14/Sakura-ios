"use client";

import Header from "@/components/Header";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect } from "react";
import { payForWeeklyPass } from "@/lib/payment";
import { mintWeeklyPass } from "@/lib/cnft";
import { checkPassStatus, formatPassTimeRemaining, type PassStatus } from "@/lib/pass-check";
import { WEEKLY_PASS_PRICE } from "@/lib/solana";

type PurchaseState = "idle" | "paying" | "minting" | "success" | "error";

export default function WeeklyPassPage() {
    const { publicKey, signTransaction, connected } = useWallet();
    const { setVisible } = useWalletModal();
    const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const [txSignature, setTxSignature] = useState("");
    const [passStatus, setPassStatus] = useState<PassStatus | null>(null);
    const [checkingPass, setCheckingPass] = useState(false);

    // Check if user already has a valid pass
    useEffect(() => {
        if (publicKey) {
            setCheckingPass(true);
            checkPassStatus(publicKey.toBase58())
                .then(setPassStatus)
                .finally(() => setCheckingPass(false));
        } else {
            setPassStatus(null);
        }
    }, [publicKey]);

    const handlePurchase = async () => {
        if (!publicKey || !signTransaction) {
            setVisible(true);
            return;
        }

        try {
            // Step 1: USDC Payment
            setPurchaseState("paying");
            setErrorMessage("");

            const paymentResult = await payForWeeklyPass(publicKey, signTransaction);
            if (!paymentResult.success) {
                throw new Error(paymentResult.error || "Payment failed");
            }
            setTxSignature(paymentResult.signature || "");

            // Step 2: Mint cNFT Pass
            setPurchaseState("minting");
            const mintResult = await mintWeeklyPass(publicKey.toBase58());
            if (!mintResult.success) {
                throw new Error(mintResult.error || "Minting failed");
            }

            // Success!
            setPurchaseState("success");

            // Refresh pass status
            const newStatus = await checkPassStatus(publicKey.toBase58());
            setPassStatus(newStatus);
        } catch (error: unknown) {
            setPurchaseState("error");
            setErrorMessage(
                error instanceof Error ? error.message : "Something went wrong"
            );
        }
    };

    const renderPurchaseButton = () => {
        if (!connected) {
            return (
                <button
                    className="btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => setVisible(true)}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><circle cx="18" cy="16" r="1" /></svg>
                    ウォレット接続 — Connect Wallet First
                </button>
            );
        }

        if (checkingPass) {
            return (
                <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled>
                    Checking pass status...
                </button>
            );
        }

        if (passStatus?.valid) {
            return (
                <div className="pass-active-badge">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#4ade80" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z" /></svg>
                    <div>
                        <p style={{ fontWeight: 600, color: "#4ade80" }}>パスは有効です — Pass Active</p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {passStatus.expiresAt && formatPassTimeRemaining(passStatus.expiresAt)}
                        </p>
                    </div>
                </div>
            );
        }

        switch (purchaseState) {
            case "paying":
                return (
                    <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled>
                        <span className="spinner" /> 支払い処理中... Sending USDC
                    </button>
                );
            case "minting":
                return (
                    <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled>
                        <span className="spinner" /> NFT発行中... Minting Pass
                    </button>
                );
            case "success":
                return (
                    <div style={{ textAlign: "center" }}>
                        <div className="pass-active-badge">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#4ade80" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z" /></svg>
                            <div>
                                <p style={{ fontWeight: 600, color: "#4ade80" }}>購入完了 — Purchase Complete!</p>
                                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                    Your Weekly Pass NFT has been minted
                                </p>
                            </div>
                        </div>
                        {txSignature && (
                            <a
                                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: "inline-block",
                                    marginTop: 12,
                                    fontSize: 12,
                                    color: "var(--purple-accent)",
                                }}
                            >
                                View Transaction on Explorer →
                            </a>
                        )}
                        <Link
                            href="/manga"
                            className="btn-primary"
                            style={{ width: "100%", justifyContent: "center", marginTop: 16 }}
                        >
                            マンガを読む — Start Reading →
                        </Link>
                    </div>
                );
            case "error":
                return (
                    <div>
                        <div style={{
                            padding: 16,
                            borderRadius: "var(--radius-md)",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            marginBottom: 16,
                            textAlign: "center",
                        }}>
                            <p style={{ color: "#ef4444", fontWeight: 600, marginBottom: 4 }}>
                                エラー — Error
                            </p>
                            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                {errorMessage}
                            </p>
                        </div>
                        <button
                            className="btn-primary"
                            style={{ width: "100%", justifyContent: "center" }}
                            onClick={() => {
                                setPurchaseState("idle");
                                handlePurchase();
                            }}
                        >
                            再試行 — Retry Purchase
                        </button>
                    </div>
                );
            default:
                return (
                    <button
                        className="btn-primary"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={handlePurchase}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
                        パスを購入 — Purchase Weekly Pass
                    </button>
                );
        }
    };

    return (
        <>
            <Header />
            <main className="main-content">
                <section className="weekly-pass">
                    <div className="section-header">
                        <h2 className="section-title">Sakura Premium</h2>
                        <p className="section-subtitle">Support creators & read the latest chapters</p>
                    </div>

                    <div className="pass-card">
                        <h2>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--sakura-pink)" stroke="none" style={{ verticalAlign: 'middle', marginRight: 8 }}><path d="M12 2C9.5 5 7 8 7 11a5 5 0 0 0 10 0c0-3-2.5-6-5-9z" /><path d="M12 2C14.5 5 17 8 17 11" opacity="0.5" /></svg>
                            プレミアムパス
                        </h2>
                        <p className="jp-sub">Premium Monthly Pass</p>

                        <div className="pass-price">
                            <span className="amount">10</span>
                            <span className="currency">USDC</span>
                            <span className="period">/ month</span>
                        </div>

                        <ul className="pass-features">
                            <li>
                                <span className="check">✓</span>
                                Read the <strong>latest 3 chapters</strong> of ongoing series
                            </li>
                            <li>
                                <span className="check">✓</span>
                                Unlimited access to entire backlog (Free)
                            </li>
                            <li>
                                <span className="check">✓</span>
                                Cloud Sync for History & Favorites
                            </li>
                            <li>
                                <span className="check">✓</span>
                                Support the platform & creators
                            </li>
                        </ul>

                        {renderPurchaseButton()}

                        {purchaseState === "idle" && !passStatus?.valid && connected && (
                            <p
                                style={{
                                    fontSize: 11,
                                    color: "var(--text-muted)",
                                    marginTop: 12,
                                }}
                            >
                                Requires USDC balance on Solana Devnet
                            </p>
                        )}
                    </div>

                    {/* How it works */}
                    <div
                        style={{
                            maxWidth: 600,
                            margin: "60px auto 0",
                            textAlign: "left",
                        }}
                    >
                        <h3
                            style={{
                                fontFamily: "var(--font-jp)",
                                fontSize: 20,
                                textAlign: "center",
                                marginBottom: 32,
                            }}
                        >
                            購入フロー — Payment Flow
                        </h3>
                        {[
                            { step: "01", jp: "ウォレット接続", en: "Connect your Solana wallet (Phantom recommended)" },
                            { step: "02", jp: "USDC支払い", en: "Sign 10 USDC transaction for 30 days access" },
                            { step: "03", jp: "NFT発行", en: "Receive your Premium Pass NFT automatically" },
                            { step: "04", jp: "読書開始", en: "Unlock the latest chapters immediately" },
                        ].map((item) => (
                            <div
                                key={item.step}
                                style={{
                                    display: "flex",
                                    gap: 16,
                                    marginBottom: 16,
                                    alignItems: "flex-start",
                                    padding: 16,
                                    borderRadius: "var(--radius-md)",
                                    background: "var(--bg-card)",
                                    border: "1px solid var(--border-subtle)",
                                }}
                            >
                                <span
                                    style={{
                                        fontFamily: "var(--font-jp)",
                                        fontSize: 24,
                                        fontWeight: 700,
                                        color: "var(--sakura-pink)",
                                        minWidth: 40,
                                    }}
                                >
                                    {item.step}
                                </span>
                                <div>
                                    <p
                                        style={{
                                            fontFamily: "var(--font-jp)",
                                            fontSize: 14,
                                            marginBottom: 2,
                                        }}
                                    >
                                        {item.jp}
                                    </p>
                                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                        {item.en}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <footer className="footer">
                    <p className="footer-jp">桜 — マンガの新しい形</p>
                    <p className="footer-text">© 2026 Sakura. Read manga on the blockchain.</p>
                    <div className="footer-solana">
                        <span className="sol-dot" />
                        Built on Solana
                    </div>
                </footer>
            </main>
        </>
    );
}
