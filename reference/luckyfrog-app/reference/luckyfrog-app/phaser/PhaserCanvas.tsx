"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAudio }  from "@/context/AudioContext";
import { usePlayer } from "@/context/PlayerContext";

import { GameProvider }         from "@/context/GameContext";
import { ToastQueueProvider }   from "@/context/ToastContext";
import { ToastManager }         from "@/components/game/toast/ToastManager";
import { Hud }                  from "@/components/game/hud/Hud";
import { PhaserModals }         from "@/components/game/PhaserModals";
import { MobileJoystick }       from "@/phaser/ui/MobileJoystick";
import { MobileActionButton }   from "@/phaser/ui/MobileActionButton";
import { hydratGameSettings, useGameSettings } from "@/lib/stores/game/useGameSettings";

import { InnerPanel }           from "@/components/ui/Panel";
import { TimeLeftPanel }        from "@/components/ui/TimeLeftPanel";
import { LIFECYCLE }            from "@/components/game/crops/lib/plant";
import { CROPS, type CropName } from "@/shared/types/gameplay/crops";
import { getTimeLeft, secondsToMidString } from "@/lib/utils/time";
import { getImageSrc }          from "@/lib/utils/getImageSrc";
import { TREE_RECOVERY_SECONDS } from "@/lib/events/chop/chop";
import { useGameStore }         from "@/lib/stores/game/useGameStore";
import { screenTracker }        from "@/lib/utils/screen";
import type { FishName }        from "@/shared/types/gameplay/fish";
import {
  marketAudio,
  blacksmithAudio,
  kitchenAudio,
  homeDoorAudio,
  barnAudio,
  bankAudio,
  plantAudio,
  harvestAudio,
  chopAudio,
  treeFallAudio,
  miningAudio,
  miningFallAudio,
} from "@/lib/utils/sfx";

// ── Window augmentation ────────────────────────────────────────────────────────
type Win = Window & {
  __playerLFRG?:     number;
  __playerSOL?:      number;
  __playerUsername?: string;

  __musicEnabled?:   boolean;
  __toggleMusic?:    () => void;
  __gameStore?:      unknown;
  __sfx?: {
    plantAudio:      typeof plantAudio;
    harvestAudio:    typeof harvestAudio;
    chopAudio:       typeof chopAudio;
    treeFallAudio:   typeof treeFallAudio;
    miningAudio:     typeof miningAudio;
    miningFallAudio: typeof miningFallAudio;
    marketAudio:     typeof marketAudio;
    blacksmithAudio: typeof blacksmithAudio;
    kitchenAudio:    typeof kitchenAudio;
    bankAudio:       typeof bankAudio;
    barnAudio:       typeof barnAudio;
    homeDoorAudio:   typeof homeDoorAudio;
  };
};

// ─── MusicInit ────────────────────────────────────────────────────────────────

