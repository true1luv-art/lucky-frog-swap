

import { useEffect, useRef, useState, useCallback, useContext } from "react";
import { useAudio }  from "@/context/AudioContext";
import { usePlayer } from "@/context/PlayerContext";

import { GameProvider }                      from "@/context/GameContext";
import { ToastQueueProvider, ToastContext }  from "@/context/ToastContext";
import { Hud }                  from "@/features/game-components/hud/Hud";
import { PhaserModals }         from "@/features/game-components/PhaserModals";
import { MobileJoystick }       from "@/phaser/ui/MobileJoystick";
import { MobileActionButton }   from "@/phaser/ui/MobileActionButton";
import { hydratGameSettings } from "@/features/game-stores/useGameSettings";

import { InnerPanel }           from "@/components/ui/Panel";
import { TimeLeftPanel }        from "@/components/ui/TimeLeftPanel";
import { LIFECYCLE }            from "@/features/types/crop-assets";
import { CROPS, type CropName } from "@/features/types/gameplay/crops";
import { getTimeLeft, secondsToMidString } from "@/features/utils/time";
import { getImageSrc }          from "@/features/utils/getImageSrc";
import { TREE_RECOVERY_SECONDS } from "@/features/events/chop/chop";
import { useGameStore }         from "@/features/game-stores/useGameStore";
import { screenTracker }        from "@/features/utils/screen";
import type { FishName }        from "@/features/types/gameplay/fish";
import { FishCaughtModal }      from "@/features/game-components/fishing/FishCaughtModal";
import {
  marketAudio,
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
} from "@/features/utils/sfx";

