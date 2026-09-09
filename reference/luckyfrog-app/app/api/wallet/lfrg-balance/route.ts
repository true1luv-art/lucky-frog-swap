/**
 * GET /api/wallet/lfrg-balance
 *
 * Returns the caller's on-chain $LFRG ERC-20 token balance on Robinhood Chain.
 * Uses a minimal JSON-RPC eth_call (balanceOf) — no external SDK required.
 *
 * Auth: Bearer <token> OR lfrg_token cookie.
 */

import { NextResponse } from "next/server";
import { getWallet }    from "@/lib/api/get-wallet";

// ERC-20 balanceOf(address) selector
const BALANCE_OF_SELECTOR = "0x70a08231";

/** Zero-pad an EVM address to a 32-byte ABI word. */
function encodeAddress(addr: string): string {
  return addr.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

export async function GET(req: Request) {
  const wallet = await getWallet(req);
  if (!wallet) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokenAddress =
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL ??
    "https://rpc.mainnet.chain.robinhood.com/";

  if (!tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000") {
    // Token not configured — degrade gracefully
    return NextResponse.json({ wallet, balance: 0, configured: false });
  }

  try {
    const callData = BALANCE_OF_SELECTOR + encodeAddress(wallet);

    const rpcRes = await fetch(rpcUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method:  "eth_call",
        params:  [{ to: tokenAddress, data: callData }, "latest"],
        id:      1,
      }),
      // 5-second timeout so slow RPCs don't hang the modal open
      signal: AbortSignal.timeout(5000),
    });

    const rpcData = await rpcRes.json() as {
      result?: string;
      error?:  { message: string };
    };

    if (rpcData.error || !rpcData.result) {
      return NextResponse.json({ wallet, balance: 0, error: rpcData.error?.message });
    }

    // $LFRG uses 18 decimals (standard ERC-20)
    const raw     = BigInt(rpcData.result === "0x" ? "0" : rpcData.result);
    const balance = Number(raw) / 1e18;

    return NextResponse.json({ wallet, balance, configured: true });
  } catch (err) {
    console.error("[lfrg-balance] RPC error:", err);
    return NextResponse.json({ wallet, balance: 0, error: "RPC unavailable" });
  }
}
