"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { truncateAddress } from "@/lib/solana";

export default function Header() {
    const { publicKey, disconnect, connecting } = useWallet();
    const { setVisible } = useWalletModal();

    const handleWalletClick = () => {
        if (publicKey) {
            disconnect();
        } else {
            setVisible(true);
        }
    };

    return (
        <header className="header">
            <Link href="/" className="header-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/sakura.png" alt="Sakura" />
                <div className="header-logo-text">
                    <span className="jp">桜 Sakura</span>
                    <span className="en">Manga × Solana</span>
                </div>
            </Link>

            <nav className="header-nav">
                <Link href="/">
                    Home
                    <span className="jp-label">ホーム</span>
                </Link>
                <Link href="/manga">
                    Browse
                    <span className="jp-label">マンガ</span>
                </Link>
                <Link href="/pass">
                    Weekly Pass
                    <span className="jp-label">週間パス</span>
                </Link>
                <Link href="/favorites">
                    Favorites
                    <span className="jp-label">お気に入り</span>
                </Link>

                {publicKey ? (
                    <button
                        className="wallet-btn wallet-connected"
                        onClick={handleWalletClick}
                    >
                        <span className="icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><circle cx="18" cy="16" r="1" /></svg></span>
                        {truncateAddress(publicKey.toBase58())}
                    </button>
                ) : (
                    <button
                        className="wallet-btn"
                        onClick={handleWalletClick}
                        disabled={connecting}
                    >
                        <span className="icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><circle cx="18" cy="16" r="1" /></svg></span>
                        {connecting ? "接続中..." : "Connect Wallet"}
                    </button>
                )}
            </nav>
        </header>
    );
}
