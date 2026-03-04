"use client";

import { useMemo, useEffect } from "react";
import {
    ConnectionProvider,
    WalletProvider,
    useWallet,
} from "@solana/wallet-adapter-react";
import "@solana/wallet-adapter-react-ui/styles.css";
import { SakuraWalletModalProvider } from "./SakuraWalletModal";
import { RPC_ENDPOINT } from "@/lib/solana";
import { SakuraNativeWalletAdapter } from "@/lib/wallet-adapter";

// AutoConnects the Sakura Native Wallet silently if public key is stored
function WalletPersistence() {
    const { select, wallets, connected, connecting } = useWallet();

    useEffect(() => {
        if (connected || connecting || wallets.length === 0) return;

        // Force select the native wallet adapter.
        // If the public key is already in preferences, the adapter's connect() method will succeed instantly.
        select(wallets[0].adapter.name);
    }, [wallets, select, connected, connecting]);

    return null;
}

export default function SolanaProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const wallets = useMemo(
        () => [new SakuraNativeWalletAdapter()],
        []
    );

    return (
        <ConnectionProvider endpoint={RPC_ENDPOINT}>
            <WalletProvider wallets={wallets} autoConnect>
                <SakuraWalletModalProvider>
                    <WalletPersistence />
                    {children}
                </SakuraWalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}
