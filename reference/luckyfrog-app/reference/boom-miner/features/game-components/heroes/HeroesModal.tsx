"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  ModalShell,
  ModalTitleBar,
  ActionDock,
  StatChip,
} from "@/components/ui/modal";
import {
  useGameStore,
  MAX_ON_MAP,
  RECOVERY_FRACTION_PER_INTERVAL,
  RECOVERY_INTERVAL_SECONDS,
  type RosterHero,
} from "@/features/store/gameStore";
import { sendHeroDeploy } from "@/phaser/sync/WSSyncManager";
import { HeroSprite } from "./HeroSprite";

type RarityKey = "common" | "uncommon" | "rare" | "epic" | "legendary";

const RARITY_ORDER: RarityKey[] = ["common", "uncommon", "rare", "epic", "legendary"];
const RARITY_COLOR: Record<RarityKey, string> = {
  common:    "#9ca3af",
  uncommon:  "#22c55e",
  rare:      "#3b82f6",
  epic:      "#a855f7",
  legendary: "#facc15",
};

const PIXEL_HEAD = "'Press Start 2P', 'Silkscreen', monospace";
const PIXEL_BODY = "'VT323', 'Silkscreen', monospace";

function heroStatus(h: RosterHero): { label: string; color: string } {
  if (h.onMap)                  return { label: "WORKING",  color: "#4ade80" };
  if (h.currentEnergy < 1)      return { label: "SLEEPING", color: "#dc2626" };
  if (h.currentEnergy < h.maxEnergy) return { label: "RESTING",  color: "#38bdf8" };
  return                               { label: "READY",    color: "#fbbf24" };
}

/**
 * Returns the replenish rate as a human-readable string.
 * Formula: maxEnergy * RECOVERY_FRACTION_PER_INTERVAL per RECOVERY_INTERVAL_SECONDS.
 * Displayed as "+N / 5 min" (or the actual interval).
 */
function replenishLabel(maxEnergy: number): string {
  const gainPerTick = Math.round(maxEnergy * RECOVERY_FRACTION_PER_INTERVAL);
  const intervalMin = Math.round(RECOVERY_INTERVAL_SECONDS / 60);
  return `+${gainPerTick} / ${intervalMin} min`;
}

function EnergyBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;
  const color = pct <= 20 ? "#ef4444" : pct <= 50 ? "#facc15" : "#4ade80";
  const isFull = current >= max;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between mb-0.5" style={{ fontFamily: PIXEL_HEAD, fontSize: 7 }}>
        <span className="text-white/60 uppercase tracking-wide">Energy</span>
        <span className="text-white">{Math.floor(current)}/{max}</span>
      </div>
      <div className="h-2 bg-black/50 rounded overflow-hidden border border-black/40">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {/* Replenish rate — shown only when not full */}
      <div className="flex justify-end mt-0.5">
        <span
          style={{ fontFamily: PIXEL_HEAD, fontSize: 6, letterSpacing: 1 }}
          className={isFull ? "text-white/30" : "text-[#38bdf8]"}
        >
          {isFull ? "FULL" : `REPLENISH ${replenishLabel(max)}`}
        </span>
      </div>
    </div>
  );
}

interface Props {
  show: boolean;
  onClose: () => void;
}

