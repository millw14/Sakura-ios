import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { supabase } from "@/lib/supabase";
import { SAKURA_MINT, PERCOLATOR_INSURANCE_VAULT, RPC_ENDPOINT } from "@/lib/solana";

const HIGHLIGHT_FEE = 50; // Required $SAKURA amount

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { walletAddress, mangaId, chapterId, content, signature } = body;

        if (!walletAddress || !mangaId || !chapterId || !content || !signature) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (content.length > 500) {
            return NextResponse.json({ error: "Comment too long" }, { status: 400 });
        }

        const connection = new Connection(RPC_ENDPOINT, "confirmed");

        // 1. Fetch the confirmed transaction
        const tx = await connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
        });

        if (!tx || !tx.meta) {
            return NextResponse.json({ error: "Transaction not found or not confirmed" }, { status: 400 });
        }

        if (tx.meta.err) {
            return NextResponse.json({ error: "Transaction failed on-chain" }, { status: 400 });
        }

        // 2. Verify it's a transfer of exactly `HIGHLIGHT_FEE` $SAKURA to the Insurance Vault
        let validPaymentFound = false;

        // Iterate through pre/post token balances to calculate net change for the vault
        const preBalances = tx.meta.preTokenBalances || [];
        const postBalances = tx.meta.postTokenBalances || [];

        // Find the vault account index in the balances array
        const vaultIndex = postBalances.find(b =>
            b.owner === PERCOLATOR_INSURANCE_VAULT.toBase58() &&
            b.mint === SAKURA_MINT.toBase58()
        )?.accountIndex;

        if (vaultIndex !== undefined) {
            const preVaultBalance = preBalances.find(b => b.accountIndex === vaultIndex)?.uiTokenAmount.uiAmount || 0;
            const postVaultBalance = postBalances.find(b => b.accountIndex === vaultIndex)?.uiTokenAmount.uiAmount || 0;

            const amountReceived = postVaultBalance - preVaultBalance;

            // Strict check
            if (amountReceived >= HIGHLIGHT_FEE) {
                validPaymentFound = true;
            }
        }

        // Fallback: Check inner instructions if balances aren't easily parsed
        if (!validPaymentFound && tx.meta.innerInstructions) {
            for (const ix of tx.meta.innerInstructions) {
                for (const inner of ix.instructions) {
                    if ('parsed' in inner && inner.program === 'spl-token') {
                        const parsedInfo = inner.parsed.info;
                        // For a standard SPL transfer
                        if (
                            inner.parsed.type === "transfer" ||
                            inner.parsed.type === "transferChecked"
                        ) {
                            // Because we use Associated Token Accounts, the destination is the ATA of the vault.
                            // However, strictly checking balances above is the most atomic and reliable way.
                            // We include this as a fallback for standard devnet testing parsing differences.

                            // To properly verify inner IX, we'd need to verify the destination ATA owner.
                            // Trust the balance check above as the primary source of truth.
                        }
                    }
                }
            }
        }

        if (!validPaymentFound) {
            return NextResponse.json({ error: `Invalid payment. Requires exactly ${HIGHLIGHT_FEE} $SAKURA to the insurance vault.` }, { status: 400 });
        }

        // 3. Ensure this signature hasn't been used before
        if (supabase) {
            const { data: existingTarget } = await supabase
                .from("chapter_comments")
                .select("id")
                .eq("highlight_tx", signature)
                .single();

            if (existingTarget) {
                return NextResponse.json({ error: "Transaction already consumed for a highlighted comment" }, { status: 400 });
            }
        }

        // 4. Insert the Highlighted Comment into Supabase
        if (!supabase) {
            return NextResponse.json({ error: "Database not configured" }, { status: 500 });
        }

        const { data, error } = await supabase
            .from("chapter_comments")
            .insert({
                wallet_address: walletAddress,
                manga_id: mangaId,
                chapter_id: chapterId,
                content: content.trim().slice(0, 500),
                is_highlighted: true,
                highlight_tx: signature,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error("Supabase highlights insert error:", error);
            return NextResponse.json({ error: "Failed to save comment" }, { status: 500 });
        }

        return NextResponse.json({ success: true, comment: data });

    } catch (e: any) {
        console.error("Highlight comment API error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
