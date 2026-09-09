"use client";

import { useEffect, useState } from "react";

function fmtPrice(n: number) {
  if (n === 0) return "$0.00";
  if (n < 0.000001) return "$" + n.toExponential(2);
  if (n < 0.01) return "$" + n.toFixed(8);
  return "$" + n.toFixed(6);
}

function fmtUsd(n: number) {
  if (n >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "k";
  return "$" + n.toFixed(2);
}

const NAV_LINKS = [
  { label: "Story", href: "#story" },
  { label: "Features", href: "#features" },
  { label: "Buy", href: "#buy" },
  { label: "Frogverse", href: "#frogverse" },
  { label: "Game", href: "#game" },
  { label: "Holders", href: "#leaderboard" },
  { label: "Token", href: "#token" },
];

export default function StickyNav() {
  const [price, setPrice] = useState<number | null>(null);
  const [fdv, setFdv] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch("/api/price");
        const json = await res.json();
        if (!json.error) {
          setPrice(json.price ?? null);
          setFdv(json.fdv ?? null);
        }
      } catch {
        // silently fail — ticker just shows dashes
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-brown-100/95 backdrop-blur-sm border-b-2 border-brown-600 shadow-[0_2px_0_0_var(--color-brown-700)]"
          : "bg-brown-100/90 backdrop-blur-sm border-b-2 border-brown-600"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-8">
        {/* Logo */}
        <a href="#top" className="flex items-center gap-2 shrink-0">
          <span className="font-pixel text-sm text-neon sm:text-base">
            $LFRG
          </span>
          <span className="hidden font-pixel text-[8px] text-brown-600 sm:block uppercase tracking-wider">
            Lucky Frog
          </span>
        </a>

        {/* Nav links — hidden on mobile */}
        <nav
          className="hidden items-center gap-5 font-pixel text-[9px] uppercase text-foreground lg:flex"
          aria-label="Main navigation"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition hover:text-neon"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right side: ticker + CTA */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Price / MC ticker pill */}
          <div className="hidden items-center gap-2 border-2 border-brown-600 bg-brown-200 px-3 py-1.5 sm:flex">
            <span className="font-pixel text-[8px] text-neon uppercase">
              $LFRG
            </span>
            <span className="font-pixel text-[8px] text-foreground">
              {price !== null ? fmtPrice(price) : "—"}
            </span>
            <span className="h-3 w-px bg-brown-600" aria-hidden="true" />
            <span className="font-pixel text-[8px] text-brown-700 uppercase">
              MC
            </span>
            <span className="font-pixel text-[8px] text-foreground">
              {fdv !== null && fdv > 0 ? fmtUsd(fdv) : "—"}
            </span>
          </div>

          {/* Play CTA */}
          <a
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 border-2 border-neon/60 bg-neon px-4 py-2 font-pixel text-[9px] uppercase tracking-wide text-white text-shadow transition-all duration-150 hover:brightness-110 active:brightness-90"
          >
            Play Now
          </a>
        </div>
      </div>
    </header>
  );
}