export function HeroesModal({ show, onClose }: Props) {
  const roster       = useGameStore((s) => s.roster);
  const setHeroOnMap = useGameStore((s) => s.setHeroOnMap);
  const deployError  = useGameStore((s) => s.deployError);
  const setDeployError = useGameStore((s) => s.setDeployError);
  const onMapCount   = roster.filter((h) => h.onMap).length;

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const displayed = useMemo(() => {
    return [...roster].sort((a, b) => {
      if (a.onMap !== b.onMap) return a.onMap ? -1 : 1;
      return RARITY_ORDER.indexOf((b.rarity ?? "common") as RarityKey)
           - RARITY_ORDER.indexOf((a.rarity ?? "common") as RarityKey);
    });
  }, [roster]);

  const selected = useMemo(
    () => displayed.find((h) => h.id === selectedId) ?? displayed[0] ?? null,
    [displayed, selectedId],
  );

  // Clear deploy error on open/close
  useEffect(() => {
    setDeployError(null);
    return () => setDeployError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const handleToggle = (heroId: string, onMap: boolean) => {
    setDeployError(null);
    setHeroOnMap(heroId, onMap);
    const sent = sendHeroDeploy(heroId, onMap);
    if (!sent) {
      setHeroOnMap(heroId, !onMap);
      setDeployError("Reconnecting — please try again in a moment");
    }
  };

  const canDeploy = (h: RosterHero) =>
    !h.onMap && h.currentEnergy >= 1 && onMapCount < MAX_ON_MAP;

  return (
    <ModalShell
      show={show}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          title="Heroes"
          subtitle={`${onMapCount} / ${MAX_ON_MAP} on map`}
          onClose={onClose}
          extra={
            <StatChip
              value={`${onMapCount}/${MAX_ON_MAP}`}
              caption="On Map"
            />
          }
        />
      }
      actionDock={
        selected ? (
          <ActionDock
            info={
              deployError ? (
                <span className="text-red-400" style={{ fontFamily: PIXEL_HEAD, fontSize: 8 }}>
                  {deployError}
                </span>
              ) : (
                <span className="text-white/60 truncate" style={{ fontFamily: PIXEL_HEAD, fontSize: 8, letterSpacing: 1 }}>
                  {selected.type.toUpperCase()} #{selected.minted_number}
                </span>
              )
            }
          >
            {selected.onMap ? (
              <button
                type="button"
                onClick={() => handleToggle(selected.id, false)}
                className="wood-frame-light wood-panel-inner px-6 py-2.5 text-white text-shadow cursor-pointer hover:brightness-110 active:translate-y-0.5 transition-all duration-75"
                style={{
                  fontFamily: PIXEL_HEAD,
                  fontSize: 9,
                  letterSpacing: 2,
                }}
              >
                RECALL
              </button>
            ) : (
              <button
                type="button"
                disabled={!canDeploy(selected)}
                onClick={() => handleToggle(selected.id, true)}
                className="wood-frame-light wood-panel-inner px-6 py-2.5 text-white text-shadow cursor-pointer hover:brightness-110 active:translate-y-0.5 transition-all duration-75 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  fontFamily: PIXEL_HEAD,
                  fontSize: 9,
                  letterSpacing: 2,
                }}
              >
                {selected.currentEnergy < 1
                  ? "SLEEPING"
                  : onMapCount >= MAX_ON_MAP && !selected.onMap
                    ? "MAP FULL"
                    : "DEPLOY"}
              </button>
            )}
          </ActionDock>
        ) : undefined
      }
    >
      {/* Hero list + detail side-by-side */}
      <div className="flex min-h-0 gap-1" style={{ minHeight: 420 }}>
        {/* List */}
        <div className="flex flex-col gap-1 w-2/5 overflow-y-auto scrollable">
          {displayed.length === 0 ? (
            <p className="text-white/50 text-center p-4" style={{ fontFamily: PIXEL_BODY, fontSize: 16 }}>
              No heroes yet — visit SHOP.
            </p>
          ) : null}
          {displayed.map((h) => {
            const isActive = selected?.id === h.id;
            const { label: statusLabel, color: statusColor } = heroStatus(h);
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => setSelectedId(h.id)}
                className={clsx(
                  "wood-frame-light wood-panel-inner text-left p-2 flex items-center gap-2 cursor-pointer transition-all duration-75",
                  isActive ? "brightness-110" : "opacity-80 hover:opacity-100",
                )}
                style={{
                  fontFamily: PIXEL_BODY,
                  boxShadow: isActive ? "0 0 0 3px #dc2626" : undefined,
                }}
              >
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <HeroSprite type={h.type} size={32} static />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="truncate text-white"
                    style={{ fontFamily: PIXEL_HEAD, fontSize: 8, letterSpacing: 1 }}
                  >
                    {h.name.toUpperCase()}
                  </div>
                  <div className="text-white/60 text-sm">#{h.minted_number}</div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span style={{ fontFamily: PIXEL_HEAD, fontSize: 7, color: statusColor }}>
                      {statusLabel}
                    </span>
                    <span
                      className="px-1 text-black shrink-0"
                      style={{
                        background: RARITY_COLOR[(h.rarity ?? "common") as RarityKey],
                        fontFamily: PIXEL_HEAD,
                        fontSize: 6,
                      }}
                    >
                      {h.rarityLabel.toUpperCase()}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 p-2">
          {selected ? (
            <>
              {/* Portrait + identity */}
              <div className="flex gap-3 items-start">
                <div className="w-24 h-24 flex items-center justify-center shrink-0 bg-black/30 rounded">
                  <HeroSprite type={selected.type} size={72} intervalMs={450} />
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <span
                    className="text-xs text-white/60"
                    style={{ fontFamily: PIXEL_BODY, fontSize: 15 }}
                  >
                    #{selected.minted_number}
                  </span>
                  <span
                    className="text-white"
                    style={{ fontFamily: PIXEL_HEAD, fontSize: 11, letterSpacing: 1 }}
                  >
                    {selected.name.toUpperCase()}
                  </span>
                  <span
                    className="px-2 py-0.5 text-black text-[8px] rounded self-start"
                    style={{
                      background: RARITY_COLOR[(selected.rarity ?? "common") as RarityKey],
                      fontFamily: PIXEL_HEAD,
                      letterSpacing: 1,
                    }}
                  >
                    {selected.rarityLabel.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Energy bar */}
              <EnergyBar current={selected.currentEnergy} max={selected.maxEnergy} />

              {/* Attributes grid */}
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ["Power",    selected.attributes.power],
                    ["Speed",    selected.attributes.speed],
                    ["Stamina",  selected.attributes.stamina],
                    ["Bombs",    selected.attributes.bomb_number],
                    ["Range",    selected.attributes.bomb_range],
                  ] as [string, number][]
                ).map(([label, val]) => (
                  <div
                    key={label}
                    className="flex justify-between bg-black/30 px-2 py-1 rounded"
                  >
                    <span
                      className="text-white/50 uppercase"
                      style={{ fontFamily: PIXEL_HEAD, fontSize: 7, letterSpacing: 1 }}
                    >
                      {label}
                    </span>
                    <span className="text-white" style={{ fontFamily: PIXEL_BODY, fontSize: 16 }}>
                      {val}
                    </span>
                  </div>
                ))}
              </div>

            </>
          ) : (
            <p className="text-white/40 text-center p-6" style={{ fontFamily: PIXEL_BODY, fontSize: 16 }}>
              Select a hero.
            </p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
