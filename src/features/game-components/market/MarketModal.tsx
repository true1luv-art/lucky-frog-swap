

import React, { useContext, useMemo, useState } from "react";
import Decimal from "decimal.js-light";

import { Box } from "@/components/ui/Box";
import {
  ModalShell,
  ModalTitleBar,
  NavRail,
  ActionDock,
} from "@/components/ui/modal";
import { ShopShowcase, ShowcaseChip } from "@/components/ui/ShopShowcase";
import { ShopShelf } from "@/components/ui/ShopShelf";
import { Button } from "@/components/ui/Button";

import { secondsToMidString } from "@/features/utils/time";
import { Context } from "@/context/GameContext";
import { Craftable, ANIMALS, FOODS, Food } from "@/features/types/gameplay/craftables";
import { CropName, CROPS, SEEDS, SeedName } from "@/features/types/gameplay/crops";
import { ITEM_DETAILS } from "@/features/types/item-details";
import { ToastContext } from "@/context/ToastContext";
import { getCropTime } from "@/features/events/plant/plant";
import { useGameStore } from "@/features/game-stores/useGameStore";
import { FARM_LEVEL_UNLOCKS } from "@/features/game/farm-level";
import { getSellPrice, CROP_SELL_PRICES } from "@/features/game/sell-prices";
import type { ProduceName } from "@/features/events/sell/sellProduce";

const timer       = "/assets/icons/timer.png";
const basket      = "/assets/icons/basket.png";
const seedsIcon   = "/assets/icons/seeds.png";
const lockIcon    = "/assets/icons/lock.png";
const coinIcon    = "/assets/icons/token.png";
const chickenIcon = "/assets/animals/chicken.png";
const cropIcon    = "/assets/crops/potato/crop.png";
const foodIcon    = "/assets/foods/baked_potato.png";
const produceIcon = "/assets/resources/egg.png";

type Tab = "seeds" | "animals" | "sell" | "food" | "produce";
type AnimalName = keyof typeof ANIMALS;

const PRODUCE_NAMES: ProduceName[] = ["Egg", "Milk", "Wool"];

const NAV_ITEMS = [
  { id: "seeds",   label: "Seeds",   icon: seedsIcon   },
  { id: "animals", label: "Animals", icon: chickenIcon  },
  { id: "sell",    label: "Crops",   icon: cropIcon     },
  { id: "food",    label: "Food",    icon: foodIcon     },
  { id: "produce", label: "Produce", icon: produceIcon  },
];



interface Props {
  show: boolean;
  onClose: () => void;
}

