

import React, { useState, useCallback } from "react";
import Decimal from "decimal.js-light";
import { FOODS, FOOD_EFFECTS, FOOD_FARM_LEVEL_REQUIREMENT } from "@/features/types/gameplay/craftables";
import type { Food } from "@/features/types/gameplay/craftables";
import type { InventoryItemName } from "@/features/types/gameplay/game";
import { ITEM_DETAILS } from "@/features/types/item-details";
import { useGameStore } from "@/features/game-stores/useGameStore";
import { ModalShell, ModalTitleBar, ActionDock } from "@/components/ui/modal";
import { Button } from "@/components/ui/Button";
import { Box } from "@/components/ui/Box";
import { ShopShowcase, ShowcaseChip } from "@/components/ui/ShopShowcase";
import { ShopShelf } from "@/components/ui/ShopShelf";

const kitchenIcon = "/assets/buildings/kitchen_building.png";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getItemImage(name: string): string {
  const detail = ITEM_DETAILS[name as InventoryItemName];
  return detail?.image ?? "/assets/icons/token.png";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  show: boolean;
  onClose: () => void;
}

export const KitchenModal: React.FC<Props> = ({ show, onClose }) => {
  const inventory  = useGameStore((s) => s.state?.items ?? {});
  const farmLevel  = useGameStore((s) => s.state?.farmLevel ?? 1);
  const send       = useGameStore((s) => s.send);

  const foods    = FOODS();
  const foodKeys = Object.keys(foods) as Food[];

  const [selected,  setSelected]  = useState<Food>(foodKeys[0]);
  const [cooking,   setCooking]   = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const isUnlocked = useCallback(
    (food: Food) => farmLevel >= (FOOD_FARM_LEVEL_REQUIREMENT[food] ?? 1),
    [farmLevel],
  );

  // Extra Wood fuel cost (1 per cook) shown alongside ingredients
  const getIngredients = useCallback(
    (food: Food) => {
      const base = foods[food].ingredients.map(({ item, amount }) => ({
        item: item as InventoryItemName,
        amount,
        have: new Decimal(
          (inventory[item as InventoryItemName] as Decimal | undefined) ?? 0,
        ),
      }));
      // Append the mandatory 1x Wood fuel
      const woodHave = new Decimal((inventory["Wood"] as Decimal | undefined) ?? 0);
      base.push({ item: "Wood" as InventoryItemName, amount: new Decimal(1), have: woodHave });
      return base;
    },
    [foods, inventory],
  );

  const canCook = useCallback(
    (food: Food) =>
      isUnlocked(food) &&
      getIngredients(food).every(({ have, amount }) => have.gte(amount)),
    [getIngredients, isUnlocked],
  );

  const handleCook = useCallback(async () => {
    if (!selected || !canCook(selected) || cooking) return;
    setCooking(true);
    setStatusMsg(null);
    try {
      send({ type: "food.cook", food: selected, amount: 1 });
    } finally {
      setCooking(false);
    }
  }, [selected, canCook, cooking, send]);

  const selectedIngredients = getIngredients(selected);
  const selectedUnlocked    = isUnlocked(selected);
  const selectedCookable    = canCook(selected);
  const requiredLevel       = FOOD_FARM_LEVEL_REQUIREMENT[selected] ?? 1;
  const effects             = FOOD_EFFECTS[selected];

  const statusText = statusMsg
    ?? (cooking ? `Cooking ${selected}...`
    : selectedUnlocked ? "Kitchen idle"
    : `Locked — requires Farm Level ${requiredLevel}`);

  return (
    <ModalShell
      show={show}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          icon={kitchenIcon}
          title="Kitchen"
          subtitle="Cook food"
          onClose={onClose}
        />
      }
      actionDock={
        <ActionDock
          info={
            <span
              className="text-[9px] text-white/70"
              style={{ fontFamily: "var(--font-press-start)" }}
            >
              {statusText}
            </span>
          }
        >
          <Button
            onClick={handleCook}
            disabled={!selectedCookable || cooking || !selectedUnlocked}
            className="text-xs px-4 w-auto"
          >
            {cooking ? "Cooking..." : "Cook"}
          </Button>
        </ActionDock>
      }
    >
      {/* Selected recipe detail */}
      <ShopShowcase
        image={ITEM_DETAILS[selected as InventoryItemName]?.image}
        name={selected}
        description={ITEM_DETAILS[selected as InventoryItemName]?.description}
        chips={
          <>
            {/* Ingredient chips (shown when unlocked) */}
            {selectedUnlocked && selectedIngredients.map(({ item, amount, have }) => (
              <ShowcaseChip
                key={item}
                icon={getItemImage(item)}
                danger={have.lt(amount)}
              >
                {amount.toNumber()}
              </ShowcaseChip>
            ))}

            {/* Lock chip shown when not yet unlocked */}
            {!selectedUnlocked && (
              <ShowcaseChip icon="/assets/buildings/house_building.png">
                Lv {requiredLevel}
              </ShowcaseChip>
            )}

            {/* HP effect chip */}
            {(effects as { hp?: number }).hp != null && (effects as { hp?: number }).hp! > 0 && (
              <ShowcaseChip icon="/assets/icons/heart.png">
                +{(effects as { hp?: number }).hp} HP
              </ShowcaseChip>
            )}
          </>
        }
      />

      {/* Recipe grid */}
      <ShopShelf>
        {foodKeys.map((food) => {
          const inv   = inventory[food as InventoryItemName];
          const count = inv instanceof Decimal ? inv : new Decimal(inv ?? 0);
          const locked = !isUnlocked(food);
          return (
            <Box
              key={food}
              image={getItemImage(food)}
              isSelected={food === selected}
              count={count.gt(0) ? count : undefined}
              onClick={() => { setSelected(food); setStatusMsg(null); }}
              locked={locked}
            />
          );
        })}
      </ShopShelf>
    </ModalShell>
  );
};
