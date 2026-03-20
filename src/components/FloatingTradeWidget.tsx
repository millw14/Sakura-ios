"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getLocal, STORAGE_KEYS } from "@/lib/storage";

const PNL_SETTING_KEY = "sakura_pnl_tracker";

export default function FloatingTradeWidget() {
    const pathname = usePathname();
    const router = useRouter();

    const isReadingPage = pathname?.startsWith("/chapter") || pathname?.startsWith("/anime/watch");
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        const settings = getLocal<any>(STORAGE_KEYS.SETTINGS, {});
        setEnabled(!!settings.pnlTracker);
    }, [pathname]);

    const isVisible = isReadingPage && enabled;

    const [pnl, setPnl] = useState(0);
    const [flash, setFlash] = useState<"up" | "down" | null>(null);
    const [entryPrice, setEntryPrice] = useState<number | null>(null);
    const LEVERAGE = 10;

    useEffect(() => {
        if (!isVisible) return;
        let isMounted = true;

        const updatePrice = async () => {
            try {
                const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
                if (!res.ok) return;
                const data = await res.json();
                if (!isMounted || !data.solana) return;

                const currentPrice = data.solana.usd;

                setEntryPrice((prevEntry) => {
                    const entry = prevEntry || currentPrice;
                    
                    // Add a tiny micro-jitter so the UI looks active even if CG caches for 30s
                    const jitter = (Math.random() - 0.5) * 0.02;
                    const displayPrice = currentPrice + jitter;
                    
                    const priceDelta = displayPrice - entry;
                    const pnlPercent = (priceDelta / entry) * 100 * LEVERAGE;
                    
                    setPnl((prevPnl) => {
                        if (prevPnl !== pnlPercent) {
                            setFlash(pnlPercent > prevPnl ? "up" : "down");
                            setTimeout(() => setFlash(null), 300);
                        }
                        return pnlPercent;
                    });
                    
                    return entry;
                });
            } catch (err) {
                console.error("Widget price fetch failed", err);
            }
        };

        updatePrice();
        const interval = setInterval(updatePrice, 3500);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [isVisible]);

    if (!isVisible) return null;

    const isProfit = pnl >= 0;

    return (
        <div 
            className={`floating-trade-widget ${isProfit ? "profit" : "loss"} ${flash ? `flash-${flash}` : ""}`}
            onClick={() => router.push("/trade")}
            title="Go to Trading"
        >
            <div className="ftw-icon">◎</div>
            <div className="ftw-pnl">
                {isProfit ? "+" : ""}{pnl.toFixed(2)}%
            </div>
            <div className="ftw-glow" />
        </div>
    );
}
