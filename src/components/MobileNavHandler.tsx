"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { useRouter, usePathname } from "next/navigation";

export default function MobileNavHandler() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const handleBackButton = async () => {
            if (pathname === "/") {
                await App.exitApp();
            } else {
                router.back();
            }
        };

        const listener = App.addListener("backButton", handleBackButton);

        return () => {
            listener.then(l => l.remove());
        };
    }, [router, pathname]);

    return null;
}
