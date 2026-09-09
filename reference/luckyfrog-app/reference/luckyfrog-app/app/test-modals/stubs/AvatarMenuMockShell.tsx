"use client";

/**
 * AvatarMenuMockShell
 *
 * Wraps AvatarMenuPanel (the shell-owning menu panel exported from
 * AvatarMenu.tsx) with the providers it needs (AudioProvider) and seeds
 * useGameStore with MOCK_SKILLS and MOCK_EQUIPMENT before rendering.
 * An optional `initialView` prop navigates directly to a sub-panel.
 *
 * The old ForcedOpenAvatarMenu fork is gone — AvatarMenuPanel accepts
 * show / initialView directly (Phase E of docs/modal-redesign-plan.md).
 */

import { useEffect } from "react";

import { AudioProvider } from "@/context/AudioContext";
import {
  AvatarMenuPanel,
  type AvatarMenuView as PanelView,
} from "@/components/game/hud/components/AvatarMenu";
import { useGameStore } from "@/lib/stores/game/useGameStore";
import { MOCK_SKILLS, MOCK_EQUIPMENT } from "@/app/test-modals/mockup-data";

/** Legacy view ids kept for the /test-modals page buttons. */
export type AvatarMenuView = "main" | "music";

const VIEW_MAP: Record<AvatarMenuView, PanelView> = {
  main:  "overview",
  music: "music",
};

interface Props {
  open:         boolean;
  onClose:      () => void;
  initialView?: AvatarMenuView;
}

/** Seeds the game store with mock skills and equipment, then renders children. */
function MockStoreSeeder({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Zustand exposes a static setState on the store hook for external updates.
    useGameStore.setState((s) => ({
      state: {
        ...s.state,
        skills:    MOCK_SKILLS,
        equipment: MOCK_EQUIPMENT as any,
      },
    }));
  }, []);

  return <>{children}</>;
}

export function AvatarMenuMockShell({ open, onClose, initialView = "main" }: Props) {
  if (!open) return null;

  return (
    <AudioProvider>
      <MockStoreSeeder>
        <AvatarMenuPanel
          show
          onClose={onClose}
          name="MockHero"
          initialView={VIEW_MAP[initialView]}
          onMarketplace={() => {}}
          onHallOfFame={() => {}}
          onLogout={onClose}
        />
      </MockStoreSeeder>
    </AudioProvider>
  );
}
