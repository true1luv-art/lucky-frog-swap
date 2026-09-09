"use client";

/**
 * ToastQueueProvider — manages a FIFO queue of farm game toasts.
 *
 * Farm toasts are short (2 s) notifications that show what the player
 * collected (e.g. "+2 Sunflower", "+10 XP") without blocking interaction.
 * Components that want to fire a toast call `useFarmToast()`.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from "react";

export interface FarmToast {
  id: string;
  message: string;
  icon?: string;
  /** Number of times this same message fired while still visible (e.g. "Network error ×5"). */
  count: number;
}

interface ToastContextValue {
  toasts: FarmToast[];
  addToast: (message: string, icon?: string) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => undefined,
  removeToast: () => undefined,
});

let _nextId = 0;
const nextId = () => String(++_nextId);

const TOAST_DURATION_MS = 2_000;

// Hard cap on how many toasts can be visible at once. Prevents a burst of
// repeated errors (e.g. a failing sync loop) from flooding the screen.
const MAX_VISIBLE_TOASTS = 4;

export function ToastQueueProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<FarmToast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message: string, icon?: string) => {
      setToasts((prev) => {
        // Collapse duplicates: if an identical toast is already visible, bump
        // its count and refresh its timer instead of stacking a new one.
        const existing = prev.find((t) => t.message === message && t.icon === icon);
        if (existing) {
          const prevTimer = timers.current.get(existing.id);
          if (prevTimer) clearTimeout(prevTimer);
          timers.current.set(
            existing.id,
            setTimeout(() => removeToast(existing.id), TOAST_DURATION_MS),
          );
          return prev.map((t) =>
            t.id === existing.id ? { ...t, count: t.count + 1 } : t,
          );
        }

        const id = nextId();
        const timer = setTimeout(() => removeToast(id), TOAST_DURATION_MS);
        timers.current.set(id, timer);

        // Enforce the visible cap by evicting the oldest toast(s).
        const next = [...prev, { id, message, icon, count: 1 }];
        while (next.length > MAX_VISIBLE_TOASTS) {
          const dropped = next.shift();
          if (dropped) {
            const t = timers.current.get(dropped.id);
            if (t) clearTimeout(t);
            timers.current.delete(dropped.id);
          }
        }
        return next;
      });
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <FarmToastOverlay />
    </ToastContext.Provider>
  );
}

export function useFarmToast() {
  return useContext(ToastContext);
}

// ---------------------------------------------------------------------------
// Overlay — renders queued toasts in bottom-left corner of the viewport
// ---------------------------------------------------------------------------

function FarmToastOverlay() {
  const { toasts, removeToast } = useContext(ToastContext);
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "5rem",
        left: "1rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "0.375rem",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => removeToast(t.id)}
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            background: "rgba(0,0,0,0.75)",
            color: "#fff",
            padding: "0.3rem 0.65rem",
            borderRadius: "0.375rem",
            fontSize: "0.8rem",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {t.icon && <span>{t.icon}</span>}
          {t.count > 1 ? `${t.message} \u00d7${t.count}` : t.message}
        </button>
      ))}
    </div>
  );
}
