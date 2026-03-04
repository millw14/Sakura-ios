"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getConnection } from "@/lib/solana";
import { recordTip } from "@/lib/creator";

export default function TipModal({ receiverAddress, onClose }: { receiverAddress: string, onClose: () => void }) {
    const { publicKey, sendTransaction, connected } = useWallet();
    const [amount, setAmount] = useState<number>(1000); // Default 1000 SAKURA
    const [customAmount, setCustomAmount] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleTip = async () => {
        if (!connected || !publicKey) {
            setError("Please connect your wallet first.");
            return;
        }

        const tipAmount = customAmount ? parseFloat(customAmount) : amount;
        if (!tipAmount || tipAmount <= 0) {
            setError("Please enter a valid amount.");
            return;
        }

        try {
            setError(null);
            setIsLoading(true);

            // Import dynamically to avoid heavy bundles if not needed immediately
            const { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");
            const { SAKURA_MINT, SAKURA_DECIMALS } = await import("@/lib/solana");

            const connection = getConnection();
            const transaction = new Transaction();
            const receiverPubkey = new PublicKey(receiverAddress);

            // Get standard ATAs
            const senderATA = await getAssociatedTokenAddress(SAKURA_MINT, publicKey);
            const receiverATA = await getAssociatedTokenAddress(SAKURA_MINT, receiverPubkey);

            // Check if receiver ATA exists, otherwise add creation instruction
            const receiverAccountData = await connection.getAccountInfo(receiverATA);
            if (!receiverAccountData) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        publicKey,
                        receiverATA,
                        receiverPubkey,
                        SAKURA_MINT
                    )
                );
            }

            // Add SAKURA transfer instruction
            // Use BN or BigInt for decimals calculation to prevent floating point inaccuracies
            const amountWithDecimals = BigInt(Math.round(tipAmount * (10 ** SAKURA_DECIMALS)));

            transaction.add(
                createTransferInstruction(
                    senderATA,
                    receiverATA,
                    publicKey,
                    amountWithDecimals
                )
            );

            // Fetch recent blockhash
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            // Send transaction (this triggers biometric signing in our embedded adapter)
            const signature = await sendTransaction(transaction, connection);

            // Wait for confirmation
            await connection.confirmTransaction(signature, 'processed');

            // Record tip in Database
            await recordTip(signature, publicKey.toBase58(), receiverAddress, tipAmount);

            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (err: any) {
            console.error("Tip Error:", err);
            setError(err?.message || "Transaction failed.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="sakura-wallet-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            <div className="sakura-wallet-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                <div className="swm-petals">
                    <span className="swm-petal" style={{ top: '-6px', left: '20%', animationDelay: '0s' }}>🌸</span>
                </div>

                <button className="swm-close" onClick={onClose}>✕</button>

                {success ? (
                    <div className="swm-connected" style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>💖</div>
                        <h2 className="swm-title">Tip Sent!</h2>
                        <p className="swm-subtitle" style={{ marginTop: '8px' }}>Thank you for supporting this creator!</p>
                    </div>
                ) : (
                    <div className="swm-select" style={{ padding: '10px' }}>
                        <h2 className="swm-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sakura-pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                            Tip Creator
                        </h2>
                        <p className="swm-subtitle">Send $SAKURA directly to their public wallet.</p>

                        {!connected && (
                            <div className="swm-error" style={{ marginTop: '16px' }}>
                                You must sign in to tip creators.
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', margin: '24px 0 16px' }}>
                            {[1000, 5000, 10000].map((val) => (
                                <button
                                    key={val}
                                    onClick={() => { setAmount(val); setCustomAmount(""); }}
                                    style={{
                                        padding: '12px 0',
                                        borderRadius: '12px',
                                        border: amount === val && !customAmount ? '2px solid var(--sakura-pink)' : '2px solid rgba(255,255,255,0.1)',
                                        background: amount === val && !customAmount ? 'rgba(255, 183, 197, 0.2)' : 'rgba(0,0,0,0.2)',
                                        color: '#fff',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        opacity: connected ? 1 : 0.5
                                    }}
                                    disabled={!connected}
                                >
                                    🌸 {val.toLocaleString()}
                                </button>
                            ))}
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <input
                                type="number"
                                placeholder="Custom Amount ($SAKURA)"
                                value={customAmount}
                                onChange={(e) => { setCustomAmount(e.target.value); setAmount(0); }}
                                disabled={!connected}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: customAmount ? '2px solid var(--purple-accent)' : '2px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(0,0,0,0.2)',
                                    color: '#fff',
                                    outline: 'none',
                                    fontSize: '16px',
                                    opacity: connected ? 1 : 0.5
                                }}
                            />
                        </div>

                        {error && (
                            <div className="swm-error" style={{ marginBottom: '16px' }}>
                                {error}
                            </div>
                        )}

                        <button
                            className="btn-primary"
                            style={{
                                width: '100%',
                                padding: '14px',
                                borderRadius: '12px',
                                opacity: !connected || isLoading ? 0.6 : 1,
                                cursor: !connected || isLoading ? 'not-allowed' : 'pointer'
                            }}
                            onClick={handleTip}
                            disabled={!connected || isLoading}
                        >
                            {isLoading ? "Signing Transaction..." : `Send ${customAmount || amount} $SAKURA`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
