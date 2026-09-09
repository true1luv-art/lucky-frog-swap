

import { useEffect, useState } from "react";

const NAV_LINKS = [
  { label: "About", href: "#story" },
  { label: "Activities", href: "#features" },
  { label: "How to Play", href: "#how-to-play" },
  { label: "Skills", href: "#skills" },
];

export default function StickyNav() {
  const [scrolled, setScrolled] = useState(false);

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
        <a href="#top" className="flex items-center shrink-0">
          <img src="/images/robinhood-farm-logo-nav.png" alt="Robinhood Farm" className="h-10 w-auto" />
        </a>

        {/* Nav links — hidden on mobile */}
        <nav
          className="hidden items-center gap-5 font-pixel text-[9px] uppercase text-foreground lg:flex"
          aria-label="Main navigation"
        >
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-neon">
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right side: CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/"
            className="inline-flex items-center justify-center gap-1.5 border-2 border-neon/60 bg-neon px-4 py-2 font-pixel text-[9px] uppercase tracking-wide text-white text-shadow transition-all duration-150 hover:brightness-110 active:brightness-90"
          >
            Play Now
          </a>
        </div>
      </div>
    </header>
  );
}
