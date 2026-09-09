"use client";

import React, { useContext, useState } from "react";
import Decimal from "decimal.js-light";

import { Box } from "@/components/ui/Box";
import { Button } from "@/components/ui/Button";
import { ModalShell, ModalTitleBar, ActionDock } from "@/components/ui/modal";
import { ShopShowcase, ShowcaseChip } from "@/components/game/shops/components/ShopShowcase";
import { ShopShelf } from "@/components/game/shops/components/ShopShelf";

import { ToastContext } from "@/context/ToastContext";
import { Context } from "@/context/GameContext";
import { ITEM_DETAILS } from "@/shared/types/gameplay/images";
import { Craftable } from "@/shared/types/gameplay/craftables";
import { InventoryItemName } from "@/shared/types/gameplay/game";
import { useGameStore } from "@/lib/stores/game/useGameStore";

const token = "/assets/icons/token.png";

interface Props {
  show: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: string;
  items: Partial<Record<InventoryItemName, Craftable>>;
  /** Primary action label — "Craft" (Blacksmith) or "Buy" (Barn) */
  actionLabel?: string;
  /** Show a x10 bulk action button */
  isBulk?: boolean;
}

/**
 * Shared craft/buy shop on the new modal shell — Showcase + Shelf layout
 * (docs/modal-redesign-plan.md §2.3). Used by Barn and Blacksmith.
 * Logic carried over from the old features/blacksmith CraftingItems.
 */
export const CraftShop: React.FC<Props> = ({
  show,
  onClose,
  title,
  subtitle,
  icon,
  items,
  actionLabel = "Craft",
  isBulk = false,
}) => {
  const availableItems = Object.values(items).filter(
    (item): item is Craftable => item !== undefined
  );
  const [selected, setSelected] = useState<Craftable | undefined>(availableItems[0]);
  const { addToast } = useContext(ToastContext);
  const { shortcutItem } = useContext(Context);
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);

  const inventory = state.inventory;

  if (!selected) {
    return (
      <ModalShell
        show={show}
        onClose={onClose}
        tier="panel"
        titleBar={
          <ModalTitleBar icon={icon} title={title} subtitle={subtitle} onClose={onClose} />
        }
      >
        <div className="flex min-h-48 items-center justify-center p-6 text-center">
          <p className="text-sm opacity-70">No collectibles are available to forge yet.</p>
        </div>
      </ModalShell>
    );
  }

  const lessIngredients = (amount = 1) =>
    selected.ingredients.some((ingredient) => {
      const need =
        ingredient.amount instanceof Decimal
          ? ingredient.amount.toNumber()
          : Number(ingredient.amount);
      const have =
        inventory[ingredient.item] instanceof Decimal
          ? (inventory[ingredient.item] as Decimal).toNumber()
          : Number(inventory[ingredient.item] ?? 0);
      return need * amount > have;
    });

  const selectedPrice = selected.price ?? new Decimal(0);

  const lessFunds = (amount = 1) =>
    new Decimal(state.balance).lessThan(selectedPrice.mul(amount));

  const craft = (amount = 1) => {
    dispatch({ type: "item.crafted", item: selected.name, amount });
    addToast("$LFRG -" + selectedPrice.mul(amount).toString());
    selected.ingredients.forEach((ingredient) => {
      const amt =
        ingredient.amount instanceof Decimal
          ? ingredient.amount.toNumber()
          : Number(ingredient.amount);
      addToast(ingredient.item + " -" + amt * amount);
    });
    shortcutItem(selected.name);
  };

  const ownedRaw = inventory[selected.name];
  const owned =
    ownedRaw instanceof Decimal ? ownedRaw.toNumber() : Number(ownedRaw ?? 0);

  return (
    <ModalShell
      show={show}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar icon={icon} title={title} subtitle={subtitle} onClose={onClose} />
      }
      actionDock={
        <ActionDock
          info={
            <span className="truncate">
              Owned: {owned} · Balance ${new Decimal(state.balance).toDecimalPlaces(3, Decimal.ROUND_DOWN).toString()}
            </span>
          }
        >
          {selected.disabled ? (
            <span className="text-xs text-shadow px-2">Locked</span>
          ) : (
            <>
              <Button
                disabled={lessFunds() || lessIngredients()}
                className="text-xs px-3 w-auto"
                onClick={() => craft()}
              >
                {actionLabel}
                {isBulk ? " 1" : ""}
              </Button>
              {isBulk && (
                <Button
                  disabled={lessFunds(10) || lessIngredients(10)}
                  className="text-xs px-3 w-auto whitespace-nowrap"
                  onClick={() => craft(10)}
                >
                  {actionLabel} 10
                </Button>
              )}
            </>
          )}
        </ActionDock>
      }
    >
      <ShopShowcase
        image={ITEM_DETAILS[selected.name]?.image}
        name={selected.name}
        description={selected.description}
        chips={
          <>
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
            <ShowcaseChip icon={token} danger={lessFunds()}>
              {`$${selectedPrice.toNumber()}`}
            </ShowcaseChip>
          </>
        }
      />

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
