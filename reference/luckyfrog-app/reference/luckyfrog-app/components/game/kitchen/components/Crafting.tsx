"use client";

import React, { useContext, useEffect, useState } from "react";
import Decimal from "decimal.js-light";

import { Box } from "@/components/ui/Box";
import { Button } from "@/components/ui/Button";
import { ModalShell, ModalTitleBar, ActionDock } from "@/components/ui/modal";
import { ShopShowcase, ShowcaseChip } from "@/components/game/shops/components/ShopShowcase";
import { ShopShelf } from "@/components/game/shops/components/ShopShelf";

import { ToastContext } from "@/context/ToastContext";
import { Context } from "@/context/GameContext";
import { ITEM_DETAILS } from "@/shared/types/gameplay/images";
import { Craftable, Food, FOODS } from "@/shared/types/gameplay/craftables";
import { useGameStore } from "@/lib/stores/game/useGameStore";

const timerIcon = "/assets/icons/timer.png";
const foodIcon = "/assets/crops/wheat/flour.png";

function formatTime(seconds: number): string {
  if (seconds <= 0) return "Ready";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

interface Props {
  show: boolean;
  onClose: () => void;
}

/**
 * Kitchen on the new modal shell — Showcase + Shelf with a cook-time chip
 * and cooking progress in the showcase (docs/modal-redesign-plan.md §2.3,
 * §3). Cooking logic carried over from the old kitchen CraftingItems.
 */
export const Crafting: React.FC<Props> = ({ show, onClose }) => {
  const items = FOODS();
  const [selected, setSelected] = useState<Craftable>(Object.values(items)[0] as Craftable);
  const [now, setNow] = useState<number>(Date.now());

  const { addToast } = useContext(ToastContext);
  const { shortcutItem } = useContext(Context);
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);

  const inventory = state.inventory;
  const cooking = state.cooking;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const isCooking = cooking !== null;
  const isThisCooking = isCooking && cooking!.item === selected.name;
  const isOtherCooking = isCooking && cooking!.item !== selected.name;
  const elapsedMs = isCooking ? now - cooking!.startedAt : 0;
  const durationMs = isCooking ? cooking!.duration * 1000 : 0;
  const remainingSec = isCooking ? Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000)) : 0;
  const isReady = isThisCooking && remainingSec === 0;
  const progressPct = isThisCooking ? Math.min(100, (elapsedMs / durationMs) * 100) : 0;

  const lessIngredients = () =>
    selected.ingredients.some((ingredient) => {
      const need =
        ingredient.amount instanceof Decimal
          ? ingredient.amount.toNumber()
          : Number(ingredient.amount);
      const have =
        inventory[ingredient.item] instanceof Decimal
          ? (inventory[ingredient.item] as Decimal).toNumber()
          : Number(inventory[ingredient.item] ?? 0);
      return need > have;
    });

  const startCook = () => {
    dispatch({ type: "food.startCooking", item: selected.name as Food });
    selected.ingredients.forEach((ingredient) => {
      const amount =
        ingredient.amount instanceof Decimal
          ? ingredient.amount.toNumber()
          : Number(ingredient.amount);
      addToast(`${ingredient.item} -${amount}`);
    });
    shortcutItem(selected.name);
  };

  const collect = () => {
    dispatch({ type: "food.collectCooked" });
    addToast(`+1 ${cooking!.item}`);
  };

  const renderAction = () => {
    if (isThisCooking) {
      return isReady ? (
        <Button className="text-xs px-3 w-auto" onClick={collect}>
          Collect
        </Button>
      ) : (
        <Button disabled className="text-xs px-3 w-auto whitespace-nowrap">
          Cooking... {formatTime(remainingSec)}
        </Button>
      );
    }
    if (isOtherCooking) {
      return (
        <Button disabled className="text-xs px-3 w-auto whitespace-nowrap">
          Kitchen busy
        </Button>
      );
    }
    return (
      <Button
        disabled={isCooking || lessIngredients()}
        className="text-xs px-3 w-auto"
        onClick={startCook}
      >
        Cook
      </Button>
    );
  };

  return (
    <ModalShell
      show={show}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          icon={foodIcon}
          title="Kitchen"
          subtitle="Cook food"
          onClose={onClose}
        />
      }
      actionDock={
        <ActionDock
          info={
            isCooking ? (
              <span className="truncate">
                Cooking {cooking!.item}
                {!isReady && ` · ${formatTime(remainingSec)}`}
              </span>
            ) : (
              <span className="truncate">Kitchen idle</span>
            )
          }
        >
          {renderAction()}
        </ActionDock>
      }
    >
      <ShopShowcase
        image={ITEM_DETAILS[selected.name]?.image}
        name={selected.name}
        description={selected.description}
        chips={
          !isThisCooking && (
            <>
              {selected.cookTime && (
                <ShowcaseChip icon={timerIcon}>
                  {formatTime(selected.cookTime)}
                </ShowcaseChip>
              )}
              {selected.ingredients.map((ingredient, index) => {
                const detail = ITEM_DETAILS[ingredient.item];
                const need =
                  ingredient.amount instanceof Decimal
                    ? ingredient.amount.toNumber()
                    : Number(ingredient.amount);
                const have =
                  inventory[ingredient.item] instanceof Decimal
                    ? (inventory[ingredient.item] as Decimal).toNumber()
                    : Number(inventory[ingredient.item] ?? 0);
                return (
                  <ShowcaseChip key={index} icon={detail?.image} danger={have < need}>
                    {need}
                  </ShowcaseChip>
                );
              })}
            </>
          )
        }
      >
        {isThisCooking && (
          <div className="w-full mt-1">
            <div className="flex justify-between text-[10px] text-shadow mb-1">
              <span>{isReady ? "Ready to collect!" : "Cooking..."}</span>
              {!isReady && <span>{formatTime(remainingSec)}</span>}
            </div>
            <div className="w-full bg-brown-600 rounded-sm h-2 border border-white border-opacity-30">
              <div
                className="h-full rounded-sm transition-all"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: isReady ? "#4ade80" : "#f97316",
                }}
              />
            </div>
          </div>
        )}
      </ShopShowcase>

      <ShopShelf>
        {Object.values(items).map(
          (item) =>
            item && (
              <Box
                isSelected={selected.name === item.name}
                key={item.name}
                onClick={() => setSelected(item)}
                image={ITEM_DETAILS[item.name]?.image}
                count={inventory[item.name]}
              />
            )
        )}
      </ShopShelf>
    </ModalShell>
  );
};
