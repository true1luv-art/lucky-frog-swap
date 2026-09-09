"use client";

import { useEffect, useState } from "react";
import { detectMobile } from "@/lib/detectMobile";

/**
 * LandscapeGate — phaserv1
 *
 * Full-screen "rotate your device" overlay whenever a mobile device is in
 * portrait orientation. Uses detectMobile() for accurate device detection and
 * the Screen Orientation API for accurate orientation detection.
 * Disappears automatically on landscape rotation.
 */
export function LandscapeGate() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    function check() {
      const mobile = detectMobile();
      if (!mobile) { setBlocked(false); return; }

      // The actual viewport shape is the authoritative signal for whether the
      // play area is portrait. The Screen Orientation API is unreliable — it
      // can report a stale/incorrect type (e.g. "landscape-primary" while the
      // viewport is clearly taller than it is wide) in emulators and on some
      // real devices — so we treat dimensions as the source of truth and only
      // use the orientation API to confirm a portrait reading.
      const portraitBySize = window.innerHeight > window.innerWidth;
      const type = window.screen?.orientation?.type ?? "";
      const portraitByApi = type === "portrait-primary" || type === "portrait-secondary";

      setBlocked(portraitBySize || portraitByApi);
    }

    check();

    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener("change", check);
    }
    window.addEventListener("resize",            check);
    window.addEventListener("orientationchange", check);
    return () => {
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener("change", check);
      }
      window.removeEventListener("resize",            check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  if (!blocked) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-label="Please rotate your device"
      className="fixed inset-0 flex flex-col items-center justify-center bg-black"
      style={{ zIndex: 99999 }}
    >
      {/* Rotating phone SVG */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        className="w-20 h-20 mb-6 text-white animate-spin-slow"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Phone body */}
        <rect x="20" y="8" width="24" height="40" rx="4" ry="4" />
        <circle cx="32" cy="44" r="1.5" fill="currentColor" />
        {/* Rotation arrow */}
        <path d="M10 32 A22 22 0 0 1 54 32" strokeDasharray="6 4" />
        <polyline points="50,26 54,32 48,34" />
      </svg>

      <p
        className="text-white text-center px-6 leading-relaxed"
        style={{
          fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
          fontSize: "10px",
          lineHeight: "1.8",
        }}
      >
        Please rotate your
        <br />
        device to landscape
        <br />
        to play Lucky Frog Mine
      </p>
    </div>
  );
}
