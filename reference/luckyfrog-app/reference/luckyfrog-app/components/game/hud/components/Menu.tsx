import React, { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { OuterPanel } from "@/components/ui/Panel";
const mobileMenu = "/assets/icons/hamburger_menu.png";
const timer = "/assets/icons/timer.png";

export const Menu: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref         = useRef<HTMLDivElement>(null);

  const handleClick = (e: Event) => {
    if (ref?.current?.contains(e.target as Node)) return;
    setMenuOpen(false);
  };

  const autosave = () => {
    // No-op: local state is auto-persisted by Zustand's persist middleware.
    // A future SAVE action can be added to sync with a server here.
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, []);

  return (
    <div ref={ref} className="w-5/12 sm:w-60 fixed top-2 left-2 z-50 shadow-lg">
      <OuterPanel>
        <div className="flex justify-center p-1">
          <Button className="mr-2" onClick={() => setMenuOpen(!menuOpen)}>
            <img
              className="md:hidden w-6"
              src={typeof mobileMenu === "string" ? mobileMenu : (mobileMenu as { src: string })?.src}
              alt="menu"
            />
            <span className="hidden md:flex">Menu</span>
          </Button>
          <Button onClick={autosave}>
            <span>Save</span>
          </Button>
        </div>
        <div className={`transition-all ease duration-200 ${menuOpen ? "max-h-100" : "max-h-0"}`}>
          <ul className={`list-none pt-1 transition-all ease duration-200 origin-top ${menuOpen ? "scale-y-1" : "scale-y-0"}`} />
        </div>
      </OuterPanel>
    </div>
  );
};
