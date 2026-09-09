import React, { useEffect, useState } from "react";
import classNames from "classnames";

import { getImageSrc } from "@/lib/utils/getImageSrc";
import { InnerPanel } from "@/components/ui/Panel";
import { useGameStore } from "@/lib/stores/game/useGameStore";
import {
  CHICKEN_TIME_TO_EGG, CHICKEN_RE_HUNGER_DELAY,
  COW_TIME_TO_MILK, COW_RE_HUNGER_DELAY,
  SHEEP_TIME_TO_WOOL, SHEEP_RE_HUNGER_DELAY,
} from "@/shared/game/constants";
import type { GameState } from "@/shared/types/gameplay/game";

const chickenImgImport = "/assets/animals/animals/chicken.gif";
const cowImgImport = "/assets/animals/animals/cow.gif";
const sheepImgImport = "/assets/animals/animals/sheep.gif";

function countHungryChickens(state: GameState, now: number) {
  const total = Number(state.inventory.Chicken ?? 0);
  if (!total) return 0;
  return Array.from({ length: total }, (_, i) => {
    const c = state.chickens[i];
    return !c?.fedAt || now - c.fedAt >= CHICKEN_TIME_TO_EGG + CHICKEN_RE_HUNGER_DELAY;
  }).filter(Boolean).length;
}

function countHungryCows(state: GameState, now: number) {
  const total = Number(state.inventory.Cow ?? 0);
  if (!total) return 0;
  return Array.from({ length: total }, (_, i) => {
    const c = state.cows[i];
    return !c?.fedAt || now - c.fedAt >= COW_TIME_TO_MILK + COW_RE_HUNGER_DELAY;
  }).filter(Boolean).length;
}

function countHungrySheep(state: GameState, now: number) {
  const total = Number(state.inventory.Sheep ?? 0);
  if (!total) return 0;
  return Array.from({ length: total }, (_, i) => {
    const s = state.sheep[i];
    return !s?.fedAt || now - s.fedAt >= SHEEP_TIME_TO_WOOL + SHEEP_RE_HUNGER_DELAY;
  }).filter(Boolean).length;
}

function countReadyChickens(state: GameState, now: number) {
  const total = Number(state.inventory.Chicken ?? 0);
  if (!total) return 0;
  return Array.from({ length: total }, (_, i) => {
    const c = state.chickens[i];
    if (!c?.fedAt) return false;
    const elapsed = now - c.fedAt;
    return elapsed >= CHICKEN_TIME_TO_EGG && elapsed < CHICKEN_TIME_TO_EGG + CHICKEN_RE_HUNGER_DELAY;
  }).filter(Boolean).length;
}

function countReadyCows(state: GameState, now: number) {
  const total = Number(state.inventory.Cow ?? 0);
  if (!total) return 0;
  return Array.from({ length: total }, (_, i) => {
    const c = state.cows[i];
    if (!c?.fedAt) return false;
    const elapsed = now - c.fedAt;
    return elapsed >= COW_TIME_TO_MILK && elapsed < COW_TIME_TO_MILK + COW_RE_HUNGER_DELAY;
  }).filter(Boolean).length;
}

function countReadySheep(state: GameState, now: number) {
  const total = Number(state.inventory.Sheep ?? 0);
  if (!total) return 0;
  return Array.from({ length: total }, (_, i) => {
    const s = state.sheep[i];
    if (!s?.fedAt) return false;
    const elapsed = now - s.fedAt;
    return elapsed >= SHEEP_TIME_TO_WOOL && elapsed < SHEEP_TIME_TO_WOOL + SHEEP_RE_HUNGER_DELAY;
  }).filter(Boolean).length;
}

const AnimalBadge: React.FC<{ src: string; alt: string; count: number; badgeClassName: string; badgeAriaLabel: string }> = ({
  src, alt, count, badgeClassName, badgeAriaLabel,
}) => {
  if (count === 0) return null;
  return (
    <div className="relative flex items-center justify-center">
      <img src={src} alt={alt} className="w-8 h-8" style={{ imageRendering: "pixelated" }} />
      <span
        className={classNames("absolute -top-1 -right-1 rounded-full flex items-center justify-center font-bold leading-none", badgeClassName)}
        style={{ fontSize: "9px", minWidth: "14px", height: "14px", padding: "0 2px" }}
        aria-label={badgeAriaLabel}
      >
        {count}
      </span>
    </div>
  );
};

const AlertRow: React.FC<{ label: string; labelClassName: string; children: React.ReactNode }> = ({ label, labelClassName, children }) => (
  <div className="flex items-center gap-2">
    <span className={classNames("text-xs whitespace-nowrap text-shadow", labelClassName)}>{label}</span>
    <div className="flex items-center gap-2">{children}</div>
  </div>
);

export const AnimalAlerts: React.FC = () => {
  const state = useGameStore((s) => s.state);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now             = Date.now();
  const hungryChickens  = countHungryChickens(state, now);
  const hungryCows      = countHungryCows(state, now);
  const hungrySheep     = countHungrySheep(state, now);
  const totalHungry     = hungryChickens + hungryCows + hungrySheep;
  const readyChickens   = countReadyChickens(state, now);
  const readyCows       = countReadyCows(state, now);
  const readySheep      = countReadySheep(state, now);
  const totalReady      = readyChickens + readyCows + readySheep;

  if (totalHungry === 0 && totalReady === 0) return null;

  const chickenSrc = getImageSrc(chickenImgImport);
  const cowSrc     = getImageSrc(cowImgImport);
  const sheepSrc   = getImageSrc(sheepImgImport);

  return (
    <InnerPanel
      className={classNames("fixed bottom-4 left-1/2 -translate-x-1/2 z-50", "flex flex-col gap-1 px-3 py-2")}
      aria-label="Animal status alerts"
    >
      {totalHungry > 0 && (
        <AlertRow label="Hungry!" labelClassName="text-red-400">
          <AnimalBadge src={chickenSrc} alt="Chicken" count={hungryChickens} badgeClassName="bg-red-600 text-white" badgeAriaLabel={`${hungryChickens} hungry chickens`} />
          <AnimalBadge src={cowSrc}     alt="Cow"     count={hungryCows}     badgeClassName="bg-red-600 text-white" badgeAriaLabel={`${hungryCows} hungry cows`} />
          <AnimalBadge src={sheepSrc}   alt="Sheep"   count={hungrySheep}    badgeClassName="bg-red-600 text-white" badgeAriaLabel={`${hungrySheep} hungry sheep`} />
        </AlertRow>
      )}
      {totalReady > 0 && (
        <AlertRow label="Ready!" labelClassName="text-yellow-300">
          <AnimalBadge src={chickenSrc} alt="Chicken" count={readyChickens} badgeClassName="bg-yellow-400 text-black" badgeAriaLabel={`${readyChickens} chickens ready`} />
          <AnimalBadge src={cowSrc}     alt="Cow"     count={readyCows}     badgeClassName="bg-yellow-400 text-black" badgeAriaLabel={`${readyCows} cows ready`} />
          <AnimalBadge src={sheepSrc}   alt="Sheep"   count={readySheep}    badgeClassName="bg-yellow-400 text-black" badgeAriaLabel={`${readySheep} sheep ready`} />
        </AlertRow>
      )}
    </InnerPanel>
  );
};
