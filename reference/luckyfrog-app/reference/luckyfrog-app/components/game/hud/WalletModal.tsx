"use client";

/**
 * components/game/hud/WalletModal.tsx
 *
 * WalletModal — read-only panel that shows the player's wallet address and
 * on-chain $LFRG balance.  Deposit / withdraw have been removed; the Bank
 * (Mine Shaft) is the sole place to claim $LFRG directly to the wallet.
 *
 * Rebuilt on ModalShell (toast tier) in Phase F of
 * docs/modal-redesign-plan.md — the last `pt-5 relative` SFL header block.
 */

import React from "react";
import { InnerPanel } from "@/components/ui/Panel";
import { ModalShell, ModalTitleBar } from "@/components/ui/modal";

const token = "/assets/icons/token.png";

interface WalletModalProps {
  open?: boolean;
  onClose: () => void;
  wallet?: string;
  lfrgBalance?: number;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  open = true,
  onClose,
  wallet = "",
  lfrgBalance = 0,
}) => {
  const shortWallet = wallet.length > 12
    ? `${wallet.slice(0, 6)}...${wallet.slice(-6)}`
    : wallet || "—";

  return (
    <ModalShell
      show={open}
      onClose={onClose}
      tier="toast"
      titleBar={<ModalTitleBar icon={token} title="Wallet" onClose={onClose} />}
      bodyClassName="w-[min(88vw,336px)] p-0.5"
    >
      <div className="flex flex-col gap-1.5">
        <InnerPanel className="p-3 flex flex-col items-center gap-1">
          <span className="text-xxs text-white/70 text-shadow">WALLET ADDRESS</span>
          <span
            className="text-xs text-white text-shadow break-all text-center"
            title={wallet}
          >
            {shortWallet}
          </span>
        </InnerPanel>

        <InnerPanel className="p-3 flex flex-col items-center gap-2">
          <span className="text-xxs text-white/70 text-shadow">$LFRG BALANCE</span>
          <div className="flex items-center gap-2">
            <img src={token || "/placeholder.svg"} className="w-8 img-highlight" alt="LFRG" />
            <span className="text-lg font-bold text-white text-shadow">
              {lfrgBalance.toLocaleString(undefined, { maximumFractionDigits: 3 })}
            </span>
          </div>
        </InnerPanel>

        <InnerPanel className="p-2">
          <p className="text-xxs text-white/50 text-shadow text-center leading-relaxed">
            To claim $LFRG, visit the Bank &rarr; Mine Shaft.
          </p>
        </InnerPanel>
      </div>
    </ModalShell>
  );
};
