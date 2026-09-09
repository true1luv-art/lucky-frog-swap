

/**
 * PhaserModals — phaserv1
 *
 * Listens for `phaser-{key}-open` / `phaser-{key}-close` custom DOM events
 * dispatched by BuildingZone.ts and FarmScene.ts, then renders the matching
 * modal with the correct game panel inside.
 */

import { useEffect, useState } from "react";

import { BUILDING_KEYS, type BuildingKey } from "@/phaser/positions/buildingPositions";
import { BUILDING_CONFIG }                 from "@/lib/config/buildings";
import { BuildingStatusModal }             from "@/components/ui/BuildingStatusModal";
import { MarketModal }                     from "@/features/game-components/market/MarketModal";
import { KitchenModal }                    from "@/features/game-components/kitchen/KitchenModal";
import { BlacksmithModal }                 from "@/features/game-components/blacksmith/BlacksmithModal";
import { HouseModal }                      from "@/features/game-components/house/HouseModal";
import { BarnModal }                       from "@/features/game-components/animals/BarnModal";
import { MarketplaceModal }               from "@/features/game-components/marketplace/MarketplaceModal";

// ── Game modal keys ──────────────────────────────────────────────────────────

type GameModalKey =
  | "market" | "kitchen" | "blacksmith" | "house";

/** Phaser building type → modal key. Both firepits open the kitchen modal. */
const GAME_MODAL_EVENTS: Record<string, GameModalKey> = {
  market: "market",
  firepit_1: "kitchen",
  firepit_2: "kitchen",
  blacksmith: "blacksmith",
  house: "house",
};

// ── SFX bridge ───────────────────────────────────────────────────────────────

type SfxWindow = Window & {
  __sfx?: {
    marketAudio?:   { play: () => void };
    kitchenAudio?:  { play: () => void };
    homeDoorAudio?: { play: () => void };
  };
};

function playGameSfx(key: GameModalKey) {
  const sfx = (window as SfxWindow).__sfx;
  if (!sfx) return;
  switch (key) {
    case "market":
      sfx.marketAudio?.play();
      break;
    case "kitchen":
      sfx.kitchenAudio?.play();
      break;
    case "house":
      sfx.homeDoorAudio?.play();
      break;
  }
}

// ── Modal state hook ─────────────────────────────────────────────────────────

function useGameModalState() {
  const [activeModal, setActiveModal] = useState<GameModalKey | null>(null);

  useEffect(() => {
    const handlers: [string, EventListener][] = [];

    for (const [buildingType, key] of Object.entries(GAME_MODAL_EVENTS)) {
      const openHandler: EventListener = () => {
        playGameSfx(key);
        setActiveModal(key);
      };
      const closeHandler: EventListener = () =>
        setActiveModal((curr) => (curr === key ? null : curr));

      window.addEventListener(`phaser-${buildingType}-open`,  openHandler);
      window.addEventListener(`phaser-${buildingType}-close`, closeHandler);
      handlers.push(
        [`phaser-${buildingType}-open`,  openHandler],
        [`phaser-${buildingType}-close`, closeHandler],
      );
    }

    return () => {
      handlers.forEach(([evt, fn]) => window.removeEventListener(evt, fn));
    };
  }, []);

  return { activeModal, closeModal: () => setActiveModal(null) };
}

// ── Component ────────────────────────────────────────────────────────────────

interface PhaserModalsProps {
  wallet: string;
}

export function PhaserModals({ wallet }: PhaserModalsProps) {
  const [activeBuildingKey, setActiveBuildingKey] = useState<BuildingKey | null>(null);
  const [barnOpen,          setBarnOpen]          = useState(false);
  const [traderOpen,        setTraderOpen]        = useState(false);
  const [comingSoonArea,    setComingSoonArea]    = useState<string | null>(null);
  const { activeModal, closeModal } = useGameModalState();

  useEffect(() => {
    const listeners = BUILDING_KEYS.flatMap((key) => {
      const open  = () => { setActiveBuildingKey(key); };
      const close = () => { setActiveBuildingKey((curr) => (curr === key ? null : curr)); };

      window.addEventListener(`phaser-${key}-open`,  open);
      window.addEventListener(`phaser-${key}-close`, close);

      return [
        [`phaser-${key}-open`,  open ],
        [`phaser-${key}-close`, close],
      ] as [string, () => void][];
    });

    const openBarn   = () => setBarnOpen(true);
    const closeBarn  = () => setBarnOpen(false);
    window.addEventListener("phaser-barn-open",  openBarn);
    window.addEventListener("phaser-barn-close", closeBarn);

    const openTrader  = () => setTraderOpen(true);
    const closeTrader = () => setTraderOpen(false);
    window.addEventListener("phaser-trader-open",  openTrader);
    window.addEventListener("phaser-trader-close", closeTrader);

    const onComingSoon = (e: Event) => {
      const area = (e as CustomEvent<{ area: string }>).detail?.area ?? "Area";
      setComingSoonArea(area);
    };
    window.addEventListener("phaser-coming-soon", onComingSoon);

    return () => {
      listeners.forEach(([evt, fn]) => window.removeEventListener(evt, fn));
      window.removeEventListener("phaser-barn-open",               openBarn);
      window.removeEventListener("phaser-barn-close",              closeBarn);
      window.removeEventListener("phaser-trader-open",             openTrader);
      window.removeEventListener("phaser-trader-close",            closeTrader);
      window.removeEventListener("phaser-coming-soon",             onComingSoon);
    };
  }, []);

  return (
    <>
      {/* Building modals driven by BUILDING_CONFIG */}
      {BUILDING_KEYS.map((key) => {
        const cfg    = BUILDING_CONFIG[key];
        const isOpen = activeBuildingKey === key;

        if (!cfg?.enabled && cfg?.disabledMode === "hidden") return null;

        if (!cfg?.enabled && cfg?.disabledMode && cfg?.disabledMode !== "hidden") {
          return (
            <BuildingStatusModal
              key={key}
              open={isOpen}
              onClose={() => setActiveBuildingKey(null)}
              mode={cfg.disabledMode as "coming-soon" | "maintenance"}
              buildingName={cfg.displayName}
            />
          );
        }

        return null;
      })}

      {/* Game building modals */}
      <MarketModal
        show={activeModal === "market"}
        onClose={closeModal}
      />
      <KitchenModal
        show={activeModal === "kitchen"}
        onClose={closeModal}
      />
      <BlacksmithModal
        show={activeModal === "blacksmith"}
        onClose={closeModal}
      />
      <HouseModal
        open={activeModal === "house"}
        onClose={closeModal}
        wallet={wallet}
      />

      {/* NPC modals */}
      <BarnModal
        show={barnOpen}
        onClose={() => setBarnOpen(false)}
      />

      {/* Trader NPC — opens the player-to-player Marketplace */}
      <MarketplaceModal
        show={traderOpen}
        onHide={() => setTraderOpen(false)}
      />

      {/* Area coming-soon (boundary_to_graveyard / boundary_to_forest) */}
      <BuildingStatusModal
        open={comingSoonArea !== null}
        onClose={() => setComingSoonArea(null)}
        mode="coming-soon"
        buildingName={comingSoonArea ?? ""}
      />
    </>
  );
}
