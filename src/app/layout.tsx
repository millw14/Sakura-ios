import type { Metadata } from "next";
import dynamic from "next/dynamic";
import "./globals.css";

import SolanaProvider from "@/components/WalletProvider";

export const metadata: Metadata = {
  title: "桜 Sakura — Manga on Solana",
  description: "Read manga, collect chapters, own your library. A Solana-powered manga reading platform with beautiful Japanese aesthetics.",
};

import MobileNavHandler from "@/components/MobileNavHandler";
import BottomNav from "@/components/BottomNav";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* Background */}
        <div className="app-background">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/background.png" alt="" />
        </div>

        {/* Sakura Petals */}
        <div className="sakura-petals">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="petal" />
          ))}
        </div>

        {/* Public Beta Warning Banner */}
        <div style={{
          backgroundColor: 'rgba(255, 105, 180, 0.15)',
          borderBottom: '1px solid rgba(255, 105, 180, 0.3)',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: '500',
          position: 'relative',
          zIndex: 50,
        }}>
          ⚠️ Sakura Public Beta — Expect occasional bugs and data resets. Build {new Date().toISOString().split('T')[0]}
        </div>

        <SolanaProvider>
          <MobileNavHandler />
          {children}
          <BottomNav />
        </SolanaProvider>
      </body>
    </html>
  );
}
