/**
 * server/farm-smart-contract/lib/rpc.ts
 *
 * EVM provider + treasury signer + ERC-20 token contract accessors built on ethers v6.
 *
 * SERVER-ONLY — reads the treasury private key from config. Never import this
 * from a 'use client' file.
 */

import { JsonRpcProvider, Wallet, Contract } from "ethers";
import { config } from "@/lib/config/config";

const rh = config.blockchain.evm;

/** Minimal ERC-20 ABI — only what the payout bridge needs. */
export const ERC20_ABI = [
  "function transfer(address to, uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
] as const;

// ---------------------------------------------------------------------------
// Provider — read-only RPC. Safe to create eagerly (no key needed).
// staticNetwork avoids an extra eth_chainId round-trip on every call.
// ---------------------------------------------------------------------------

let _provider: JsonRpcProvider | null = null;

export function getProvider(): JsonRpcProvider {
  if (!_provider) {
    _provider = new JsonRpcProvider(rh.rpcUrl, rh.chainId, {
      staticNetwork: true,
    });
  }
  return _provider;
}

// ---------------------------------------------------------------------------
// Treasury signer — lazy so the private key is only required at call time.
// ---------------------------------------------------------------------------

function normalisePk(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("TREASURY_PRIVATE_KEY env var is not set");
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

let _wallet: Wallet | null = null;

export function getTreasuryWallet(): Wallet {
  if (!_wallet) {
    _wallet = new Wallet(normalisePk(rh.treasuryPrivateKey), getProvider());
  }
  return _wallet;
}

/**
 * Resets all cached singletons so the next call creates a fresh connection.
 * Call inside catch blocks in transfers.ts to recover after an RPC error.
 */
export function resetProvider(): void {
  _provider = null;
  _wallet   = null;
  _decimals = null;
}

/** Write-capable token contract bound to the treasury signer. */
export function getTokenContract(): Contract {
  if (!rh.tokenAddress) {
    throw new Error("HFARM_TOKEN_ADDRESS (or CONTRACT_ADDRESS) env var is not set");
  }
  return new Contract(rh.tokenAddress, ERC20_ABI, getTreasuryWallet());
}

// ---------------------------------------------------------------------------
// Token decimals — fetched once from the contract and cached.
// Invalidated by resetProvider() so a fresh provider always fetches anew.
// ---------------------------------------------------------------------------

let _decimals: number | null = null;

/**
 * Returns the on-chain decimals for the HFARM token.
 * Fetches from the contract on first call; subsequent calls return the cached
 * value. Falls back to the config value (default 18) if the contract call fails.
 */
export async function getTokenDecimals(): Promise<number> {
  if (_decimals !== null) return _decimals;
  try {
    const token = new Contract(rh.tokenAddress, ERC20_ABI, getProvider());
    _decimals = Number(await token.decimals());
  } catch {
    _decimals = rh.decimals;
  }
  return _decimals;
}
