

/**
 * lib/client/marketplace-purchase.ts
 *
 * Client-side on-chain $LFRG marketplace purchase flow.
 * Uses MetaMask (EIP-6963 / window.ethereum) on Robinhood Chain.
 *
 * Flow:
 *   1. POST /api/marketplace/listings/{id}/lock      → acquire 10-min DB lock
 *   2. POST /api/marketplace/listings/{id}/purchase  → price quote
 *   3. Send ERC-20 transfer to treasury via MetaMask
 *   4. POST /api/marketplace/listings/{id}/confirm   → verify tx + settle
 *
 * On any failure after step 1, DELETE /lock releases the hold immediately
 * so other players aren't blocked for the full 10 minutes.
 */

import {
  sendHfarmToTreasury,
  type Eip1193Provider,
} from "@/lib/client/hfarm-transfer";

// ---------------------------------------------------------------------------
// EIP-6963 provider detection
// ---------------------------------------------------------------------------

async function getConnectedEvmProvider(): Promise<{
  provider: Eip1193Provider;
  address: string;
} | null> {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;

  const candidates: Array<{ provider: Eip1193Provider }> = [];

  if (w.ethereum && typeof (w.ethereum as Eip1193Provider).request === "function") {
    candidates.push({ provider: w.ethereum as Eip1193Provider });
  }

  for (const c of candidates) {
    try {
      const accounts = (await c.provider.request({
        method: "eth_accounts",
      })) as string[];
      if (accounts?.length > 0) {
        return { provider: c.provider, address: accounts[0].toLowerCase() };
      }
    } catch { /* skip */ }
  }

  if (candidates.length > 0) {
    try {
      const accounts = (await candidates[0].provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accounts?.length > 0) {
        return {
          provider: candidates[0].provider,
          address: accounts[0].toLowerCase(),
        };
      }
    } catch { /* user rejected */ }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Lock helpers — fire-and-forget release is safe because the lock auto-expires
// ---------------------------------------------------------------------------

async function acquireLock(listingId: string): Promise<{
  ok: boolean;
  lockedUntil?: string;
  error?: string;
}> {
  const res = await fetch(`/api/marketplace/listings/${listingId}/lock`, {
    method: "POST",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error ?? "Could not reserve listing." };
  return { ok: true, lockedUntil: data.lockedUntil };
}

async function releaseLock(listingId: string): Promise<void> {
  await fetch(`/api/marketplace/listings/${listingId}/lock`, {
    method: "DELETE",
    credentials: "include",
  }).catch(() => {/* non-fatal */});
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface PurchaseListingResult {
  ok: boolean;
  error?: string;
  totalPrice?: number;
  fee?: number;
  sellerNet?: number;
  purchaseQty?: number;
}

// ---------------------------------------------------------------------------
// Main purchase function
// ---------------------------------------------------------------------------

/**
 * Full EVM marketplace purchase flow with optimistic DB lock:
 *   1. Locks the listing (409 if another player holds it).
 *   2. Gets the server-side price quote.
 *   3. Sends an ERC-20 $LFRG transfer to the treasury via MetaMask.
 *   4. Confirms the purchase server-side (releases lock automatically).
 *
 * Releases the lock on any failure so other players aren't blocked.
 */
export async function purchaseListingOnChain(
  listingId: string,
  quantity: number,
): Promise<PurchaseListingResult> {
  if (!listingId) return { ok: false, error: "Missing listing." };

  let lockAcquired = false;

  try {
    // 1. Acquire the DB lock.
    const lock = await acquireLock(listingId);
    if (!lock.ok) return { ok: false, error: lock.error };
    lockAcquired = true;

    // 2. Get the server-side price quote.
    const quoteRes = await fetch(
      `/api/marketplace/listings/${listingId}/purchase`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quantity }),
      },
    );
    const quoteData = await quoteRes.json().catch(() => ({}));
    if (!quoteRes.ok || quoteData.error) {
      await releaseLock(listingId);
      return { ok: false, error: quoteData.error ?? "Failed to get price quote." };
    }

    const { totalPrice, fee, sellerNet, purchaseQty } = quoteData as {
      totalPrice: number;
      fee: number;
      sellerNet: number;
      purchaseQty: number;
    };

    // 3. Get the connected MetaMask provider.
    const conn = await getConnectedEvmProvider();
    if (!conn) {
      await releaseLock(listingId);
      return {
        ok: false,
        error: "MetaMask not connected. Please connect your wallet and try again.",
      };
    }

    // 4. Send ERC-20 transfer to treasury.
    const txHash = await sendHfarmToTreasury(conn.provider, conn.address, totalPrice);

    // 5. Confirm — server verifies payment, settles trade, and releases lock.
    const confRes = await fetch(
      `/api/marketplace/listings/${listingId}/confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ txHash, quantity }),
      },
    );
    const confData = await confRes.json().catch(() => ({}));
    if (!confRes.ok || !confData.success) {
      // Lock already released server-side if confirm accepted; release defensively.
      await releaseLock(listingId);
      return { ok: false, error: confData.error ?? "Failed to confirm purchase." };
    }

    return { ok: true, totalPrice, fee, sellerNet, purchaseQty };
  } catch (err) {
    if (lockAcquired) await releaseLock(listingId);
    const msg = err instanceof Error ? err.message : "Transaction failed.";
    if (/user rejected|denied/i.test(msg)) return { ok: false, error: "Transaction rejected." };
    return { ok: false, error: msg };
  }
}

/**
 * Explicitly releases the lock without completing a purchase.
 * Call this when the player dismisses the buy drawer or cancels.
 */
export async function cancelListingLock(listingId: string): Promise<void> {
  await releaseLock(listingId);
}
