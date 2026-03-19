"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { SOLANA_NETWORK } from "@/lib/solana";

const TRANSAK_ENV = (SOLANA_NETWORK as string) === "mainnet-beta" ? "PRODUCTION" : "STAGING";
const TRANSAK_BASE = TRANSAK_ENV === "PRODUCTION"
    ? "https://global.transak.com"
    : "https://global-stg.transak.com";

const TRANSAK_API_KEY = process.env.NEXT_PUBLIC_TRANSAK_API_KEY || "";

interface BuyWithFiatProps {
    onClose: () => void;
    onPurchaseComplete?: () => void;
}

function buildTransakUrl(walletAddress: string): string {
    const params = new URLSearchParams({
        apiKey: TRANSAK_API_KEY,
        environment: TRANSAK_ENV,
        cryptoCurrencyCode: "SOL",
        network: "solana",
        defaultPaymentMethod: "credit_debit_card",
        themeColor: "ff6b9d",
        hideMenu: "true",
        exchangeScreenTitle: "Buy SOL for Sakura",
    });

    if (walletAddress) {
        params.set("walletAddress", walletAddress);
        params.set("disableWalletAddressForm", "true");
    }

    return `${TRANSAK_BASE}?${params.toString()}`;
}

export default function BuyWithFiat({ onClose, onPurchaseComplete }: BuyWithFiatProps) {
    const { publicKey } = useWallet();
    const [loading, setLoading] = useState(true);
    const [orderComplete, setOrderComplete] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const walletAddress = publicKey?.toBase58() || "";
    const transakUrl = buildTransakUrl(walletAddress);

    const handleMessage = useCallback((event: MessageEvent) => {
        if (!event.data || typeof event.data !== "object") return;
        const { event_id } = event.data;

        if (event_id === "TRANSAK_ORDER_SUCCESSFUL" || event_id === "TRANSAK_ORDER_COMPLETED") {
            setOrderComplete(true);
            onPurchaseComplete?.();
        }

        if (event_id === "TRANSAK_WIDGET_CLOSE") {
            onClose();
        }
    }, [onClose, onPurchaseComplete]);

    useEffect(() => {
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [handleMessage]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    if (!TRANSAK_API_KEY) {
        return (
            <div className="fiat-overlay" onClick={onClose}>
                <div className="fiat-modal" onClick={e => e.stopPropagation()}>
                    <button className="fiat-close" onClick={onClose}>✕</button>
                    <div className="fiat-setup-needed">
                        <div className="fiat-logo-wrapper">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/transaklogo.png" alt="Transak" className="fiat-logo-img" />
                        </div>
                        <h3>Fiat On-Ramp Setup Required</h3>
                        <p>
                            To enable card &amp; bank purchases, add your Transak API key
                            to <code>.env.local</code>:
                        </p>
                        <div className="fiat-code-block">
                            NEXT_PUBLIC_TRANSAK_API_KEY=your_key_here
                        </div>
                        <p className="fiat-setup-hint">
                            Get a free API key at{" "}
                            <a href="https://dashboard.transak.com" target="_blank" rel="noopener noreferrer">
                                dashboard.transak.com
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fiat-overlay" onClick={onClose}>
            <div className="fiat-modal fiat-modal-widget" onClick={e => e.stopPropagation()}>
                <div className="fiat-header">
                    <div className="fiat-header-left">
                        <div className="fiat-header-logo-wrap">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/transaklogo.png" alt="Transak" className="fiat-header-logo" />
                        </div>
                        <div>
                            <h3>Buy SOL with Card</h3>
                            <p>Purchase SOL, then swap to $SAKURA</p>
                        </div>
                    </div>
                    <button className="fiat-close" onClick={onClose}>✕</button>
                </div>

                {loading && (
                    <div className="fiat-loading">
                        <div className="fiat-loading-spinner" />
                        <span>Loading payment provider...</span>
                    </div>
                )}

                <iframe
                    ref={iframeRef}
                    src={transakUrl}
                    className="fiat-iframe"
                    allow="camera;microphone;payment"
                    onLoad={() => setLoading(false)}
                    style={{ opacity: loading ? 0 : 1 }}
                />

                {orderComplete && (
                    <div className="fiat-success-banner">
                        <span>✓ Purchase complete! SOL will arrive in your wallet shortly.</span>
                        <button onClick={onClose}>Swap to $SAKURA →</button>
                    </div>
                )}

                <div className="fiat-footer">
                    <span className="fiat-footer-secure">🔒 Secured by Transak</span>
                    <span className="fiat-footer-methods">Visa · Mastercard · Apple Pay · Bank Transfer</span>
                </div>
            </div>
        </div>
    );
}
