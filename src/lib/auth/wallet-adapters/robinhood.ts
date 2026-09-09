

/**
 * lib/auth/wallet-adapters/robinhood.ts
 *
 * Robinhood Chain — EIP-6963 wallet discovery + EIP-191 personal_sign.
 * Chain ID: 4663 (0x1237), EVM-compatible.
 *
 * CLIENT-SAFE — no server imports. Import only in 'use client' components.
 */

export const ROBINHOOD_CHAIN_ID_HEX = '0x1237';
export const ROBINHOOD_CHAIN_ID_DEC = 4663;
export const ROBINHOOD_CHAIN_NAME   = 'Robinhood Chain';
export const ROBINHOOD_RPC_URL      = 'https://rpc.mainnet.chain.robinhood.com/';
export const ROBINHOOD_EXPLORER_URL = 'https://robinhoodchain.blockscout.com';

export const SIGN_MESSAGE =
  'Sign this message to authenticate with Lucky Frog. This is free — no transaction is sent.';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class WrongChainError extends Error {
  readonly isWrongChain = true;
  constructor() {
    super('wrong-chain');
    this.name = 'WrongChainError';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP6963Provider {
  info: EIP6963ProviderInfo;
  provider: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };
}

export interface RobinhoodConnectResult {
  /** Lowercased EVM address */
  wallet:     string;
  walletName: string;
  signature:  string;
  message:    string;
}

// ---------------------------------------------------------------------------
// Chain assertion
// ---------------------------------------------------------------------------

async function assertRobinhoodChain(
  provider: EIP6963Provider['provider'],
): Promise<void> {
  const chainId = (await provider.request({ method: 'eth_chainId' })) as string;
  const normalise = (c: string) => '0x' + parseInt(c, 16).toString(16);
  if (normalise(chainId) !== normalise(ROBINHOOD_CHAIN_ID_HEX)) {
    throw new WrongChainError();
  }
}

// ---------------------------------------------------------------------------
// EIP-6963 wallet discovery (no React state — pure browser events)
// ---------------------------------------------------------------------------

/**
 * Subscribes to EIP-6963 injected wallets via window events.
 * Calls `onChange` whenever a new wallet announces itself.
 * Returns a cleanup function — call it in useEffect cleanup.
 */
export function subscribeToEIP6963Wallets(
  onChange: (wallets: EIP6963Provider[]) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const seen    = new Set<string>();
  let   current: EIP6963Provider[] = [];

  function handleAnnounce(event: Event) {
    const e = event as CustomEvent<EIP6963Provider>;
    if (!e.detail?.info?.rdns) return;
    if (seen.has(e.detail.info.rdns)) return;
    seen.add(e.detail.info.rdns);
    current = [...current, e.detail];
    onChange(current);
  }

  window.addEventListener('eip6963:announceProvider', handleAnnounce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  return () => window.removeEventListener('eip6963:announceProvider', handleAnnounce);
}

// ---------------------------------------------------------------------------
// Connect + sign
// ---------------------------------------------------------------------------

/**
 * Requests accounts from the selected EIP-6963 wallet, asserts Robinhood
 * Chain, and prompts a personal_sign. Returns the wallet address, signature,
 * and the message that was signed so the server can verify ownership.
 */
export async function connectAndSignRobinhood(
  selected: EIP6963Provider,
): Promise<RobinhoodConnectResult> {
  const { provider, info } = selected;

  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts?.length) throw new Error('No accounts returned from wallet.');

  const address = accounts[0];
  const message = SIGN_MESSAGE;

  // Assert Robinhood Chain before signing — throws WrongChainError on mismatch.
  await assertRobinhoodChain(provider);

  // personal_sign expects a hex-encoded message.
  const msgHex    = '0x' + Buffer.from(message, 'utf8').toString('hex');
  const signature = (await provider.request({
    method: 'personal_sign',
    params: [msgHex, address],
  })) as string;

  return {
    wallet:     address.toLowerCase(),
    walletName: info.name,
    signature,
    message,
  };
}
