/**
 * server/farm-smart-contract/lib/transfers.ts
 *
 * High-level on-chain helpers for the HFARM bank bridge.
 *
 * - sendWithdrawalToPlayer  — treasury EOA sends tokens to the player wallet.
 * - verifyDepositFromPlayer — confirms a player-signed transfer landed on-chain.
 *
 * Both functions are pure chain operations and do NOT touch MongoDB.
 * The callers (players/repository.server.ts, deposit/verify route) handle DB mutations.
 *
 * Rewritten on ethers v6 following boom-miner's proven transfer.ts pattern.
 * SERVER-ONLY.
 */

import { parseUnits, formatUnits, Contract } from "ethers";
import { config } from "@/lib/config/config";
import {
  getTreasuryWallet,
  getTokenContract,
  getTokenDecimals,
  getProvider,
  resetProvider,
  ERC20_ABI,
} from "./rpc";
import { buildWithdrawMemo, encodeMemoHex } from "./memo";

const rh = config.blockchain.evm;

// ---------------------------------------------------------------------------
// Withdrawal — treasury → player
// ---------------------------------------------------------------------------

export interface WithdrawalTxResult {
  txHash:      string;
  memoTxHash?: string;
}

/**
 * Sends `amount` whole $HFARM from the treasury wallet to `playerWallet`.
 *
 * Steps:
 *   1. Preflight — check on-chain treasury balance to avoid an on-chain revert.
 *   2. Broadcast the ERC-20 transfer with an explicit gasLimit (avoids
 *      estimation timeouts on a loaded node).
 *   3. Wait for a 1-confirmation receipt and assert status === 1.
 *   4. Best-effort: broadcast a 0-value memo tx to the recipient so the
 *      withdrawal reference is also visible on the block explorer.
 *
 * Throws on any failure (treasury insufficient, revert, RPC error).
 * The caller must NOT mutate MongoDB before this resolves.
 */
export async function sendWithdrawalToPlayer(
  playerWallet: string,
  amount: number,
  ref = "",
): Promise<WithdrawalTxResult> {
  const token    = getTokenContract();
  const treasury = getTreasuryWallet();
  const decimals = await getTokenDecimals();
  const rawAmount = parseUnits(String(amount), decimals);

  // 1. Preflight balance check.
  let treasuryBalance: bigint;
  try {
    treasuryBalance = await token.balanceOf(treasury.address) as bigint;
  } catch (err) {
    resetProvider();
    throw err;
  }

  if (treasuryBalance < rawAmount) {
    throw Object.assign(
      new Error(
        `Treasury balance insufficient: has ${formatUnits(treasuryBalance, decimals)} HFARM, needs ${amount}`,
      ),
      { code: "TREASURY_INSUFFICIENT" },
    );
  }

  // 2. Broadcast the ERC-20 transfer.
  // Explicit gasLimit eliminates the gas-estimation RPC call — prevents a
  // timeout on a loaded node from dead-lettering a valid withdrawal.
  let tx: Awaited<ReturnType<typeof token.transfer>>;
  try {
    tx = await token.transfer(playerWallet, rawAmount, {
      gasLimit: 100_000n, // safe ceiling for an ERC-20 transfer (~65k typical)
    });
  } catch (err) {
    resetProvider();
    throw err;
  }

  // 3. Wait for receipt.
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw Object.assign(
      new Error(`Withdrawal transfer reverted: ${tx.hash}`),
      { code: "TX_REVERTED", txHash: tx.hash },
    );
  }

  const result: WithdrawalTxResult = { txHash: receipt.hash };

  // 4. Optional on-chain memo — best-effort, failure must not undo the payout.
  const memo = ref ? buildWithdrawMemo(ref) : buildWithdrawMemo(receipt.hash);
  try {
    const memoTx = await treasury.sendTransaction({
      to:       playerWallet,
      value:    0n,
      data:     encodeMemoHex(memo),
      gasLimit: 50_000n,
    });
    const memoReceipt = await memoTx.wait(1);
    if (memoReceipt?.hash) result.memoTxHash = memoReceipt.hash;
  } catch {
    // Non-critical — the canonical ref is stored in MongoDB.
  }

  return result;
}

// ---------------------------------------------------------------------------
// Deposit verification — confirm player's transfer landed on-chain
// ---------------------------------------------------------------------------

export interface DepositVerification {
  valid:    boolean;
  reason?: string;
}

/**
 * Verifies that `txHash` is a confirmed ERC-20 Transfer on the HFARM contract:
 *   from  === expectedPlayerWallet  (case-insensitive)
 *   to    === HFARM_TREASURY_ADDRESS
 *   value === expectedAmount (whole HFARM, exact match)
 *
 * Returns { valid: true } on success or { valid: false, reason } on failure.
 * Does NOT touch MongoDB — idempotency + coin crediting is the caller's job.
 */