export const MarketModal: React.FC<Props> = ({ show, onClose }) => {
  const [tab, setTab]                         = useState<Tab>("seeds");
  const [selectedSeedName, setSelectedSeedName] = useState<SeedName>("Potato Seed");
  const animalNames                           = Object.keys(ANIMALS) as AnimalName[];
  const [selectedAnimal, setSelectedAnimal]   = useState<AnimalName>(animalNames[0]);

  const { addToast }     = useContext(ToastContext);
  const { shortcutItem } = useContext(Context);
  const state            = useGameStore((s) => s.state);
  const dispatch         = useGameStore((s) => s.dispatch);
  const inventory        = state.items;
  const farmLevel        = state.farmLevel ?? 1;

  const seeds  = useMemo(() => SEEDS(), []);
  const crops  = useMemo(() => CROPS(), []);
  const foods  = useMemo(() => FOODS(), []);

  // ── Sell (crops) state ───────────────────────────────────────────────
  const cropNames        = Object.keys(crops) as CropName[];
  const [selectedCropName, setSelectedCropName] = useState<CropName>(cropNames[0] ?? "Potato");
  const selectedCrop     = crops[selectedCropName];
  const cropSellPrice    = getSellPrice(selectedCropName);
  const cropQty          = new Decimal((inventory as Record<string, Decimal>)[selectedCropName] ?? 0).toNumber();

  const sellCrop = (amount = 1) => {
    dispatch({ type: "item.sell", item: selectedCropName, amount });
    addToast(`+${cropSellPrice * amount} coins`);
  };

  // ── Sell (food) state ─────────────────────────────────────────────────
  const foodNames        = Object.keys(foods) as Food[];
  const [selectedFood, setSelectedFood] = useState<Food>(foodNames[0] ?? "Baked Potato");
  const foodSellPrice    = getSellPrice(selectedFood);
  const foodQty          = new Decimal((inventory as Record<string, Decimal>)[selectedFood] ?? 0).toNumber();

  const sellFood = (amount = 1) => {
    dispatch({ type: "food.sell", item: selectedFood, amount });
    addToast(`+${foodSellPrice * amount} coins`);
  };

  // ── Sell (produce) state ──────────────────────────────────────────────
  const [selectedProduce, setSelectedProduce] = useState<ProduceName>("Egg");
  const produceSellPrice  = getSellPrice(selectedProduce);
  const produceQty        = new Decimal((inventory as Record<string, Decimal>)[selectedProduce] ?? 0).toNumber();

  const sellProduce = (amount = 1) => {
    dispatch({ type: "produce.sell", item: selectedProduce, amount });
    addToast(`+${produceSellPrice * amount} coins`);
  };

  const selectedSeed = seeds[selectedSeedName];

  // ── Seeds / Buy tab ──────────────────────────────────────────────────
  // Seed is locked if its crop requires a higher farm level than the player has.
  const seedCropName  = selectedSeed.name.split(" ")[0] as CropName;
  const seedCrop      = crops[seedCropName];
  // Find the farm level at which this seed is unlocked from the unlock table
  const seedFarmLevel = (() => {
    for (let lv = 1; lv <= 10; lv++) {
      const unlocks = FARM_LEVEL_UNLOCKS[lv];
      if (unlocks?.seeds?.includes(selectedSeed.name as SeedName)) return lv;
    }
    return 1;
  })();
  const seedLocked = farmLevel < seedFarmLevel;

  // Seed cost: deducts resource ingredients (if any) defined on the craftable.
  const seedIngredients = selectedSeed.ingredients ?? [];

  const hasIngredients = seedIngredients.every(({ item, amount }) =>
    new Decimal((inventory as Record<string, Decimal>)[item] ?? 0).greaterThanOrEqualTo(amount),
  );

  const buy = (amount = 1) => {
    dispatch({ type: "item.crafted", item: selectedSeed.name, amount });
    shortcutItem(selectedSeed.name);
    addToast(`+${amount}x ${selectedSeed.name}`);
  };

  // ── Animals tab ──────────────────────────────────────────────────────
  const animal            = ANIMALS[selectedAnimal];
  const animalCoinCost    = (animal.price ?? new Decimal(0)).toNumber();
  const animalLevelReq    = animal.farmLevelRequirement ?? 1;
  const animalLocked      = farmLevel < animalLevelReq;
  const coinsOwned        = useGameStore((s) => new Decimal(s.state.coins ?? 0).toNumber());
  const lessFunds         = coinsOwned < animalCoinCost;

  const buyAnimal = () => {
    dispatch({ type: "item.crafted", item: selectedAnimal, amount: 1 });
    addToast(`-${animalCoinCost} coins → +1 ${selectedAnimal}`);
  };

  // ── Seeds (buy) body ─────────────────────────────────────────────────
  const seedsBody = (
    <div className="flex flex-col gap-2">
      <ShopShowcase
        image={ITEM_DETAILS[selectedSeed.name]?.image}
        name={selectedSeed.name}
        chips={
          <>
            {seedCrop && (
              <ShowcaseChip icon={timer}>
                {secondsToMidString(getCropTime(seedCrop.name, inventory))}
              </ShowcaseChip>
            )}
            {seedIngredients.map(({ item, amount }) => (
              <ShowcaseChip
                key={item}
                icon={ITEM_DETAILS[item]?.image}
                danger={new Decimal((inventory as Record<string, Decimal>)[item] ?? 0).lt(amount)}
              >
                {`${amount}x ${item}`}
              </ShowcaseChip>
            ))}
            {seedIngredients.length === 0 && (
              <ShowcaseChip icon={seedsIcon}>Free</ShowcaseChip>
            )}
          </>
        }
      >
        {seedLocked && (
          <div className="flex items-center gap-1.5">
            <img src={lockIcon} className="h-4 pixelated" alt="" />
            <span className="text-[10px] text-shadow text-red-400">
              Requires Farm Level {seedFarmLevel}
            </span>
          </div>
        )}
      </ShopShowcase>

      <ShopShelf>
        {Object.values(seeds).map((item: Craftable) => (
          <Box
            isSelected={selectedSeed.name === item.name}
            key={item.name}
            onClick={() => setSelectedSeedName(item.name as SeedName)}
            image={ITEM_DETAILS[item.name]?.image}
            count={inventory[item.name]}
          />
        ))}
      </ShopShelf>
    </div>
  );

  // ── Sell (crops) body ─────────────────────────────────────────────────
  const sellCropsBody = (
    <div className="flex flex-col gap-2">
      <ShopShowcase
        image={ITEM_DETAILS[selectedCropName]?.image}
        name={selectedCropName}
        chips={
          <ShowcaseChip icon={coinIcon}>
            {cropSellPrice} coins each
          </ShowcaseChip>
        }
      />
      <ShopShelf>
        {cropNames.map((name) => (
          <Box
            isSelected={selectedCropName === name}
            key={name}
            onClick={() => setSelectedCropName(name)}
            image={ITEM_DETAILS[name]?.image}
            count={inventory[name]}
          />
        ))}
      </ShopShelf>
    </div>
  );

  // ── Sell (food) body ──────────────────────────────────────────────────
  const sellFoodBody = (
    <div className="flex flex-col gap-2">
      <ShopShowcase
        image={ITEM_DETAILS[selectedFood]?.image}
        name={selectedFood}
        chips={
          <ShowcaseChip icon={coinIcon}>
            {foodSellPrice} coins each
          </ShowcaseChip>
        }
      />
      <ShopShelf>
        {foodNames.map((name) => (
          <Box
            isSelected={selectedFood === name}
            key={name}
            onClick={() => setSelectedFood(name)}
            image={ITEM_DETAILS[name]?.image}
            count={inventory[name]}
          />
        ))}
      </ShopShelf>
    </div>
  );

  // ── Sell (produce) body ───────────────────────────────────────────────
  const sellProduceBody = (
    <div className="flex flex-col gap-2">
      <ShopShowcase
        image={ITEM_DETAILS[selectedProduce]?.image}
        name={selectedProduce}
        chips={
          <ShowcaseChip icon={coinIcon}>
            {produceSellPrice} coins each
          </ShowcaseChip>
        }
      />
      <ShopShelf>
        {PRODUCE_NAMES.map((name) => (
          <Box
            isSelected={selectedProduce === name}
            key={name}
            onClick={() => setSelectedProduce(name)}
            image={ITEM_DETAILS[name]?.image}
            count={inventory[name]}
          />
        ))}
      </ShopShelf>
    </div>
  );

  // ── Animals body ─────────────────────────────────────────────────────
  const animalsBody = (
    <div className="flex flex-col gap-2">
      <ShopShowcase
        image={ITEM_DETAILS[selectedAnimal]?.image}
        name={selectedAnimal}
        description={animal.description}
        chips={
          <>
            <ShowcaseChip icon="/assets/icons/token.png" danger={lessFunds && !animalLocked}>
              {`${animalCoinCost} Coins`}
            </ShowcaseChip>
            {animalLocked && (
              <ShowcaseChip icon={lockIcon}>
                {`Farm Lv ${animalLevelReq}`}
              </ShowcaseChip>
            )}
          </>
        }
      >
        {animalLocked && (
          <div className="flex items-center gap-1.5">
            <img src={lockIcon} className="h-4 pixelated" alt="" />
            <span className="text-[10px] text-shadow text-red-400">
              Requires Farm Level {animalLevelReq}
            </span>
          </div>
        )}
      </ShopShowcase>

      <ShopShelf>
        {animalNames.map((name) => {
          const req    = ANIMALS[name].farmLevelRequirement ?? 1;
          const locked = farmLevel < req;
          return (
            <Box
              isSelected={selectedAnimal === name}
              key={name}
              onClick={() => setSelectedAnimal(name)}
              image={ITEM_DETAILS[name]?.image}
              count={inventory[name]}
              locked={locked}
            />
          );
        })}
      </ShopShelf>
    </div>
  );

  // ── Dock ────���─────────────────────────────────────────────────────────
  const farmLevelInfo = (
    <span className="truncate text-[10px] text-shadow text-gray-400">
      Farm Lv {farmLevel}
    </span>
  );

  const seedsDock = (
    <ActionDock info={farmLevelInfo}>
      {seedLocked || selectedSeed.disabled ? (
        <span className="text-xs text-shadow px-2 text-red-400">Locked</span>
      ) : (
        <>
          <Button
            disabled={!hasIngredients}
            className="text-xs px-3 w-auto"
            onClick={() => buy(1)}
          >
            Buy 1
          </Button>
          <Button
            disabled={!hasIngredients}
            className="text-xs px-3 w-auto whitespace-nowrap"
            onClick={() => buy(10)}
          >
            Buy 10
          </Button>
        </>
      )}
    </ActionDock>
  );

  const animalsDock = (
    <ActionDock
      info={
        <span className="truncate text-[10px] text-shadow text-gray-400">
          Coins: {coinsOwned}
        </span>
      }
    >
      {animalLocked ? (
        <div className="flex items-center gap-1.5 px-2">
          <img src={lockIcon} className="h-4 pixelated" alt="" />
          <span className="text-xs text-shadow text-red-400">
            Farm Lv {animalLevelReq} required
          </span>
        </div>
      ) : (
        <Button disabled={lessFunds} className="text-xs px-3 w-auto" onClick={buyAnimal}>
          Buy for {animalCoinCost} Coins
        </Button>
      )}
    </ActionDock>
  );

  // ── Sell docks (shared pattern: Sell 1 / Sell All) ──────────────────
  const makeSellDock = (qty: number, price: number, onSell: (n: number) => void, label: string) => (
    <ActionDock
      info={
        <span className="truncate text-[10px] text-shadow text-gray-400">
          Owned: {qty} {label}
        </span>
      }
    >
      <Button
        disabled={qty < 1}
        className="text-xs px-3 w-auto"
        onClick={() => onSell(1)}
      >
        Sell 1
      </Button>
      <Button
        disabled={qty < 1}
        className="text-xs px-3 w-auto whitespace-nowrap"
        onClick={() => onSell(qty)}
      >
        Sell All
      </Button>
    </ActionDock>
  );

  const sellCropsDock   = makeSellDock(cropQty,    cropSellPrice,    sellCrop,    selectedCropName);
  const sellFoodDock    = makeSellDock(foodQty,    foodSellPrice,    sellFood,    selectedFood);
  const sellProduceDock = makeSellDock(produceQty, produceSellPrice, sellProduce, selectedProduce);

  const bodyMap: Record<Tab, React.ReactNode> = {
    seeds:   seedsBody,
    animals: animalsBody,
    sell:    sellCropsBody,
    food:    sellFoodBody,
    produce: sellProduceBody,
  };

  const dockMap: Record<Tab, React.ReactNode> = {
    seeds:   seedsDock,
    animals: animalsDock,
    sell:    sellCropsDock,
    food:    sellFoodDock,
    produce: sellProduceDock,
  };

  return (
    <ModalShell
      show={show}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          icon={basket}
          title="Market"
          subtitle="Buy seeds · animals · sell crops, food & produce"
          onClose={onClose}
        />
      }
      navRail={
        <NavRail
          items={NAV_ITEMS}
          activeId={tab}
          onSelect={(id) => setTab(id as Tab)}
        />
      }
      actionDock={dockMap[tab]}
      bodyClassName="overflow-y-auto px-1 pb-1"
    >
      {bodyMap[tab]}
    </ModalShell>
  );
};
