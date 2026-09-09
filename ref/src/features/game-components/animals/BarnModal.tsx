

import React, { useContext, useState } from "react";
import Decimal from "decimal.js-light";

import { Box } from "@/components/ui/Box";
import { Button } from "@/components/ui/Button";
import {
  ModalShell,
  ModalTitleBar,
  ActionDock,
} from "@/components/ui/modal";
import { ShopShowcase, ShowcaseChip } from "@/components/ui/ShopShowcase";
import { ShopShelf } from "@/components/ui/ShopShelf";

import { ANIMALS } from "@/features/types/gameplay/craftables";
import { ITEM_DETAILS } from "@/features/types/item-details";
import { useGameStore } from "@/features/game-stores/useGameStore";
import { ToastContext } from "@/context/ToastContext";

const chicken  = "/assets/animals/chicken.png";
const lockIcon = "/assets/icons/lock.png";

type AnimalName = keyof typeof ANIMALS;

interface Props {
  show: boolean;
  onClose: () => void;
}

/**
 * Barn modal — buy animals using Gold (inventory resource, not coin balance).
 * Each animal has a farmLevelRequirement; locked animals show a lock state.
 */
export const BarnModal: React.FC<Props> = ({ show, onClose }) => {
  const animalNames = Object.keys(ANIMALS) as AnimalName[];
  const [selected, setSelected] = useState<AnimalName>(animalNames[0]);

  const { addToast } = useContext(ToastContext);
  const state    = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const inventory = state.items;
  const farmLevel = state.farmLevel ?? 1;

  const animal             = ANIMALS[selected];
  const coinCost           = (animal.price ?? new Decimal(0)).toNumber();
  const farmLevelRequired  = animal.farmLevelRequirement ?? 1;
  const isLocked           = farmLevel < farmLevelRequired;

  const coinsOwned = useGameStore((s) => new Decimal(s.state.coins ?? 0).toNumber());
  const lessFunds  = coinsOwned < coinCost;

  const buy = () => {
    dispatch({ type: "item.crafted", item: selected, amount: 1 });
    addToast(`-${coinCost} coins → +1 ${selected}`);
  };

  return (
    <ModalShell
      show={show}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          icon={chicken}
          title="Barn"
          subtitle="Buy animals with Coins"
          onClose={onClose}
        />
      }
      actionDock={
        <ActionDock
          info={
            <span className="truncate text-[10px] text-shadow text-gray-400">
              Coins: {coinsOwned}
            </span>
          }
        >
          {isLocked ? (
            <div className="flex items-center gap-1.5 px-2">
              <img src={lockIcon} className="h-4 pixelated" alt="" />
              <span className="text-xs text-shadow text-red-400">
                Farm Lv {farmLevelRequired} required
              </span>
            </div>
          ) : (
            <Button disabled={lessFunds} className="text-xs px-3 w-auto" onClick={buy}>
              Buy for {coinCost} Coins
            </Button>
          )}
        </ActionDock>
      }
    >
      <ShopShowcase
        image={ITEM_DETAILS[selected]?.image}
        name={selected}
        description={animal.description}
        chips={
          <>
            <ShowcaseChip icon="/assets/icons/token.png" danger={lessFunds && !isLocked}>
              {`${coinCost} Coins`}
            </ShowcaseChip>
            {isLocked && (
              <ShowcaseChip icon={lockIcon}>
                {`Farm Lv ${farmLevelRequired}`}
              </ShowcaseChip>
            )}
          </>
        }
      />

      <ShopShelf>
        {animalNames.map((name) => {
          const req    = ANIMALS[name].farmLevelRequirement ?? 1;
          const locked = farmLevel < req;
          return (
            <Box
              isSelected={selected === name}
              key={name}
              onClick={() => setSelected(name)}
              image={ITEM_DETAILS[name]?.image}
              count={inventory[name]}
              locked={locked}
            />
          );
        })}
      </ShopShelf>
    </ModalShell>
  );
};
