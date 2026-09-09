"use client";

import React, { useState } from "react";
import { useGameStore } from "@/features/game-stores/useGameStore";
import { STAMINA_CONSTANTS } from "@/features/game/stamina";
import { AvatarMenuPanel } from "@/features/game-components/hud/components/AvatarMenu";
import { MarketplaceModal } from "@/features/game-components/marketplace/MarketplaceModal";
import { useTutorialStore } from "@/features/game-stores/useTutorialStore";
import { OuterPanel, InnerPanel } from "@/components/ui/Panel";
import Decimal from "decimal.js-light";

const button      = "/assets/ui/button/round_button.png";
const settingsImg = "/assets/icons/hamburger_menu.png";
const tokenIcon   = "/assets/icons/luckyfrog_token.png";
const lightning   = "/assets/icons/lightning.png";

export const PlayerHud: React.FC<{ wallet?: string }> = () => {
  const state      = useGameStore((s) => s.state);
  const reset      = useGameStore((s) => s.reset);
  const username   = state.username ?? "Hero";
  const maxStamina = STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA;
  const stamina    = Math.max(0, Math.min(maxStamina, state.stamina ?? maxStamina));
  const staminaPct = (stamina / maxStamina) * 100;
  const coins      = Number(state.coins ?? 0);

  const [settingsOpen, setSettingsOpen]       = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [coinsHovered, setCoinsHovered]       = useState(false);
  const { openTutorial } = useTutorialStore();

  const staminaColor =
    staminaPct > 60 ? "#4ade80" :
    staminaPct > 30 ? "#facc15" :
    "#ef4444";

  // Display coins: full number on hover, compact (3dp) otherwise.
  const coinsDecimal = new Decimal(state.coins ?? 0);
  const coinsDisplay = coinsHovered
    ? coinsDecimal.toString()
    : coinsDecimal.toDecimalPlaces(3, Decimal.ROUND_DOWN).toString();

  return (
    <>
      {/* ── Top-left: settings button + coins ── */}
      <div className="fixed top-2 left-0 z-50 flex flex-col items-start ml-1 sm:ml-2 gap-1 pointer-events-none select-none">

        {/* Settings button */}
        <div
          className="w-10 h-10 sm:w-16 sm:h-16 relative flex justify-center items-center shadow rounded-full cursor-pointer pointer-events-auto"
          onClick={() => setSettingsOpen(true)}
        >
          <img
            src={button}
            className="absolute w-full h-full -z-10"
            alt="settingsButton"
          />
          <img
            src={settingsImg}
            className="w-5 sm:w-8 mb-0.5 sm:mb-1"
            alt="settings"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {/* Coins — OuterPanel + InnerPanel pixel border design */}
        <OuterPanel
          className="pointer-events-auto cursor-default"
          style={{ padding: 0 }}
          onMouseEnter={() => setCoinsHovered(true)}
          onMouseLeave={() => setCoinsHovered(false)}
        >
          <InnerPanel className="flex items-center gap-1.5 px-2 py-0.5" style={{ padding: "2px 8px" }}>
            <img
              src={tokenIcon}
              alt="LFRG"
              className="w-4 h-4 shrink-0"
              style={{ imageRendering: "pixelated" }}
            />
            <span className="font-pixel text-[10px] text-yellow-300 leading-none tabular-nums">
              {coinsDisplay}
            </span>
          </InnerPanel>
        </OuterPanel>
      </div>

      {/* ── Bottom-center: stamina bar — OuterPanel + InnerPanel ── */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none">
        <OuterPanel style={{ padding: 0 }} title={`Stamina: ${stamina}/${maxStamina}`}>
          <InnerPanel className="flex items-center gap-1.5 px-2 py-0.5" style={{ padding: "2px 8px" }}>
            <img
              src={lightning}
              alt=""
              className="w-3.5 h-3.5 shrink-0"
              style={{ imageRendering: "pixelated" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            {/* Bar track */}
            <div className="relative w-32 sm:w-44 h-2.5 bg-black/60 rounded-full overflow-hidden border border-black/50">
              <div
                className="absolute inset-0 rounded-full transition-all duration-500"
                style={{ width: `${staminaPct}%`, backgroundColor: staminaColor }}
              />
            </div>
            <span className="font-pixel text-[9px] text-white leading-none tabular-nums">
              {stamina}/{maxStamina}
            </span>
          </InnerPanel>
        </OuterPanel>
      </div>

      {settingsOpen && (
        <AvatarMenuPanel
          show={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          name={username}
          onMarketplace={() => { setMarketplaceOpen(true); setSettingsOpen(false); }}
          onHowToPlay={() => { openTutorial(); setSettingsOpen(false); }}
          onLogout={() => {
            if (confirm("Are you sure you want to logout?")) {
              reset();
              setSettingsOpen(false);
            }
          }}
        />
      )}

      <MarketplaceModal
        show={marketplaceOpen}
        onHide={() => setMarketplaceOpen(false)}
      />
    </>
  );
};
