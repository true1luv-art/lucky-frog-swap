"use client";

/**
 * MobileJoystick — phaserv1
 *
 * Fixed-position virtual joystick rendered over the Phaser canvas.
 * Only mounts on touch / mobile-width devices.
 *
 * On every pointer move it writes:
 *   window.__mobileJoystickInput = { active, normalizedX, normalizedY }
 *
 * InputSystem reads this each tick to drive player velocity.
 */

import { useEffect, useRef, useState } from "react";
import { detectMobile } from "@/features/utils/detect-mobile";

const BASE_RADIUS = 52;
const KNOB_RADIUS = 24;
const MAX_DRAG    = BASE_RADIUS - KNOB_RADIUS;

interface JoystickInput {
  active:      boolean;
  normalizedX: number;
  normalizedY: number;
}

function writeJoystick(input: JoystickInput) {
  (window as unknown as Record<string, unknown>).__mobileJoystickInput = input;
}

export function MobileJoystick() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(detectMobile());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const baseRef            = useRef<HTMLDivElement>(null);
  const knobRef            = useRef<HTMLDivElement>(null);
  const activePointerRef   = useRef<number | null>(null);
  const centerRef          = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!isMobile) return;

    writeJoystick({ active: false, normalizedX: 0, normalizedY: 0 });

    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;

    const captureCenter = () => {
      const rect        = base.getBoundingClientRect();
      centerRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };

    const applyMove = (clientX: number, clientY: number) => {
      const { x: cx, y: cy } = centerRef.current;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > MAX_DRAG) { dx = (dx / dist) * MAX_DRAG; dy = (dy / dist) * MAX_DRAG; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      writeJoystick({
        active:      true,
        normalizedX: MAX_DRAG > 0 ? dx / MAX_DRAG : 0,
        normalizedY: MAX_DRAG > 0 ? dy / MAX_DRAG : 0,
      });
    };

    const resetKnob = () => {
      activePointerRef.current = null;
      knob.style.transform     = "translate(-50%, -50%)";
      writeJoystick({ active: false, normalizedX: 0, normalizedY: 0 });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (activePointerRef.current !== null) return;
      activePointerRef.current = e.pointerId;
      base.setPointerCapture(e.pointerId);
      captureCenter();
      applyMove(e.clientX, e.clientY);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointerRef.current) return;
      applyMove(e.clientX, e.clientY);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointerRef.current) return;
      resetKnob();
    };

    base.addEventListener("pointerdown",  onPointerDown);
    base.addEventListener("pointermove",  onPointerMove);
    base.addEventListener("pointerup",    onPointerUp);
    base.addEventListener("pointercancel", onPointerUp);

    return () => {
      base.removeEventListener("pointerdown",  onPointerDown);
      base.removeEventListener("pointermove",  onPointerMove);
      base.removeEventListener("pointerup",    onPointerUp);
      base.removeEventListener("pointercancel", onPointerUp);
      writeJoystick({ active: false, normalizedX: 0, normalizedY: 0 });
    };
  }, [isMobile]);

  if (!isMobile) return null;

  return (
    <div
      ref={baseRef}
      aria-label="Virtual movement joystick"
      role="slider"
      style={{
        position:     "fixed",
        bottom:       `calc(env(safe-area-inset-bottom, 0px) + 28px)`,
        left:         `calc(env(safe-area-inset-left,   0px) + 28px)`,
        width:        BASE_RADIUS * 2,
        height:       BASE_RADIUS * 2,
        borderRadius: "50%",
        background:   "rgba(255,255,255,0.10)",
        border:       "2px solid rgba(255,255,255,0.28)",
        zIndex:       50,
        touchAction:  "none",
        userSelect:   "none",
      }}
    >
      <div
        ref={knobRef}
        aria-hidden="true"
        style={{
          position:     "absolute",
          top:          "50%",
          left:         "50%",
          width:        KNOB_RADIUS * 2,
          height:       KNOB_RADIUS * 2,
          borderRadius: "50%",
          background:   "rgba(255,255,255,0.45)",
          border:       "2px solid rgba(255,255,255,0.65)",
          transform:    "translate(-50%, -50%)",
          pointerEvents:"none",
          willChange:   "transform",
        }}
      />
    </div>
  );
}
