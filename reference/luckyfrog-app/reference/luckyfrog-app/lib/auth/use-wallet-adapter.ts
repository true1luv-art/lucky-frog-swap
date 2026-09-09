'use client';

import { useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import bs58 from 'bs58';

export const SIGN_MESSAGE =
  'Sign this message to authenticate with Lucky Frog Mine. This does not cost any SOL.';

export type WalletType = 'phantom' | 'solflare' | 'backpack' | 'magiceden' | 'unknown';

export interface ConnectResult {
  wallet: string;
  walletType: WalletType;
  signature: string;
  message: string;
}

/**
 * Custom hook that uses Solana Wallet Adapter for wallet connections.
 * Automatically handles wallet selection, connection, and signing.
 */
export function useWalletAdapter() {
  const { publicKey, connected, signMessage, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();

  /**
   * Detects wallet type from the current connected wallet
   */
  const getWalletType = useCallback((): WalletType => {
    if (!wallet) return 'unknown';
    
    const name = wallet.adapter.name.toLowerCase();
    if (name.includes('phantom')) return 'phantom';
    if (name.includes('solflare')) return 'solflare';
    if (name.includes('backpack')) return 'backpack';
    if (name.includes('magic eden')) return 'magiceden';
    
    return 'unknown';
  }, [wallet]);

  /**
   * Opens wallet selection modal and waits for connection
   */
  const openWalletModal = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  /**
   * Connects wallet and signs a message
   * @throws Error if wallet is not available or signing fails
   */
  const connectAndSign = useCallback(async (): Promise<ConnectResult> => {
    if (!publicKey) {
      // Open wallet modal and throw error
      openWalletModal();
      throw new Error(
        'No wallet connected. Please select a wallet from the modal. Supported: Phantom, Solflare, Backpack, Magic Eden.'
      );
    }

    if (!signMessage) {
      throw new Error(
        'Wallet does not support message signing. Please use Phantom, Solflare, or another compatible wallet.'
      );
    }

    try {
      // Sign the message
      const message = SIGN_MESSAGE;
      const encodedMessage = new TextEncoder().encode(message);
      
      const signature = await signMessage(encodedMessage);
      const signatureBase58 = bs58.encode(signature);
      const walletAddress = publicKey.toBase58();

      return {
        wallet: walletAddress,
        walletType: getWalletType(),
        signature: signatureBase58,
        message: message,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('rejected')) {
          throw new Error('Signature request was rejected. Please try again.');
        }
        throw error;
      }
      throw new Error('Failed to sign message. Please try again.');
    }
  }, [publicKey, signMessage, openWalletModal, getWalletType]);

  return {
    publicKey: publicKey?.toBase58() || '',
    connected,
    walletName: wallet?.adapter.name || 'Unknown',
    walletType: getWalletType(),
    connectAndSign,
    openWalletModal,
    disconnect,
  };
}
