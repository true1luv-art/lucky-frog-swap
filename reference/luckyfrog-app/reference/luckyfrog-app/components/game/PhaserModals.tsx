"use client";

/**
 * PhaserModals — phaserv1
 *
 * Listens for `phaser-{key}-open` / `phaser-{key}-close` custom DOM events
 * dispatched by BuildingZone.ts and FarmScene.ts, then renders the matching
 * dialog with the correct game panel inside.
 *
 * Lucky Frog buildings and hearthvale buildings are both wired here.
 * SFX is played on hearthvale building-open events via window.__sfx.
 */

import { useEffect, useState } from "react";

import { BUILDING_KEYS, type BuildingKey } from "@/phaser/positions/buildingPositions";
import { BUILDING_CONFIG }               from "@/lib/config/buildings";
import { BuildingStatusModal }           from "@/components/game/shared/BuildingStatusModal";
import { HallOfFameModal }  from "@/components/game/leaderboard/HallOfFameModal";
import { BarnModal }        from "@/components/game/animals/BarnModal";
import { MarketModal }      from "@/components/game/crops/MarketModal";
import { KitchenModal }     from "@/components/game/kitchen/KitchenModal";
import { BlacksmithModal }  from "@/components/game/blacksmith/BlacksmithModal";
import { HouseModal }       from "@/components/game/house/HouseModal";
import { BankModal }        from "@/components/game/bank/BankModal";
import { QuestKeeperModal } from "@/components/game/quests/QuestKeeperModal";

// ── Hearthvale building key types ─────────────────────────────────────────────

type HearthvaleKey =
  | "market" | "blacksmith" | "kitchen"
  | "bank"   | "barn"       | "barnsale"| "house"
  | "workshop"; // legacy alias → blacksmith

const HEARTHVALE_KEYS: HearthvaleKey[] = [
  "market", "blacksmith", "kitchen",
  "bank",   "barn",       "barnsale","house",
  "workshop",
];

type Win = Window & {
  __sfx?: {
    marketAudio?:     { play: () => void };
    blacksmithAudio?: { play: () => void };
    kitchenAudio?:    { play: () => void };
    bankAudio?:       { play: () => void };
    barnAudio?:       { play: () => void };
    homeDoorAudio?:   { play: () => void };
  };
};

function playHearthvaleSfx(key: HearthvaleKey) {
  const sfx = (window as Win).__sfx;
  if (!sfx) return;
  switch (key) {
    case "market":
      sfx.marketAudio?.play();
      break;
    case "blacksmith":
    case "workshop":
      sfx.blacksmithAudio?.play();
      break;
    case "kitchen":
      sfx.kitchenAudio?.play();
      break;
    case "bank":
      sfx.bankAudio?.play();
      break;
    case "barn":
    case "barnsale":
      sfx.barnAudio?.play();
      break;
    case "house":
      sfx.homeDoorAudio?.play();
      break;
  }
}

// ── Hearthvale SFX bridge (plays audio on open) ───────────────────────────────

function useHearthvaleModalState() {
  const [activeHearthvale, setActiveHearthvale] = useState<HearthvaleKey | null>(null);

  useEffect(() => {
    const handlers: [string, EventListener][] = [];

    for (const key of HEARTHVALE_KEYS) {
      const openHandler: EventListener = () => {
        playHearthvaleSfx(key);
        // Normalise barnsale → barn, workshop → blacksmith for modal rendering
        const normalised: HearthvaleKey =
          key === "barnsale" ? "barn" :
          key === "workshop" ? "blacksmith" :
          key;
        setActiveHearthvale(normalised);
      };
      const closeHandler: EventListener = () =>
        setActiveHearthvale((curr) => (curr === key || (key === "barnsale" && curr === "barn") || (key === "workshop" && curr === "blacksmith") ? null : curr));

      window.addEventListener(`phaser-${key}-open`,  openHandler);
      window.addEventListener(`phaser-${key}-close`, closeHandler);
      handlers.push([`phaser-${key}-open`, openHandler], [`phaser-${key}-close`, closeHandler]);
    }

    return () => {
      handlers.forEach(([evt, fn]) => window.removeEventListener(evt, fn));
    };
  }, []);

  return { activeHearthvale, closeHearthvale: () => setActiveHearthvale(null) };
}

