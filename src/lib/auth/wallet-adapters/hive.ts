

// Hive Keychain browser extension adapter.
// Hive accounts are username-based (not address-based).
// Sign-in uses keychain.requestSignBuffer() which signs an arbitrary message
// with the account's Posting key. The server verifies via the Hive API.

export interface HiveKeychainApi {
  requestHandshake: () => void;
  requestSignBuffer: (
    username: string,
    message: string,
    keyType: 'Posting' | 'Active' | 'Memo',
    callback: (response: HiveKeychainResponse) => void,
    rpc?: string,
    title?: string,
  ) => void;
}

export interface HiveKeychainResponse {
  success:    boolean;
  error?:     string;
  result?:    string;  // base64-encoded signature
  publicKey?: string;
  data?: {
    username?: string;
    message?:  string;
  };
}

declare global {
  interface Window {
    hive_keychain?: HiveKeychainApi;
  }
}

export interface HiveConnectResult {
  wallet:    string; // Hive account username (lowercase)
  signature: string; // base64 signature from Keychain
  message:   string;
  publicKey: string;
}

export function isHiveKeychainAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.hive_keychain;
}

function buildHiveSignInMessage(username: string, nonce: string): string {
  return [
    'Robinhood Farm — Hive Sign In',
    `Account: ${username}`,
    `Nonce: ${nonce}`,
    `Issued: ${new Date().toISOString()}`,
    'Signing proves account ownership. No tokens are transferred.',
  ].join('\n');
}

/**
 * Prompts Hive Keychain to sign an auth message for the given username.
 * Resolves with HiveConnectResult or rejects on error / user cancel.
 */
export function signInWithHiveKeychain(username: string): Promise<HiveConnectResult> {
  return new Promise((resolve, reject) => {
    if (!username.trim()) {
      reject(new Error('Please enter your Hive username.'));
      return;
    }

    if (!isHiveKeychainAvailable()) {
      reject(
        new Error(
          'Hive Keychain extension not found. Install it from hive-keychain.com.',
        ),
      );
      return;
    }

    const nonce   = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const message = buildHiveSignInMessage(username.trim(), nonce);

    window.hive_keychain!.requestSignBuffer(
      username.trim(),
      message,
      'Posting',
      (response) => {
        if (!response.success) {
          reject(new Error(response.error ?? 'Keychain signing was cancelled or failed.'));
          return;
        }
        if (!response.result) {
          reject(new Error('Keychain did not return a signature.'));
          return;
        }
        resolve({
          wallet:    username.trim().toLowerCase(),
          signature: response.result,
          message,
          publicKey: response.publicKey ?? '',
        });
      },
    );
  });
}
