"use client";

import { useState } from "react";
import TipModal from "@/components/TipModal";

export default function TipButton({ receiverAddress }: { receiverAddress: string }) {
    const [isModalOpen, setModalOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setModalOpen(true)}
                className="btn-primary"
                style={{
                    padding: "12px 24px",
                    borderRadius: 16,
                    fontWeight: "bold",
                    boxShadow: "0 4px 16px rgba(138, 43, 226, 0.4)",
                    background: "linear-gradient(90deg, var(--sakura-pink), var(--purple-accent))",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                Tip Creator
            </button>

            {isModalOpen && (
                <TipModal
                    receiverAddress={receiverAddress}
                    onClose={() => setModalOpen(false)}
                    header="Tip Creator"
                    subtitle="Send $SAKURA directly to this creator"
                    onComplete={() => {}}
                />
            )}
        </>
    );
}
