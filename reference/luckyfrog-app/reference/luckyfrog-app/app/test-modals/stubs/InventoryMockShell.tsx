"use client";

/**
 * InventoryMockShell
 *
 * Renders InventoryItems (which now owns its own ModalShell) with a mock
 * GameProvider Context (just a no-op shortcutItem) and the
 * MOCK_GAME_STATE.inventory pre-loaded into useGameStore.
 * No real GameProvider or Phaser scene required.
 */

import { useEffect } from "react";

import { Context }          from "@/context/GameContext";
import { InventoryItems }   from "@/components/game/hud/components/InventoryItems";
import { useGameStore }     from "@/lib/stores/game/useGameStore";
import { MOCK_GAME_STATE, MOCK_WALLET }  from "@/app/test-modals/mockup-data";
import type { InventoryItemName } from "@/shared/types/gameplay/game";

interface Props {
  open:    boolean;
  onClose: () => void;
}

const MOCK_CONTEXT = {
  selectedItem: undefined as InventoryItemName | undefined,
  shortcutItem: (_item: InventoryItemName) => {},
};

/** Seeds the game store with mock inventory/animals before rendering. */
function MockInventorySeeder({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // The farm state lives under `s.state` — use zustand's static setState API.
    useGameStore.setState((s) => ({
      state: {
        ...s.state,
        inventory: MOCK_GAME_STATE.inventory as any,
        chickens:  MOCK_GAME_STATE.chickens  as any,
        cows:      MOCK_GAME_STATE.cows      as any,
        sheep:     MOCK_GAME_STATE.sheep     as any,
      },
    }));
  }, []);

  return <>{children}</>;
}

export function InventoryMockShell({ open, onClose }: Props) {
  return (
    <Context.Provider value={MOCK_CONTEXT}>
      <MockInventorySeeder>
        <InventoryItems show={open} onClose={onClose} wallet={MOCK_WALLET} />
      </MockInventorySeeder>
    </Context.Provider>
  );
}
