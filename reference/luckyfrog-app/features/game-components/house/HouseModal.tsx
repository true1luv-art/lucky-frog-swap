"use client";

/**
 * components/game/house/HouseModal.tsx
 *
 * Single-view house modal — player profile, skills, and reputation
 * are all consolidated into one scrollable panel (no NavRail tabs).
 */

import { ModalShell, ModalTitleBar } from "@/components/ui/modal";
import { ProfileClient, type ProfileData } from "@/features/game-components/house/ProfileClient";

const houseIcon = "/assets/buildings/house.png";

interface HouseModalProps {
  open: boolean;
  onClose: () => void;
  wallet: string;
  mockProfileData?: ProfileData;
}

export function HouseModal({ open, onClose, wallet, mockProfileData }: HouseModalProps) {
  return (
    <ModalShell
      show={open}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          icon={houseIcon}
          title="House"
          subtitle="Player profile"
          onClose={onClose}
        />
      }
      bodyClassName="gap-2 p-0.5"
    >
      <ProfileClient wallet={wallet} isOwner={true} mockData={mockProfileData} />
    </ModalShell>
  );
}
