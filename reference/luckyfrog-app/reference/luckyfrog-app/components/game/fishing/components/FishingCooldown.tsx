import React, { useEffect, useRef, useState } from "react";
import classNames from "classnames";

import { InnerPanel } from "@/components/ui/Panel";
import { Bar } from "@/components/ui/ProgressBar";
import { useGameStore } from "@/lib/stores/game/useGameStore";
import {
  FISHING_BASE_COOLDOWN_MS,
  FISHING_MIN_COOLDOWN_MS,
} from "@/shared/game/constants";
import { getImageSrc } from "@/lib/utils/getImageSrc";

const fishingRodImport = "/assets/tools/fishing_rod.png";

const fishingRodSrc = getImageSrc(fishingRodImport);

export const FishingCooldown: React.FC = () => {
  const fishing   = useGameStore((s) => s.state.fishing);
  const fishSpeed = useGameStore((s) => s.state.bonus?.fishSpeed ?? 0);

  const [castStartAt,    setCastStartAt]    = useState<number>(0);
  const [castDurationMs, setCastDurationMs] = useState<number>(0);
  const [nearZone,       setNearZone]       = useState(false);
  const [guardMessage,   setGuardMessage]   = useState<string | null>(null);
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const onStart = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const duration = typeof detail.castDurationMs === "number" ? detail.castDurationMs : 3800;
      setCastStartAt(Date.now());
      setCastDurationMs(duration);
    };
    const onCaught = () => { setCastStartAt(0); setCastDurationMs(0); };
    window.addEventListener("phaser-fishing-start",  onStart);
    window.addEventListener("phaser-fishing-open",   onCaught);
    return () => {
      window.removeEventListener("phaser-fishing-start",  onStart);
      window.removeEventListener("phaser-fishing-open",   onCaught);
    };
  }, []);

  useEffect(() => {
    const onEnter = () => setNearZone(true);
    const onExit  = () => setNearZone(false);
    window.addEventListener("phaser-fishing-zone-enter", onEnter);
    window.addEventListener("phaser-fishing-zone-exit",  onExit);
    return () => {
      window.removeEventListener("phaser-fishing-zone-enter", onEnter);
      window.removeEventListener("phaser-fishing-zone-exit",  onExit);
    };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const msg = detail.reason === "stamina" ? "Not enough stamina" : "Not ready yet";
      setGuardMessage(msg);
      setTimeout(() => setGuardMessage(null), 2500);
    };
    window.addEventListener("phaser-fishing-cooldown", handler);
    return () => window.removeEventListener("phaser-fishing-cooldown", handler);
  }, []);

  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 100);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const now = Date.now();
  const effectiveCooldown = Math.max(FISHING_MIN_COOLDOWN_MS, FISHING_BASE_COOLDOWN_MS * (1 - fishSpeed));
  const lastCastAt  = fishing?.lastCastAt ?? 0;
  const cdElapsed   = now - lastCastAt;
  const cdRemaining = Math.max(0, effectiveCooldown - cdElapsed);
  const onCooldown  = cdRemaining > 0;

  const isCasting      = castStartAt > 0 && castDurationMs > 0;
  const castElapsed    = isCasting ? Math.min(castDurationMs, now - castStartAt) : 0;
  const castRemaining  = isCasting ? Math.max(0, castDurationMs - castElapsed) : 0;

  if (!isCasting && (!nearZone || !onCooldown) && !guardMessage) return null;

  let label: string;
  let percentage: number;
  let seconds: number;

  if (guardMessage) {
    label = guardMessage; percentage = 0; seconds = 0;
  } else if (isCasting) {
    percentage = Math.min(100, (castElapsed / castDurationMs) * 100);
    seconds    = Math.ceil(castRemaining / 1000);
    label      = seconds > 0 ? `Casting... ${seconds}s` : "Reeling in...";
  } else {
    percentage = Math.min(100, (cdElapsed / effectiveCooldown) * 100);
    seconds    = Math.ceil(cdRemaining / 1000);
    label      = `Ready in ${seconds}s`;
  }

  return (
    <InnerPanel
      className={classNames("fixed bottom-4 left-1/2 -translate-x-1/2 z-50", "flex items-center gap-2 px-3 py-2")}
      aria-label="Fishing progress"
    >
      <img src={fishingRodSrc} alt="Fishing rod" className="w-8 h-8" style={{ imageRendering: "pixelated" }} />
      <div className="flex flex-col items-start gap-0.5">
        {guardMessage ? (
          <span className="text-xs text-red-400 text-shadow whitespace-nowrap">{label}</span>
        ) : (
          <>
            <span className="text-xs text-white text-shadow whitespace-nowrap">{label}</span>
            <Bar percentage={percentage} seconds={seconds} />
          </>
        )}
      </div>
    </InnerPanel>
  );
};
