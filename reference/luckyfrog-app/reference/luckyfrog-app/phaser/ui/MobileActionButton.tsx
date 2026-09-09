"use client";

/**
 * MobileActionButton
 *
 * Shown on mobile (viewport <= 900 px wide) in the bottom-right corner.
 * Polls window.__mobileActionHint every 150 ms and dispatches
 * 'phaser-mobile-action' when tapped.
 */

import { useEffect, useRef, useState } from "react";
import { detectMobile } from "@/lib/detectMobile";

interface ActionHint {
  type: "chop" | "mine" | "plant" | "harvest" | "fish" | "feed" | "collect";
  icon: string;
  crop?: string;
  animal?: string;
}

const ACTION_LABEL: Record<ActionHint["type"], string> = {
  chop:    "Chop",
  mine:    "Mine",
  plant:   "Plant",
  harvest: "Harvest",
  fish:    "Fish",
  feed:    "Feed",
  collect: "Collect",
};

export function MobileActionButton() {
  const [isMobile, setIsMobile] = useState(false);
  const [hint, setHint]         = useState<ActionHint | null>(null);
  const [pressed, setPressed]   = useState(false);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const update = () => setIsMobile(detectMobile());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Poll window.__mobileActionHint at 150 ms when on mobile
  useEffect(() => {
    if (!isMobile) { setHint(null); return; }

    const poll = () => {
      const raw = (window as any).__mobileActionHint as ActionHint | null | undefined;
      setHint(raw ?? null);
    };

    poll();
    intervalRef.current = setInterval(poll, 150);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isMobile]);

  if (!isMobile || !hint) return null;

  const handlePress = () => {
    setPressed(true);
    window.dispatchEvent(new CustomEvent("phaser-mobile-action"));
    setTimeout(() => setPressed(false), 180);
  };

  return (
    <button
      aria-label={`${ACTION_LABEL[hint.type]} action`}
      onPointerDown={(e) => { e.preventDefault(); handlePress(); }}
      style={{
        position:       "fixed",
        bottom:         "24px",
        right:          "16px",
        zIndex:         50,
        width:          "56px",
        height:         "56px",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        borderRadius:   "12px",
        border:         "4px solid #5a3e1b",
        background:     "#c8a45a",
        boxShadow:      pressed ? "0 2px 0 #3b2710" : "0 4px 0 #3b2710",
        transform:      pressed ? "translateY(2px)" : "translateY(0)",
        transition:     "transform 100ms, box-shadow 100ms",
        cursor:         "pointer",
        userSelect:     "none",
        touchAction:    "none",
      }}
    >
      <img
        src={hint.icon}
        alt={ACTION_LABEL[hint.type]}
        style={{ width: "32px", height: "32px", objectFit: "contain" }}
        draggable={false}
      />
    </button>
  );
}
