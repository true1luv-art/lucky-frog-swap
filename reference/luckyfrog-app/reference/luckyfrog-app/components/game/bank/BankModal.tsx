"use client";

/**
 * components/game/bank/BankModal.tsx
 *
 * Simplified Bank modal — Phase 2 of docs/game-cleanup-plan.md.
 *
 * Mining, mine shaft, staking, and collection-power are fully removed.
 * The Bank now shows only the connected wallet address and the on-chain
 * $LFRG balance. No tabs, no view state, no SWR mine calls.
 */

import {
  ModalShell,
  ModalTitleBar,
  ActionDock,
  StatChip,
  SectionLabel,
} from "@/components/ui/modal";
import { InnerPanel } from "@/components/ui/Panel";

const bankIcon  = "/assets/buildings/bank.gif";
const tokenIcon = "/assets/icons/token.png";
const playerIcon = "/assets/icons/player.png";

interface BankModalProps {
  open:          boolean;
  onClose:       () => void;
  wallet?:       string;
  lfrgBalance?:  number;
  lfrgUsd?:      number;
}

/**
 * BankModal — wallet address + on-chain $LFRG balance viewer.
 */
export function BankModal({
  open,
  onClose,
  wallet       = "",
  lfrgBalance  = 0,
  lfrgUsd      = 0,
}: BankModalProps) {
  const shortWallet =
    wallet.length > 12
      ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
      : wallet || "—";

  return (
    <ModalShell
      show={open}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          icon={bankIcon}
          title="Bank"
          subtitle="Wallet & balance"
          onClose={onClose}
        />
      }
      actionDock={
        <ActionDock info="Your connected wallet address and on-chain $LFRG balance." />
      }
      bodyClassName="gap-2 p-0.5"
    >
      <SectionLabel icon={playerIcon}>Wallet</SectionLabel>
      <InnerPanel className="p-3 flex flex-col items-center gap-1">
        <span
          className="text-[8px] text-white/60 text-shadow tracking-wide"
          style={{ fontFamily: "var(--font-press-start)" }}
        >
          WALLET ADDRESS
        </span>
        <span
          className="text-[10px] text-yellow-300 text-shadow break-all text-center"
          title={wallet}
          style={{ fontFamily: "var(--font-press-start)" }}
        >
          {shortWallet}
        </span>
      </InnerPanel>

      <SectionLabel icon={tokenIcon}>Balance</SectionLabel>
      <StatChip
        icon={tokenIcon}
        value={lfrgBalance.toLocaleString(undefined, { maximumFractionDigits: 3 })}
        caption={
          lfrgUsd > 0
            ? `On-chain $LFRG · $${(lfrgBalance * lfrgUsd).toFixed(2)}`
            : "On-chain $LFRG"
        }
      />
    </ModalShell>
  );
}