// ── Lucky Frog building modals ─────────────────────────────────────────────────

interface PhaserModalsProps {
  wallet: string;
}

export function PhaserModals({ wallet }: PhaserModalsProps) {
  const [activeModal, setActiveModal] = useState<BuildingKey | null>(null);
  // Hall of Fame is menu-only (not a map building), so it has its own state and
  // listens for its own open/close events dispatched from the avatar menu.
  const [hallOfFameOpen, setHallOfFameOpen] = useState(false);
  // Quest Keeper NPC — dispatched by FarmScene via NPC_POSITIONS[npc_questKeeper].event
  const [questKeeperOpen, setQuestKeeperOpen] = useState(false);
  const { activeHearthvale, closeHearthvale } = useHearthvaleModalState();

  useEffect(() => {
    const listeners = BUILDING_KEYS.flatMap((key) => {
      const open  = () => setActiveModal(key);
      const close = () =>
        setActiveModal((curr) => (curr === key ? null : curr));

      window.addEventListener(`phaser-${key}-open`,  open);
      window.addEventListener(`phaser-${key}-close`, close);

      return [
        [`phaser-${key}-open`,  open ],
        [`phaser-${key}-close`, close],
      ] as [string, () => void][];
    });

    const openHallOfFame  = () => setHallOfFameOpen(true);
    const closeHallOfFame = () => setHallOfFameOpen(false);
    window.addEventListener("phaser-halloffame-open",  openHallOfFame);
    window.addEventListener("phaser-halloffame-close", closeHallOfFame);

    const openQuestKeeper  = () => setQuestKeeperOpen(true);
    const closeQuestKeeper = () => setQuestKeeperOpen(false);
    window.addEventListener("phaser-npc-quest-open",  openQuestKeeper);
    window.addEventListener("phaser-npc-quest-close", closeQuestKeeper);

    return () => {
      listeners.forEach(([evt, fn]) => window.removeEventListener(evt, fn));
      window.removeEventListener("phaser-halloffame-open",  openHallOfFame);
      window.removeEventListener("phaser-halloffame-close", closeHallOfFame);
      window.removeEventListener("phaser-npc-quest-open",  openQuestKeeper);
      window.removeEventListener("phaser-npc-quest-close", closeQuestKeeper);
    };
  }, []);

  const close = () => setActiveModal(null);

  return (
    <>
      {/* Lucky Frog building modals — driven by BUILDING_CONFIG */}
      {BUILDING_KEYS.map((key) => {
        const cfg = BUILDING_CONFIG[key];
        const isOpen = activeModal === key;

        // Building disabled and mode is "hidden" — show nothing
        if (!cfg?.enabled && cfg?.disabledMode === "hidden") return null;

        // Building disabled with a visible status mode — show status modal
        if (!cfg?.enabled && cfg?.disabledMode && cfg?.disabledMode !== "hidden") {
          return (
            <BuildingStatusModal
              key={key}
              open={isOpen}
              onClose={close}
              mode={cfg.disabledMode as "coming-soon" | "maintenance"}
              buildingName={cfg.displayName}
            />
          );
        }

        // Building enabled but no dedicated Lucky Frog modal yet — show nothing
        return null;
      })}
      <HallOfFameModal
        open={hallOfFameOpen}
        onClose={() => setHallOfFameOpen(false)}
        wallet={wallet}
      />
      {/* Hearthvale building modals */}
      <BarnModal
        open={activeHearthvale === "barn"}
        onClose={closeHearthvale}
      />
      <MarketModal
        open={activeHearthvale === "market"}
        onClose={closeHearthvale}
      />
      <KitchenModal
        open={activeHearthvale === "kitchen"}
        onClose={closeHearthvale}
      />
      <BlacksmithModal
        open={activeHearthvale === "blacksmith"}
        onClose={closeHearthvale}
      />
      <HouseModal
        open={activeHearthvale === "house"}
        onClose={closeHearthvale}
        wallet={wallet}
      />
      <BankModal
        open={activeHearthvale === "bank"}
        onClose={closeHearthvale}
        wallet={wallet}
      />
      {/* NPC modals */}
      <QuestKeeperModal
        open={questKeeperOpen}
        onClose={() => setQuestKeeperOpen(false)}
      />
    </>
  );
}