export async function verifyDepositFromPlayer(
  txHash: string,
  expectedPlayerWallet: string,
  expectedAmount: number,
): Promise<DepositVerification> {
  try {
    const provider = getProvider();
    const receipt  = await provider.getTransactionReceipt(txHash);

    if (!receipt || receipt.status !== 1) {
      return { valid: false, reason: "Transaction not confirmed or reverted" };
    }

    const decimals      = await getTokenDecimals();
    const expectedRaw   = parseUnits(String(expectedAmount), decimals);
    const tokenAddr     = rh.tokenAddress.toLowerCase();
    const treasuryAddr  = rh.treasuryAddress.toLowerCase();
    const playerAddr    = expectedPlayerWallet.toLowerCase();

    // Parse Transfer events from the receipt logs using the ERC-20 ABI.
    const iface = new Contract(rh.tokenAddress, ERC20_ABI, provider).interface;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== tokenAddr) continue;

      let parsed: { name: string; args: [string, string, bigint] } | null = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parsed = iface.parseLog(log) as any;
      } catch {
        continue;
      }

      if (!parsed || parsed.name !== "Transfer") continue;

      const [from, to, value] = parsed.args;
      if (
        from.toLowerCase()  === playerAddr   &&
        to.toLowerCase()    === treasuryAddr &&
        value               === expectedRaw
      ) {
        return { valid: true };
      }
    }

    return {
      valid:  false,
      reason: "No matching Transfer event found for the given sender, recipient, and amount",
    };
  } catch (err) {
    return {
      valid:  false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Token hold balance — §redesign Phase 6 (game access gate)
// ---------------------------------------------------------------------------

/**
 * Reads a wallet's on-chain $HFARM balance as a whole-token number.
 *
 * Returns `null` (NOT 0) on any RPC / config error so callers can distinguish
 * "wallet genuinely holds nothing" from "we could not reach the chain". The gate
 * fails OPEN on `null` — an RPC outage or an unconfigured token contract must
 * never lock the entire player base out of the game.
 */
export async function getWalletTokenBalance(wallet: string): Promise<number | null> {
  if (!rh.tokenAddress || !wallet) return null;
  try {
    const provider = getProvider();
    const token    = new Contract(rh.tokenAddress, ERC20_ABI, provider);
    const decimals = await getTokenDecimals();
    const raw      = (await token.balanceOf(wallet)) as bigint;
    // Floor to whole tokens — thresholds are expressed in whole $HFARM.
    return Math.floor(Number(formatUnits(raw, decimals)));
  } catch (err) {
    resetProvider();
    console.error("[token-hold] balanceOf failed:", err instanceof Error ? err.message : err);
    return null;
  }
}



// ---------------------------------------------------------------------------
// Marketplace settlement — §redesign Phase 5
//
// A marketplace trade settles fully on-chain, mirroring the bank bridge:
//   1. Buyer signs an on-chain HFARM transfer of the FULL price to the
//      treasury (verified with verifyMarketplacePayment — identical shape to a
//      deposit: from=buyer, to=treasury, value=totalPrice).
//   2. The transaction-worker then pays the seller their net (price − fee) from
//      the treasury (sendSellerPayout) and the treasury retains the fee.
//   3. If the trade can no longer be filled (sold out, race, etc.) the buyer's
//      payment is returned on-chain from the treasury (refundBuyer).
//
// All three are thin, intention-revealing wrappers over the already-proven
// deposit/withdrawal primitives so the on-chain semantics stay consistent.
// ---------------------------------------------------------------------------

/**
 * Verifies the buyer's on-chain payment landed in the treasury.
 * from === buyerWallet, to === treasury, value === totalAmount (whole/decimal HFARM).
 */
export async function verifyMarketplacePayment(
  txHash: string,
  buyerWallet: string,
  totalAmount: number,
): Promise<DepositVerification> {
  return verifyDepositFromPlayer(txHash, buyerWallet, totalAmount);
}

/**
 * Pays the seller their net proceeds (price − fee) from the treasury on-chain.
 * Throws on failure so the worker can retry before the listing is claimed.
 */
export async function sendSellerPayout(
  sellerWallet: string,
  netAmount: number,
  ref = "",
): Promise<WithdrawalTxResult> {
  return sendWithdrawalToPlayer(sellerWallet, netAmount, ref || "mp-payout");
}

/**
 * Refunds the buyer their full payment from the treasury on-chain when a queued
 * purchase can no longer be settled (listing sold out / cancelled / race).
 */
export async function refundBuyer(
  buyerWallet: string,
  amount: number,
  ref = "",
): Promise<WithdrawalTxResult> {
  return sendWithdrawalToPlayer(buyerWallet, amount, ref || "mp-refund");
}
