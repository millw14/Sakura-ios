"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { truncateAddress, getConnection, SAKURA_MINT, SOLANA_NETWORK } from "@/lib/solana";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { getSakuraSwapQuote, executeSakuraSwap } from "@/lib/swap";
import { generateWallet, storeWalletSecurely, removeWalletSecurely } from "@/lib/wallet";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

/* ─── Context ─── */
interface SakuraWalletModalContextType {
    visible: boolean;
    setVisible: (v: boolean) => void;
}

const SakuraWalletModalContext = createContext<SakuraWalletModalContextType>({
    visible: false,
    setVisible: () => { },
});

export function useSakuraWalletModal() {
    return useContext(SakuraWalletModalContext);
}

/* ─── Provider + Modal ─── */
export function SakuraWalletModalProvider({ children }: { children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);

    return (
        <SakuraWalletModalContext.Provider value={{ visible, setVisible }}>
            {children}
            {visible && <SakuraWalletModal onClose={() => setVisible(false)} />}
        </SakuraWalletModalContext.Provider>
    );
}

/* ─── The Modal ─── */
function SakuraWalletModal({ onClose }: { onClose: () => void }) {
    const { wallets, select, connect, publicKey, disconnect, connected, signTransaction } = useWallet();
    const [balance, setBalance] = useState<number | null>(null);
    const [sakuraBalance, setSakuraBalance] = useState<number | null>(null);

    // Swap State
    const [showSwap, setShowSwap] = useState(false);
    const [swapAmount, setSwapAmount] = useState("0.1"); // Default to 0.1 SOL
    const [isSwapping, setIsSwapping] = useState(false);
    const [swapError, setSwapError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importKey, setImportKey] = useState("");

    const fetchBalances = useCallback(() => {
        if (!publicKey) {
            setBalance(null);
            setSakuraBalance(null);
            return;
        }

        const conn = getConnection();

        // Fetch SOL Balance
        conn.getBalance(publicKey)
            .then(b => setBalance(b / LAMPORTS_PER_SOL))
            .catch(() => setBalance(null));

        // Fetch SAKURA Token Balance
        import("@/lib/solana").then(({ SAKURA_MINT, SAKURA_DECIMALS }) => {
            conn.getParsedTokenAccountsByOwner(publicKey, { mint: SAKURA_MINT })
                .then(accounts => {
                    if (accounts.value.length > 0) {
                        let total = 0;
                        for (const account of accounts.value) {
                            const amountStr = account.account.data.parsed.info.tokenAmount.amount;
                            total += Number(amountStr) / (10 ** SAKURA_DECIMALS);
                        }
                        setSakuraBalance(total);
                    } else {
                        setSakuraBalance(0);
                    }
                })
                .catch(() => setSakuraBalance(null));
        });
    }, [publicKey]);

    // Fetch SOL and SAKURA balances when connected
    useEffect(() => {
        fetchBalances();
    }, [fetchBalances]);

    // Removed buggy auto-close useEffect that was closing the modal unconditionally when already connected

    const handleCreateWallet = async () => {
        try {
            setError(null);
            setIsGenerating(true);

            const newKeypair = generateWallet();
            await storeWalletSecurely(newKeypair);

            // Connect using SakuraNativeWalletAdapter
            if (wallets && wallets.length > 0) {
                const adapterName = wallets[0].adapter.name;
                select(adapterName);
                await connect();
                setTimeout(() => onClose(), 800);
            }
        } catch (err: any) {
            console.error("Wallet generation error:", err);
            setError(err?.message || "Failed to create wallet");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleImportWallet = async () => {
        try {
            setError(null);
            if (!importKey) return;

            let keypair: Keypair;
            try {
                const secretKey = bs58.decode(importKey.trim());
                keypair = Keypair.fromSecretKey(secretKey);
            } catch (e) {
                throw new Error("Invalid Secret Key format (must be Base58)");
            }

            await storeWalletSecurely(keypair);

            if (wallets && wallets.length > 0) {
                const adapterName = wallets[0].adapter.name;
                select(adapterName);
                await connect();
                setTimeout(() => onClose(), 800);
            }
        } catch (err: any) {
            console.error("Wallet import error:", err);
            setError(err?.message || "Failed to import wallet");
        }
    };

    const handleDisconnect = useCallback(async () => {
        try {
            await disconnect();
            await removeWalletSecurely();
            onClose();
        } catch (err) {
            console.error(err);
        }
    }, [disconnect, onClose]);

    const handleSwap = async () => {
        if (!publicKey || !signTransaction || balance === null) return;
        setSwapError(null);
        setIsSwapping(true);

        try {
            const amount = parseFloat(swapAmount);
            if (isNaN(amount) || amount <= 0) {
                throw new Error("Invalid swap amount entered.");
            }

            // Ensure they leave 0.015 SOL for gas and account rent
            if (amount > balance - 0.015) {
                throw new Error("Insufficient SOL balance to swap. Please leave at least 0.015 SOL for network fees.");
            }

            const quote = await getSakuraSwapQuote(amount);
            if (!quote) throw new Error("Could not fetch route");

            const result = await executeSakuraSwap(quote, publicKey, signTransaction as any);

            if (!result.success) {
                throw new Error(result.error);
            }

            setShowSwap(false);
            setSwapAmount("0.1"); // Reset
            // Refresh balances
            fetchBalances();
            alert("Swap successful! Enjoy your $SAKURA 🌸");

        } catch (error: any) {
            console.error(error);
            setSwapError(error.message);
        } finally {
            setIsSwapping(false);
        }
    };

    const handleMaxSwapClick = () => {
        if (balance && balance > 0.015) {
            // max amount minus gas buffer
            const max = balance - 0.015;
            // Floor down to 4 decimals so it looks clean
            setSwapAmount((Math.floor(max * 10000) / 10000).toString());
        } else {
            setSwapAmount("0");
            setSwapError("Not enough SOL to swap safely.");
        }
    };

    const handleCopy = useCallback(() => {
        if (!publicKey) return;
        navigator.clipboard.writeText(publicKey.toBase58());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [publicKey]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    return (
        <div className="sakura-wallet-overlay" onClick={onClose}>
            <div className="sakura-wallet-modal" onClick={e => e.stopPropagation()}>
                <div className="swm-petals">
                    <span className="swm-petal" style={{ top: '-6px', left: '20%', animationDelay: '0s' }}>🌸</span>
                    <span className="swm-petal" style={{ top: '-8px', right: '15%', animationDelay: '0.5s' }}>🌸</span>
                    <span className="swm-petal" style={{ bottom: '-6px', left: '40%', animationDelay: '1s' }}>🌸</span>
                </div>

                <button className="swm-close" onClick={onClose}>✕</button>

                {connected && publicKey ? (
                    <div className="swm-connected">
                        <div className="swm-avatar">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--sakura-pink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                                <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                                <circle cx="18" cy="16" r="1" />
                            </svg>
                        </div>
                        <h2 className="swm-title">接続済み — Connected</h2>
                        <p className="swm-subtitle">Sakura Native Wallet</p>

                        <div className="swm-address-card" onClick={handleCopy}>
                            <span className="swm-address">{truncateAddress(publicKey.toBase58())}</span>
                            <span className="swm-copy-hint">{copied ? "✓ Copied!" : "📋 Tap to copy"}</span>
                        </div>

                        {balance !== null && (
                            <div className="swm-balance">
                                <span className="swm-balance-amount">◎ {balance.toFixed(4)}</span>
                                <span className="swm-balance-label">SOL</span>
                            </div>
                        )}

                        {sakuraBalance !== null && (
                            <div className="swm-balance" style={{ marginTop: '8px', background: 'rgba(255, 105, 180, 0.1)', borderColor: 'rgba(255, 105, 180, 0.3)' }}>
                                <span className="swm-balance-amount" style={{ color: 'var(--sakura-pink)' }}>🌸 {sakuraBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                <span className="swm-balance-label" style={{ color: 'var(--sakura-pink)' }}>$SAKURA</span>
                            </div>
                        )}

                        {/* Swap $SAKURA Interface */}
                        {(SOLANA_NETWORK as string) === 'mainnet-beta' && !showSwap && (
                            <button
                                className="btn-primary"
                                style={{
                                    marginTop: "16px",
                                    width: "100%",
                                    background: "linear-gradient(45deg, var(--sakura-pink), #ff9a9e)",
                                    border: "none"
                                }}
                                onClick={() => setShowSwap(true)}
                            >
                                Swap to $SAKURA 🌸
                            </button>
                        )}

                        {showSwap && (
                            <div className="swm-swap-container" style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255, 105, 180, 0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Swap SOL to $SAKURA (Powered by Jupiter)</span>
                                    <button onClick={() => { setShowSwap(false); setSwapError(null); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="number"
                                        value={swapAmount}
                                        onChange={(e) => setSwapAmount(e.target.value)}
                                        style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--sakura-pink)', color: '#fff', outline: 'none' }}
                                        placeholder="SOL Amount"
                                        step="0.05"
                                        min="0.01"
                                    />
                                    <button
                                        onClick={handleMaxSwapClick}
                                        style={{ background: 'rgba(255, 105, 180, 0.2)', color: 'var(--sakura-pink)', border: '1px solid var(--sakura-pink)', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        MAX
                                    </button>
                                    <span style={{ color: 'var(--sakura-pink)', fontSize: '14px', fontWeight: 'bold' }}>SOL</span>
                                </div>
                                {swapError && <div style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '8px' }}>{swapError}</div>}
                                <button
                                    className="btn-primary"
                                    onClick={handleSwap}
                                    disabled={isSwapping || !swapAmount || parseFloat(swapAmount) <= 0}
                                    style={{
                                        width: '100%',
                                        marginTop: '12px',
                                        background: isSwapping ? 'rgba(255,255,255,0.1)' : 'linear-gradient(45deg, var(--sakura-pink), #ff9a9e)',
                                        border: 'none',
                                    }}
                                >
                                    {isSwapping ? "Swapping..." : "Confirm Swap"}
                                </button>
                            </div>
                        )}

                        <button className="swm-disconnect-btn" onClick={handleDisconnect}>
                            削除して切断 — Delete & Disconnect
                        </button>
                    </div>
                ) : (
                    <div className="swm-select">
                        <div className="swm-header-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--sakura-pink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                                <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                                <circle cx="18" cy="16" r="1" />
                            </svg>
                        </div>
                        <h2 className="swm-title">Sign Up / Login</h2>
                        <p className="swm-subtitle">Create or import a Sakura wallet.</p>

                        {error && (
                            <div className="swm-error">
                                <span>⚠️ {error}</span>
                            </div>
                        )}

                        {isImporting ? (
                            <div className="swm-import-section" style={{ marginTop: '20px' }}>
                                <input
                                    className="swm-import-input"
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255,183,197, 0.3)',
                                        background: 'rgba(0,0,0,0.2)',
                                        color: '#fff',
                                        outline: 'none',
                                        fontFamily: 'monospace'
                                    }}
                                    placeholder="Paste Base58 Secret Key..."
                                    value={importKey}
                                    onChange={(e) => setImportKey(e.target.value)}
                                    autoFocus
                                />
                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                    <button className="swm-wallet-btn" style={{ flex: 1, padding: '10px', justifyContent: 'center' }} onClick={() => setIsImporting(false)}>
                                        Cancel
                                    </button>
                                    <button
                                        className="swm-wallet-btn swm-wallet-btn-hero"
                                        style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
                                        onClick={handleImportWallet}
                                        disabled={!importKey.trim()}
                                    >
                                        Import
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="swm-section" style={{ marginTop: '20px' }}>
                                <button className="swm-wallet-btn swm-wallet-btn-hero" onClick={handleCreateWallet} disabled={isGenerating}>
                                    <span className="swm-wallet-emoji">✨</span>
                                    <div className="swm-wallet-info">
                                        <span className="swm-wallet-name">Create New Wallet</span>
                                        <span className="swm-wallet-tag">Instant Solana wallet</span>
                                    </div>
                                </button>
                                <button className="swm-wallet-btn" onClick={() => setIsImporting(true)}>
                                    <span className="swm-wallet-emoji">🔑</span>
                                    <div className="swm-wallet-info">
                                        <span className="swm-wallet-name">Import Existing</span>
                                        <span className="swm-wallet-tag">Paste a secret key</span>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