// ── Window augmentation ────────────────────────────────────────────────────────
type Win = Window & {
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
  kind: "depleted" | "growing" | "animal" | "needs_water";
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

  if (state.kind === "needs_water") {
    const cropName  = state.cropName as CropName | undefined;
    const lifecycle = cropName ? LIFECYCLE[cropName] : undefined;
    return (
      <div style={commonStyle}>
        <InnerPanel className="whitespace-nowrap w-fit">
          <div className="flex items-center text-xxs text-white text-shadow mx-2 my-1 gap-1.5">
            {lifecycle?.ready && (
              <img
                src={getImageSrc(lifecycle.ready)}
                className="w-4"
                style={{ imageRendering: "pixelated" }}
                alt={cropName}
              />
            )}
            <span>{cropName}</span>
            <span className="opacity-75">— needs watering</span>
          </div>
        </InnerPanel>
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
  tree:     "text-green-300",
  stone:    "text-slate-300",
  iron:     "text-orange-300",
  emerald:  "text-emerald-300",
  diamond:  "text-cyan-200",
  ignisite: "text-red-400",
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
    const onWater = (e: Event) => {
      const { fieldIndex } = (e as CustomEvent).detail;
      const liveFields = useGameStore.getState().state.fields;
      const field = liveFields[fieldIndex] as Record<string, unknown> | undefined;
      // Only water if planted and isWatered is explicitly false — use the DB flag, not harvestAt inference.
      if (!field || Boolean(field.isWatered ?? false)) return;
      screenTracker.reset();
      try { dispatchRef.current({ type: "field.watered", index: fieldIndex }); } catch { /* no watering can */ }
    };
    window.addEventListener("phaser-plot-plant",   onPlant);
    window.addEventListener("phaser-plot-harvest", onHarvest);
    window.addEventListener("phaser-plot-water",   onWater);
    return () => {
      window.removeEventListener("phaser-plot-plant",   onPlant);
      window.removeEventListener("phaser-plot-harvest", onHarvest);
      window.removeEventListener("phaser-plot-water",   onWater);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ── ResourceEventBridge ───────────────────────────────────────────────────────���

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
      // All stone positions dispatch the same action — ore drops are
      // determined server-side by the player's equipped pickaxe tier.
      try {
        if (nodeType === "tree") {
          dispatchRef.current({ type: "tree.chopped", index });
        } else if (nodeType === "stone" || nodeType === "iron" || nodeType === "emerald" || nodeType === "diamond" || nodeType === "ignisite") {
          dispatchRef.current({ type: "stone.mined", index });
        }
      } catch { /* already depleted */ }
    };
    window.addEventListener("phaser-resource-drop", onDrop);
    return () => window.removeEventListener("phaser-resource-drop", onDrop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ── NoToolBridge ���������─────────────────────────────────────────��───────────────────

/**
 * Listens for phaser-no-tool events fired by ResourceSystem when the player
 * tries to chop / mine without the required tool, then shows a HUD toast.
 */
function NoToolBridge() {
  const { addToast } = useContext(ToastContext);

  useEffect(() => {
    const onNoTool = (e: Event) => {
      const { tool, reason } = (e as CustomEvent).detail as { tool: string; nodeType: string; reason?: string };
      const msg = reason === "not-equipped"
        ? `Equip your ${tool} first.`
        : `You need a ${tool} to do this.`;
      addToast(msg);
    };
    window.addEventListener("phaser-no-tool", onNoTool);
    return () => window.removeEventListener("phaser-no-tool", onNoTool);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ── FishingEventBridge ──────────────��─���──────────────────����──��������─������───────────────

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
        const prevState = useGameStore.getState().state;
        useGameStore.getState().dispatch({ type: "fish.caught", createdAt: Date.now() });
        const { fishing, items: fishItems } = useGameStore.getState().state;
        if (fishing.lastCaughtFish) {
          const fish = fishing.lastCaughtFish;
          const prev = Number((prevState.items as Record<string, unknown>)[fish] ?? 0);
          const next = Number((fishItems as Record<string, unknown>)[fish] ?? 0);
          setFishResult({ fish, amount: next - prev });
        }
      } catch { /* cooldown guard */ }
    };
    window.addEventListener("phaser-fishing-open", onCaught);
    return () => window.removeEventListener("phaser-fishing-open", onCaught);
  }, []);

  return (
    <>
      {fishResult && (
        <FishCaughtModal
          fish={fishResult.fish}
          amount={fishResult.amount}
          onClose={() => setFishResult(null)}
        />
      )}
    </>
  );
}

// ── PhaserCanvas ────��──────────────────────────────────────────────────────────

/**
 * PhaserCanvas
 *
 * Mounts the Phaser game into a full-screen div, wraps it in the Zustand
 * GameProvider + ToastProvider, exposes the store and SFX on window so
 * FarmScene can call them, and renders all React overlays:
 *
 *   - CropEventBridge, ResourceEventBridge, FishingEventBridge
 *   - Hud — Hud dock, Inventory, FishingCooldown
 *   - PlotPopover, ResourceDropFloater, NodeTooltip
   *   - PhaserModals — building modals
 *   - MobileJoystick, MobileActionButton
   *   - MusicInit — background music
 */
export default function PhaserCanvas() {
  const { player }                    = usePlayer();
  const { musicEnabled, toggleMusic } = useAudio();
  const gameRef         = useRef<import("phaser").Game | null>(null);
  const hydrateFarm     = useGameStore((s) => s.hydrateFarm);

  // Fetch authoritative server state once on mount so DB changes are always
  // reflected on page load/refresh, overwriting any stale localStorage values.
  useEffect(() => { hydrateFarm(); }, [hydrateFarm]);

  // Hydrate display settings from localStorage once on client mount.
  useEffect(() => { hydratGameSettings(); }, []);

  // Track when FarmScene has finished building the world so we can keep the
  // loading screen up (and the HUD hidden) until the game is actually rendered.
  const [farmReady,    setFarmReady]    = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [sceneLabel,   setSceneLabel]   = useState("farm");

  // Show the loader on every scene transition (Farm→Town, Town→Farm).
  // LoaderScene fires first at boot — farmReady starts false so that's handled.
  // Any subsequent phaser-scene-start resets the overlay.
  useEffect(() => {
    const onReady = () => setFarmReady(true);

    const onProgress = (e: Event) => {
      const value = (e as CustomEvent<{ value: number }>).detail?.value ?? 0;
      // Only ever move the bar forward so it doesn't visually jump backward.
      setLoadProgress((prev) => Math.max(prev, Math.min(1, value)));
    };

    const onSceneStart = (e: Event) => {
      const sceneName = (e as CustomEvent<{ sceneName: string }>).detail?.sceneName ?? "";
      // Skip the initial LoaderScene fire — boot is already handled by useState(false).
      if (!sceneName || sceneName === "LoaderScene") return;
      setSceneLabel("farm");
      setFarmReady(false);
      setLoadProgress(0);
    };

    window.addEventListener("phaser-farm-ready",    onReady);
    window.addEventListener("phaser-load-progress", onProgress);
    window.addEventListener("phaser-scene-start",   onSceneStart);
    return () => {
      window.removeEventListener("phaser-farm-ready",    onReady);
      window.removeEventListener("phaser-load-progress", onProgress);
      window.removeEventListener("phaser-scene-start",   onSceneStart);
    };
  }, []);

  // Synthetic progress ticker — eases the bar from 0 → 90% while the scene
  // builds. Real asset-load progress from LoaderScene can push it further.
  // phaser-farm-ready snaps the bar to 100% via the farmReady flag.
  useEffect(() => {
    if (farmReady) return;
    const id = setInterval(() => {
      setLoadProgress((prev) => {
        if (prev >= 0.9) { clearInterval(id); return prev; }
        return prev + (0.9 - prev) * 0.05;
      });
    }, 100);
    return () => clearInterval(id);
  }, [farmReady]);

  // Sync player globals to window each render so FarmScene HUD can read them
  if (typeof window !== "undefined") {
    const w             = window as Win;
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
      <NoToolBridge />
      <FishingEventBridge />
          <div className="relative w-full h-full">
            {/* Phaser mounts its <canvas> here — fills the layout slot */}
            <div
              id="phaser-container"
              className="absolute inset-0"
              aria-label="Game canvas"
            />

            {/* Loading screen — shown on boot and on every scene transition */}
            {!farmReady && (
              <div
                role="status"
                aria-label="Loading game"
                className="absolute inset-0 z-[9998] flex flex-col items-center justify-center bg-cover bg-center"
                style={{ backgroundImage: "url('/bg-login.png')" }}
              >
                <div className="absolute inset-0 bg-black/50" />
                <div className="relative flex flex-col items-center gap-5">
                  <h1 className="font-pixel text-xl sm:text-2xl text-white text-center drop-shadow-lg">
                    ROBINHOOD FARM
                  </h1>

                  {/* Progress bar — driven by real asset-load progress or synthetic ticker */}
                  <div className="w-56 sm:w-64">
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(loadProgress * 100)}
                      className="h-4 w-full overflow-hidden rounded border-2 border-white/40 bg-black/40"
                    >
                      <div
                        className="h-full bg-emerald-400 transition-[width] duration-200 ease-out"
                        style={{ width: `${Math.round(loadProgress * 100)}%` }}
                      />
                    </div>
                    <p className="mt-3 text-center font-pixel text-[9px] uppercase tracking-widest text-white/70">
                      {loadProgress >= 0.95
                        ? `Entering ${sceneLabel}...`
                        : `Loading... ${Math.round(loadProgress * 100)}%`}
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
