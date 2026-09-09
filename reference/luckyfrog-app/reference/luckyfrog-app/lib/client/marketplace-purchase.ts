/**
 * Client-side on-chain marketplace purchase flow. §4.4
 *
 * Buying a listing is a real on-chain $LFRG transfer — the buyer pays the
 * seller their net proceeds directly and the market wallet its fee, with a
 * `buy_item_{hash}` memo binding the payment to the listing. Mirrors the egg /
 * stash burn flow:
 *
 *   1. POST /api/marketplace/listings/{id}/purchase → unsigned transaction
 *   2. Sign it with Phantom
 *   3. POST /api/eggs/broadcast                     → broadcast, get txHash
 *   4. POST /api/marketplace/listings/{id}/confirm  → verify payment + settle
 */

interface PhantomProvider {
  isPhantom?: boolean;
  signTransaction: (tx: unknown) => Promise<{ serialize: () => Uint8Array }>;
}

function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  };
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
  if (w.solana?.isPhantom) return w.solana;
  return null;
}

export interface PurchaseListingResult {
  ok: boolean;
  error?: string;
  totalPrice?: number;
  fee?: number;
  sellerNet?: number;
  purchaseQty?: number;
}

/**
 * Runs the full on-chain purchase flow for a listing. Returns `{ ok: true }`
 * with the settlement amounts on success, or `{ ok: false, error }` with a
 * user-facing message on failure.
 *
 * `quantity` is ignored server-side for unique assets (frog, equipment).
 */
export async function purchaseListingOnChain(
  listingId: string,
  quantity: number,
): Promise<PurchaseListingResult> {
  if (!listingId) return { ok: false, error: "Missing listing." };

  try {
    // 1. Build the unsigned purchase transaction.
    const buildRes = await fetch(`/api/marketplace/listings/${listingId}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ quantity }),
    });
    const buildData = await buildRes.json();
    if (!buildRes.ok || buildData.error || !buildData.transaction) {
      return { ok: false, error: buildData.error ?? "Failed to build transaction" };
    }

    // 2. Sign it with Phantom.
    const provider = getPhantomProvider();
    if (!provider) {
      window.open("https://phantom.app/", "_blank");
      return { ok: false, error: "Phantom wallet not found" };
    }

    const txBytes = Buffer.from(buildData.transaction as string, "base64");
    const { Transaction } = await import("@solana/web3.js");
    const tx = Transaction.from(txBytes);
    const signedTx = await provider.signTransaction(tx);

    // 3. Broadcast via the server-side authenticated RPC.
    const broadRes = await fetch("/api/eggs/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ signedTx: Buffer.from(signedTx.serialize()).toString("base64") }),
    });
    const broadData = await broadRes.json();
    if (!broadRes.ok || broadData.error || !broadData.txHash) {
      return { ok: false, error: broadData.error ?? "Failed to broadcast transaction" };
    }

    // 4. Verify the on-chain payment + settle the trade.
    const confRes = await fetch(`/api/marketplace/listings/${listingId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ txHash: broadData.txHash as string, quantity }),
    });
    const confData = await confRes.json();
    if (!confRes.ok || !confData.success) {
      return { ok: false, error: confData.error ?? "Failed to confirm purchase" };
    }

    return {
      ok: true,
      totalPrice: confData.totalPrice,
      fee: confData.fee,
      sellerNet: confData.sellerNet,
      purchaseQty: confData.purchaseQty,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Transaction failed",
    };
  }
}
