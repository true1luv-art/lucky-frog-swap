"use client";

import { useEffect, useState } from "react";
import { detectMobile } from "@/hooks/useIsMobile";

/**
 * LandscapeGate
 *
 * On mobile devices only, detects portrait orientation and renders a
 * full-screen overlay asking the player to rotate their device.
 * In landscape the overlay is invisible and children render normally.
 */
export function LandscapeGate({ children }: { children: React.ReactNode }) {
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkAll = () => {
      const mobile = detectMobile();
      setIsMobile(mobile);

      if (!mobile) {
        setIsPortrait(false);
        return;
      }

      // Prefer the Screen Orientation API, fall back to comparing dimensions.
      if (window.screen?.orientation?.type) {
        const type = window.screen.orientation.type;
        setIsPortrait(type === "portrait-primary" || type === "portrait-secondary");
      } else {
        setIsPortrait(window.innerWidth < window.innerHeight);
      }
    };

    checkAll();

    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener("change", checkAll);
    }
    window.addEventListener("resize", checkAll);
    window.addEventListener("orientationchange", checkAll);

    return () => {
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener("change", checkAll);
      }
      window.removeEventListener("resize", checkAll);
      window.removeEventListener("orientationchange", checkAll);
    };
  }, []);

  return (
    <>
      {children}

      {/* Rotate overlay — only shown on mobile in portrait */}
      {isMobile && isPortrait && (
        <div
          style={{ zIndex: 99999 }}
          className="fixed inset-0 flex flex-col items-center justify-center bg-black"
          aria-live="polite"
          role="alert"
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
              fontFamily: "var(--font-body)",
              fontSize: "10px",
              lineHeight: "1.8",
            }}
          >
            Please rotate your<br />device to landscape<br />to play Lucky Frog
          </p>
        </div>
      )}
    </>
  );
}
