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
import { AvatarMenuPanel } from "@/features/game-components/hud/components/AvatarMenu";
import { useGameStore } from "@/features/game-stores/useGameStore";
import { MOCK_SKILLS } from "@/app/test-modals/mockup-data";

interface Props {
  open:    boolean;
  onClose: () => void;
}

/** Seeds the game store with mock skills and equipment, then renders children. */
function MockStoreSeeder({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Zustand exposes a static setState on the store hook for external updates.
    useGameStore.setState((s) => ({
      state: {
        ...s.state,
        skills: MOCK_SKILLS,
      },
    }));
  }, []);

  return <>{children}</>;
}

export function AvatarMenuMockShell({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <AudioProvider>
      <MockStoreSeeder>
        <AvatarMenuPanel
          show
          onClose={onClose}
          name="MockHero"
          onMarketplace={() => {}}
          onLogout={onClose}
        />
      </MockStoreSeeder>
    </AudioProvider>
  );
}
