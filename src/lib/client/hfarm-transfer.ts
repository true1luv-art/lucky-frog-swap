

/**
 * lib/client/hfarm-transfer.ts
 *
 * Client-side helpers for sending an on-chain $HFARM ERC-20 transfer to the
 * treasury via an EIP-6963 browser wallet. Shared by the Shrine bank (deposits)
 * and the marketplace (buyer payments). §redesign Phase 5
 *
 * CLIENT-ONLY. Only reads NEXT_PUBLIC_ addresses (recipients — never keys).
 */

// Treasury + token addresses exposed to the client for building ERC-20 transfer
// calldata. Intentionally public (recipient addresses only). Boom-miner's
// generalized names first; legacy NEXT_PUBLIC_HFARM_* accepted as fallbacks.
export const TREASURY_ADDRESS =
  import.meta.env.VITE_TREASURY_ADDRESS ??
  import.meta.env.VITE_HFARM_TREASURY_ADDRESS ??
  "";

export const TOKEN_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ??
  import.meta.env.VITE_HFARM_TOKEN_ADDRESS ??
  "";

const HFARM_DECIMALS = 18;

/** Minimal shape of an EIP-1193 provider request function. */
export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

/** Encodes an ERC-20 transfer(address,uint256) call data. */
export function encodeTransferCalldata(to: string, rawAmount: bigint): string {
  const selector    = "a9059cbb"; // transfer(address,uint256)
  const paddedTo    = to.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  const paddedValue = rawAmount.toString(16).padStart(64, "0");
  return "0x" + selector + paddedTo + paddedValue;
}

/**
 * Converts a (possibly fractional) HFARM amount to raw 18-decimal units.
 * Mirrors ethers `parseUnits(String(amount), 18)` exactly so the raw value
 * matches the server-side verification. Supports up to 18 decimal places.
 */
export function toRawHfarm(amount: number, decimals = HFARM_DECIMALS): bigint {
  const fixed = amount.toFixed(decimals);
  const [whole, frac = ""] = fixed.split(".");
  const fracPadded = frac.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded);
}

/** Shortens a tx hash for display. */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

/**
 * Finds the first connected EIP-6963 wallet provider that has an unlocked
 * account, from the list returned by useEIP6963Wallets().
 */
export async function findConnectedProvider(
  wallets: { provider: Eip1193Provider }[],
): Promise<Eip1193Provider | null> {
  for (const w of wallets) {
    try {
      const accounts = (await w.provider.request({ method: "eth_accounts" })) as string[];
      if (accounts && accounts.length > 0) return w.provider;
    } catch {
      /* skip locked / unavailable providers */
    }
  }
  return null;
}

/**
 * Sends an on-chain HFARM transfer of `amount` from `fromWallet` to the
 * treasury and returns the transaction hash. Throws if addresses are missing
 * or the wallet rejects the transaction.
 */
export async function sendHfarmToTreasury(
  provider: Eip1193Provider,
  fromWallet: string,
  amount: number,
): Promise<string> {
  if (!TOKEN_ADDRESS || !TREASURY_ADDRESS) {
    throw new Error("Token or treasury address not configured. Contact support.");
  }
  const rawAmount = toRawHfarm(amount);
  const data      = encodeTransferCalldata(TREASURY_ADDRESS, rawAmount);
  const hash = (await provider.request({
    method: "eth_sendTransaction",
    params: [{ from: fromWallet, to: TOKEN_ADDRESS, data }],
  })) as string;
  return hash;
}