function MusicInit() {
  const { initMusic, stopMusic } = useAudio();
  useEffect(() => {
    initMusic("/audio/calm_background.mp3");
    return () => stopMusic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// ── Plot Popover ───────────────────────────────────────────────────────────────

type PlotPopoverKind = "harvest" | "plant" | "locked" | "noseed" | null;

interface PlotPopoverState {
  kind: PlotPopoverKind;
  screenX: number;
  screenY: number;
  requiredLevel?: number;
  amount?: number;
}

const POPOVER_DURATION_MS = 1200;

function PlotPopover() {
  const [state, setState] = useState<PlotPopoverState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: PlotPopoverState) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState(next);
    timerRef.current = setTimeout(() => setState(null), POPOVER_DURATION_MS);
  }, []);

  useEffect(() => {
    const onHarvest = (e: Event) => {
      const { screenX, screenY, amount } = (e as CustomEvent).detail;
      show({ kind: "harvest", screenX, screenY, amount });
    };
    const onPlant = (e: Event) => {
      const { screenX, screenY } = (e as CustomEvent).detail;
      show({ kind: "plant", screenX, screenY });
    };
    const onLocked = (e: Event) => {
      const { screenX, screenY, requiredLevel } = (e as CustomEvent).detail;
      show({ kind: "locked", screenX, screenY, requiredLevel });
    };
    const onNoSeed = (e: Event) => {
      const { screenX, screenY } = (e as CustomEvent).detail;
      show({ kind: "noseed", screenX, screenY });
    };

    window.addEventListener("phaser-plot-harvest", onHarvest);
    window.addEventListener("phaser-plot-plant",   onPlant);
    window.addEventListener("phaser-plot-locked",  onLocked);
    window.addEventListener("phaser-plot-noseed",  onNoSeed);
    return () => {
      window.removeEventListener("phaser-plot-harvest", onHarvest);
      window.removeEventListener("phaser-plot-plant",   onPlant);
      window.removeEventListener("phaser-plot-locked",  onLocked);
      window.removeEventListener("phaser-plot-noseed",  onNoSeed);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [show]);

  if (!state) return null;

  const MARGIN = 8;
  const x = Math.max(MARGIN, Math.min(state.screenX, window.innerWidth  - MARGIN));
  const y = Math.max(MARGIN, Math.min(state.screenY, window.innerHeight - MARGIN));

  return (
    <div
      style={{
        position: "fixed",
        left: x,
        top: y,
        transform: "translate(-50%, -110%)",
        zIndex: 9999,
        pointerEvents: "none",
      }}
      className="flex flex-col items-center animate-bounce-once"
    >
      {state.kind === "harvest" && (
        <span className="text-sm font-bold text-yellow-300 drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">
          +{state.amount ?? 1}
        </span>
      )}
      {state.kind === "plant" && (
        <span className="text-xs font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          -1
        </span>
      )}
      {state.kind === "locked" && (
        <span className="flex items-center gap-1 text-xs font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)] leading-none">
          Level {state.requiredLevel}
        </span>
      )}
      {state.kind === "noseed" && (
        <span className="whitespace-nowrap text-xs font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)] leading-none">
          Equip a seed!
        </span>
      )}
    </div>
  );
}

// ── Node Tooltip ───────────────────────────────────────────────────────────────

interface NodeHoverState {
  kind: "depleted" | "growing" | "animal";
  screenX: number;
  screenY: number;
  nodeType?: string;
  choppedAt?: number;
  recoverySecs?: number;
  cropName?: string;
  plantedAt?: number;
  harvestMs?: number;
  animalType?: string;
  produceName?: string;
  produceIcon?: string;
  fedAt?: number;
  produceMs?: number;
}

function NodeTooltip() {
  const [state, setState] = useState<NodeHoverState | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const next = (window as any).__nodeTooltip as NodeHoverState | null | undefined;
      setState(next ?? null);
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  if (!state) return null;

  const MARGIN = 8;
  const x = Math.max(MARGIN, Math.min(state.screenX, window.innerWidth  - MARGIN));
  const y = Math.max(MARGIN, Math.min(state.screenY, window.innerHeight - MARGIN));

  const commonStyle: React.CSSProperties = {
    position: "fixed",
    left: x,
    top: y,
    transform: "translate(-50%, -110%)",
    zIndex: 9999,
    pointerEvents: "none",
  };

  if (state.kind === "depleted") {
    const recoverySecs = state.recoverySecs ?? TREE_RECOVERY_SECONDS;
    const timeLeft = Math.max(0, getTimeLeft(state.choppedAt ?? 0, recoverySecs));
    return (
      <div style={commonStyle}>
        <TimeLeftPanel text="Recovers in" timeLeft={timeLeft} showTimeLeft={true} />
      </div>
    );
  }

  if (state.kind === "growing") {
    const cropName = state.cropName as CropName | undefined;
    if (!cropName) return null;
    const crop      = CROPS()[cropName];
    const lifecycle = LIFECYCLE[cropName];
    const timeLeft  = Math.max(0, getTimeLeft(state.plantedAt ?? 0, crop?.harvestSeconds ?? 60));
    return (
      <div style={commonStyle}>
        <InnerPanel className="whitespace-nowrap w-fit">
          <div className="flex flex-col text-xxs text-white text-shadow ml-2 mr-2 p-1">
            <div className="flex flex-1 items-center justify-center mb-0.5">
              <img
                src={getImageSrc(lifecycle?.ready)}
                className="w-4 mr-1"
                style={{ imageRendering: "pixelated" }}
                alt={cropName}
              />
              <span>{cropName}</span>
            </div>
            <span className="flex-1">{secondsToMidString(timeLeft)}</span>
          </div>
        </InnerPanel>
      </div>
    );
  }

  if (state.kind === "animal") {
    const { produceName, produceIcon, fedAt, produceMs } = state;
    const timeLeftSecs = !fedAt
      ? 0
      : Math.max(0, Math.floor(((fedAt + (produceMs ?? 0)) - Date.now()) / 1000));

    return (
      <div style={commonStyle}>
        <InnerPanel className="whitespace-nowrap w-fit">
          <div className="flex flex-col text-xxs text-white text-shadow mx-2 my-1 gap-0.5">
            <div className="flex items-center gap-1">
              {produceIcon && (
                <img
                  src={`/${produceIcon}`}
                  alt={produceName}
                  className="w-4 h-4"
                  style={{ imageRendering: "pixelated" }}
                />
              )}
              <span>{produceName} ready in</span>
            </div>
            {timeLeftSecs > 0 && (
              <span className="text-center opacity-80">{secondsToMidString(timeLeftSecs)}</span>
            )}
          </div>
        </InnerPanel>
      </div>
    );
  }

  return null;
}

// ── Resource Drop Floater ──────────────────────────────────────────────────────

const RESOURCE_COLORS: Record<string, string> = {
  tree:  "text-green-300",
  stone: "text-slate-300",
  iron:  "text-orange-300",
  gold:  "text-yellow-300",
};

interface ResourceDropState {
  nodeType: string;
  amount: number;
  screenX: number;
  screenY: number;
  id: number;
}

function ResourceDropFloater() {
  const [drops, setDrops] = useState<ResourceDropState[]>([]);

  useEffect(() => {
    const onDrop = (e: Event) => {
      const { nodeType, amount, screenX, screenY } = (e as CustomEvent).detail;
      const id = Date.now() + Math.random();
      setDrops((prev) => [...prev, { nodeType, amount, screenX, screenY, id }]);
      setTimeout(() => setDrops((prev) => prev.filter((d) => d.id !== id)), 1200);
    };
    window.addEventListener("phaser-resource-drop", onDrop);
    return () => window.removeEventListener("phaser-resource-drop", onDrop);
  }, []);

  return (
    <>
      {drops.map((drop) => {
        const color  = RESOURCE_COLORS[drop.nodeType] ?? "text-white";
        const MARGIN = 8;
        const x = Math.max(MARGIN, Math.min(drop.screenX, window.innerWidth  - MARGIN));
        const y = Math.max(MARGIN, Math.min(drop.screenY, window.innerHeight - MARGIN));
        return (
          <span
            key={drop.id}
            style={{
              position: "fixed",
              left: x,
              top: y,
              transform: "translate(-50%, -110%)",
              zIndex: 9999,
              pointerEvents: "none",
            }}
            className={`text-sm font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,1)] animate-bounce-once ${color}`}
          >
            +{drop.amount}
          </span>
        );
      })}
    </>
  );
}

// ── CropEventBridge ────────────────────────────────────────────────────────────

/**
 * Listens for phaser-plot-plant and phaser-plot-harvest window events fired by
 * FarmScene and dispatches the matching Zustand actions. Registered once; reads
 * live state via getState() so it never goes stale.
 */
function CropEventBridge() {
  const dispatchRef = useRef(useGameStore.getState().dispatch);

  useEffect(() => {
    dispatchRef.current = useGameStore.getState().dispatch;
  });

  useEffect(() => {
    const onPlant = (e: Event) => {
      const { fieldIndex, item } = (e as CustomEvent).detail;
      const liveFields = useGameStore.getState().state.fields;
      if (liveFields[fieldIndex]) return;
      screenTracker.reset();
      try { dispatchRef.current({ type: "item.planted", index: fieldIndex, item }); } catch { /* no seeds / locked */ }
    };
    const onHarvest = (e: Event) => {
      const { fieldIndex } = (e as CustomEvent).detail;
      const liveFields = useGameStore.getState().state.fields;
      if (!liveFields[fieldIndex]) return;
      screenTracker.reset();
      try { dispatchRef.current({ type: "item.harvested", index: fieldIndex }); } catch { /* not ready */ }
    };
    window.addEventListener("phaser-plot-plant",   onPlant);
    window.addEventListener("phaser-plot-harvest", onHarvest);
    return () => {
      window.removeEventListener("phaser-plot-plant",   onPlant);
      window.removeEventListener("phaser-plot-harvest", onHarvest);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ── ResourceEventBridge ────────────────────────────────────────────────────────

/**
 * Listens for phaser-resource-drop fired by FarmScene on the depleting hit of a
 * tree or stone node, then dispatches the matching game-store action so the
 * inventory (Wood / Stone / Iron / Gold) updates.
 */
function ResourceEventBridge() {
  const dispatchRef = useRef(useGameStore.getState().dispatch);

  useEffect(() => {
    dispatchRef.current = useGameStore.getState().dispatch;
  });

  useEffect(() => {
    const onDrop = (e: Event) => {
      const { nodeType, nodeId } = (e as CustomEvent).detail as {
        nodeType: string;
        nodeId: string;
      };
      const index = parseInt(nodeId.replace(/\D/g, ""), 10) - 1;
      if (isNaN(index)) return;
      screenTracker.reset();
      try {
        if (nodeType === "tree")  dispatchRef.current({ type: "tree.chopped",  index });
        else if (nodeType === "stone") dispatchRef.current({ type: "stone.mined", index });
        else if (nodeType === "iron")  dispatchRef.current({ type: "iron.mined",  index });
        else if (nodeType === "gold")  dispatchRef.current({ type: "gold.mined",  index });
      } catch { /* not enough stamina or already depleted */ }
    };
    window.addEventListener("phaser-resource-drop", onDrop);
    return () => window.removeEventListener("phaser-resource-drop", onDrop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ── FishingEventBridge ─────────────────────────────────────────────────────────

/**
 * phaser-fishing-open → dispatch fish.caught, show FishCaughtModal.
 * The casting progress bar and cooldown bar are handled by FishingCooldown in the Hud.
 */
function FishingEventBridge() {
  const [fishResult, setFishResult] = useState<{ fish: FishName; amount: number } | null>(null);

  useEffect(() => {
    const onCaught = () => {
      screenTracker.reset();
      try {
        useGameStore.getState().dispatch({ type: "fish.caught", createdAt: Date.now() });
        const { fishing } = useGameStore.getState().state;
        if (fishing.lastCaughtFish) {
          setFishResult({ fish: fishing.lastCaughtFish, amount: fishing.lastCaughtAmount });
        }
      } catch { /* cooldown / stamina guard */ }
    };
    window.addEventListener("phaser-fishing-open", onCaught);
    return () => window.removeEventListener("phaser-fishing-open", onCaught);
  }, []);

  // Dynamic import to avoid bundling FishCaughtModal before it's needed
  const FishCaughtModal = fishResult ? require("@/components/game/fishing/FishCaughtModal").FishCaughtModal : null;

  return (
    <>
      {fishResult && FishCaughtModal && (
        <FishCaughtModal
          fish={fishResult.fish}
          amount={fishResult.amount}
          onClose={() => setFishResult(null)}
        />
      )}
    </>
  );
}

// ── PhaserCanvas ───────────────────────────────────────────────────────────────

/**
 * PhaserCanvas
 *
 * Mounts the Phaser game into a full-screen div, wraps it in the Zustand
 * GameProvider + ToastProvider, exposes the store and SFX on window so
 * FarmScene can call them, and renders all React overlays:
 *
 *   - CropEventBridge, ResourceEventBridge, FishingEventBridge
 *   - Hud — PlayerHud, Inventory, FishingCooldown
 *   - PlotPopover, ResourceDropFloater, NodeTooltip
 *   - PhaserModals — hearthvale building modals + Lucky Frog modals
 *   - MobileJoystick, MobileActionButton
 *   - LandscapeGate — portrait-mode blocker
 *   - MusicInit — background music
 */
export default function PhaserCanvas() {
  const { player }                    = usePlayer();
  const { musicEnabled, toggleMusic } = useAudio();
  const gameRef = useRef<import("phaser").Game | null>(null);

  // Hydrate display settings from localStorage once on client mount.
  useEffect(() => { hydratGameSettings(); }, []);
  const rotated = useGameSettings((s) => s.rotated);

  // Track when FarmScene has finished building the world so we can keep the
  // loading screen up (and the HUD hidden) until the game is actually rendered.
  const [farmReady, setFarmReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  useEffect(() => {
    const onReady = () => setFarmReady(true);
    const onProgress = (e: Event) => {
      const value = (e as CustomEvent<{ value: number }>).detail?.value ?? 0;
      // Only ever move the bar forward so it doesn't visually jump backward.
      setLoadProgress((prev) => Math.max(prev, Math.min(1, value)));
    };
    window.addEventListener("phaser-farm-ready", onReady);
    window.addEventListener("phaser-load-progress", onProgress);
    return () => {
      window.removeEventListener("phaser-farm-ready", onReady);
      window.removeEventListener("phaser-load-progress", onProgress);
    };
  }, []);

  // Sync player globals to window each render so FarmScene HUD can read them
  if (typeof window !== "undefined") {
    const w             = window as Win;
    w.__playerLFRG     = player?.lfrg     ?? 0;
    w.__playerSOL      = player?.sol      ?? 0;
    w.__playerUsername = player?.username ?? "";
    w.__musicEnabled   = musicEnabled;
    w.__toggleMusic    = toggleMusic;
  }

  useEffect(() => {
    let mounted = true;

    // Expose the Zustand store on window so FarmScene (plain JS/TS with no React
    // context access) can call window.__gameStore.getState() to read live state.
    // Also expose SFX helpers so FarmScene can play plant/harvest sounds after animations.
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__gameStore = useGameStore;
      (window as Win).__sfx = {
        plantAudio,
        harvestAudio,
        chopAudio,
        treeFallAudio,
        miningAudio,
        miningFallAudio,
        marketAudio,
        blacksmithAudio,
        kitchenAudio,
        bankAudio,
        barnAudio,
        homeDoorAudio,
      };
    }

    // Start screenTracker so bot-detection accumulates real mouse-movement data.
    screenTracker.start();

    import("@/phaser/index").then(({ default: startPhaserGame }) => {
      if (!mounted || gameRef.current) return;

      // Expose the persisted farm state on window so FarmScene can read it
      // at boot time to restore planted crops and depleted resource nodes.
      (window as unknown as Record<string, unknown>).__playerFarmState =
        useGameStore.getState().state;

      gameRef.current = startPhaserGame("phaser-container");

      if (typeof window !== "undefined") {
        (window as unknown as Record<string, unknown>).phaserGame = gameRef.current;
      }
    });

    return () => {
      mounted = false;
      screenTracker.pause();
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
        if (typeof window !== "undefined") {
          delete (window as unknown as Record<string, unknown>).phaserGame;
        }
      }
    };
  }, []);

  const wallet = player?.wallet ?? "";

  return (
    <>
      <GameProvider>
        <ToastQueueProvider>
          <MusicInit />
          <CropEventBridge />
          <ResourceEventBridge />
          <FishingEventBridge />
          <ToastManager />

          <div
            className="relative w-full h-full transition-transform duration-300 origin-center"
            style={rotated ? { transform: "rotate(90deg)", width: "100vh", height: "100vw", position: "absolute", top: "50%", left: "50%", translate: "-50% -50%" } : undefined}
          >
            {/* Phaser mounts its <canvas> here */}
            <div
              id="phaser-container"
              className="w-full h-full"
              aria-label="Lucky Frog town — game canvas"
            />

            {/* Loading screen — shown until FarmScene finishes rendering the world.
                Uses the same background image as the login page. */}
            {!farmReady && (
              <div
                role="status"
                aria-label="Loading Lucky Frog Mine"
                className="absolute inset-0 z-[9998] flex flex-col items-center justify-center bg-cover bg-center"
                style={{ backgroundImage: "url('/bg-login.png')" }}
              >
                <div className="absolute inset-0 bg-black/50" />
                <div className="relative flex flex-col items-center gap-5">
                  <h1 className="font-pixel text-xl sm:text-2xl text-white text-center drop-shadow-lg">
                    LUCKY FROG MINE
                  </h1>

                  {/* Progress bar driven by real asset-load progress from LoaderScene */}
                  <div className="w-56 sm:w-64">
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(loadProgress * 100)}
                      className="h-4 w-full overflow-hidden rounded-full border-2 border-white/40 bg-black/40"
                    >
                      <div
                        className="h-full rounded-full bg-emerald-400 transition-[width] duration-200 ease-out"
                        style={{ width: `${Math.round(loadProgress * 100)}%` }}
                      />
                    </div>
                    <p className="mt-3 text-center font-pixel text-[9px] uppercase tracking-widest text-white/70">
                      {loadProgress >= 1 ? "Entering the mine..." : `Loading... ${Math.round(loadProgress * 100)}%`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* React overlays — only mounted once the world is rendered */}
            {farmReady && (
              <>
                <Hud wallet={wallet} />
                <MobileJoystick />
                <MobileActionButton />
                <PlotPopover />
                <ResourceDropFloater />
                <NodeTooltip />
                {wallet && <PhaserModals wallet={wallet} />}
              </>
            )}
          </div>
        </ToastQueueProvider>
      </GameProvider>
    </>
  );
}
