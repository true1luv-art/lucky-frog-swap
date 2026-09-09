"use client";

/**
 * ToastManager — helper component that bridges game events to farm toasts.
 *
 * Mount this inside <GameProvider> in PhaserV1Canvas. It subscribes to
 * store events and fires the appropriate toast via useFarmToast().
 */
import { useEffect, useRef } from "react";
import Decimal from "decimal.js-light";
import { useGameStore } from "@/lib/stores/game/useGameStore";
import { useFarmToast } from "@/context/ToastContext";
import type { GameState } from "@/shared/types/gameplay";

function summariseDelta(prev: GameState, next: GameState): { message: string; icon?: string } | null {
  // Balance delta — both sides are Decimal instances
  const prevBal = new Decimal(prev.balance);
  const nextBal = new Decimal(next.balance);
  const balDelta = nextBal.sub(prevBal);
  if (balDelta.gt(0)) {
    return { message: `$LFRG +${balDelta.toFixed(2)}`, icon: "🪙" };
  }

  return null;
}

export function ToastManager() {
  const { addToast } = useFarmToast();
  const prevStateRef = useRef<GameState | null>(null);

  useEffect(() => {
    const unsub = useGameStore.subscribe((store) => {
      const prev = prevStateRef.current;
      const next = store.state;
      if (prev) {
        const summary = summariseDelta(prev, next);
        if (summary) {
          addToast(summary.message, summary.icon);
        }
      }
      prevStateRef.current = next;
    });
    return unsub;
  }, [addToast]);

  return null;
}
