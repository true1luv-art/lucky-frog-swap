/**
 * MobileAttackButton
 *
 * Bottom-right attack button shown on touch devices. Tapping it fires the
 * player's bow by dispatching the "phaser-attack" window event that
 * InputSystem listens for.
 */

import { useEffect, useState } from "react";
import { detectMobile } from "@/features/utils/detect-mobile";

export function MobileAttackButton() {
  const [isMobile, setIsMobile] = useState(false);
  const [pressed, setPressed]   = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(detectMobile());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!isMobile) return null;

  const shoot = () => {
    setPressed(true);
    window.dispatchEvent(new CustomEvent("phaser-attack"));
    setTimeout(() => setPressed(false), 120);
  };

  return (
    <button
      type="button"
      aria-label="Attack"
      onPointerDown={(e) => { e.preventDefault(); shoot(); }}
      className={`pointer-events-auto fixed bottom-32 right-5 z-40 flex h-16 w-16 select-none items-center justify-center rounded-full border-2 border-black/60 bg-destructive/90 text-[10px] font-bold uppercase tracking-wide text-shadow shadow-lg transition-transform ${
        pressed ? "scale-90" : "scale-100"
      }`}
      style={{ touchAction: "none" }}
    >
      Shoot
    </button>
  );
}
