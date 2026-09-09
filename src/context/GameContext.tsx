

/**
 * GameProvider — mounts farming game context for the phaserv1 route.
 *
 * Responsibilities:
 *  1. Wraps children in the ToastQueueProvider so farm toasts render on top.
 *  2. Mirrors the equipped item onto window for the Phaser scene.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useGameStore } from "@/features/game-stores/useGameStore";
import { ToastQueueProvider, useFarmToast } from "@/context/ToastContext";
import type { InventoryItemName } from "@/features/types/gameplay/game";
import { cacheShortcuts, getShortcuts } from "@/features/game-components/hud/lib/shortcuts";

// ---------------------------------------------------------------------------
// Game context — selectedItem / shortcutItem for keyboard shortcuts
// ---------------------------------------------------------------------------
interface GameContextValue {
  selectedItem: InventoryItemName | undefined;
  shortcutItem: (item: InventoryItemName) => void;
}

export const Context = createContext<GameContextValue>({
  selectedItem: undefined,
  shortcutItem: () => undefined,
});

interface Props {
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// §2.6-D — ActionErrorToast
//
// Watches `lastActionError` from the store. When a server action rejection
// arrives (optimistic rollback path), fires a toast so the player sees
// what went wrong, then clears the error to prevent repeated notifications.
// Must be rendered inside ToastQueueProvider.
// ---------------------------------------------------------------------------
function ActionErrorToast() {
  const lastActionError  = useGameStore((s) => s.lastActionError);
  const clearActionError = useGameStore((s) => s.clearActionError);
  const { addToast }     = useFarmToast();

  useEffect(() => {
    if (!lastActionError) return;
    addToast(lastActionError, "!");
    clearActionError();
  }, [lastActionError, addToast, clearActionError]);

  return null;
}

export function GameProvider({ children }: Props) {
  const [selectedItem, setSelectedItem] = useState<InventoryItemName | undefined>();
  const shortcutItem = useCallback((item: InventoryItemName) => {
    cacheShortcuts(item);
    setSelectedItem(item);
  }, []);

  // Restore the previously-equipped item on mount (client-only, avoids SSR
  // hydration mismatch by reading localStorage after the first render).
  useEffect(() => {
    const first = getShortcuts()[0];
    if (first) setSelectedItem(first);
  }, []);

  // The Phaser scene can't consume React context, so mirror the currently
  // equipped item onto `window.__selectedItem`. FarmScene reads this to decide
  // which seed to plant (and to gate planting when nothing is equipped).
  useEffect(() => {
    (window as unknown as { __selectedItem?: InventoryItemName }).__selectedItem = selectedItem;
    return () => {
      (window as unknown as { __selectedItem?: InventoryItemName }).__selectedItem = undefined;
    };
  }, [selectedItem]);

  return (
    <Context.Provider value={{ selectedItem, shortcutItem }}>
      <ToastQueueProvider>
        {/* §2.6-D — watches lastActionError and fires a toast on rollback */}
        <ActionErrorToast />
        {children}
      </ToastQueueProvider>
    </Context.Provider>
  );
}
