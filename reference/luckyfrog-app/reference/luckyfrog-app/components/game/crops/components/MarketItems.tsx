"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import Decimal from "decimal.js-light";
import { Modal } from "react-bootstrap";

import { Box } from "@/components/ui/Box";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import {
  ModalShell,
  ModalTitleBar,
  NavRail,
  ActionDock,
} from "@/components/ui/modal";
import { ShopShowcase, ShowcaseChip } from "@/components/game/shops/components/ShopShowcase";
import { ShopShelf } from "@/components/game/shops/components/ShopShelf";

import { secondsToMidString } from "@/lib/utils/time";
import { Context } from "@/context/GameContext";
import { Craftable, Food, FOODS } from "@/shared/types/gameplay/craftables";
import { CropName, CROPS, SEEDS, SeedName } from "@/shared/types/gameplay/crops";
import { RESOURCES } from "@/shared/types/gameplay/resources";
import { ITEM_DETAILS } from "@/shared/types/gameplay/images";
import { ToastContext } from "@/context/ToastContext";
import { getBuyPrice } from "@/lib/events/craft/craft";
import { getCropTime } from "@/lib/events/plant/plant";
import { getSellPrice, hasSellBoost } from "@/shared/game/boosts";
import { useGameStore } from "@/lib/stores/game/useGameStore";
import { getSkillLevel } from "@/shared/game/skills";
import type { ProduceName } from "@/lib/events/sell/sellProduce";

const token = "/assets/icons/token.png";
const timer = "/assets/icons/timer.png";
const basket = "/assets/icons/basket.png";
const seedsIcon = "/assets/icons/seeds.png";
const cropIcon = "/assets/crops/potato/crop.png";
const foodIcon = "/assets/foods/roasted_potato.png";
const produceIcon = "/assets/resources/egg.png";
const lightning = "/assets/icons/lightning.png";

type Tab = "buy" | "sell" | "food" | "produce";

const NAV_ITEMS = [
  { id: "buy", label: "Buy", icon: seedsIcon },
  { id: "sell", label: "Sell", icon: cropIcon },
  { id: "food", label: "Food", icon: foodIcon },
  { id: "produce", label: "Produce", icon: produceIcon },
];

const PRODUCE_ITEMS: ProduceName[] = ["Egg", "Milk", "Wool"];

interface Props {
  show: boolean;
  onClose: () => void;
}

/**
 * Market on the new modal shell — NavRail (Buy / Sell / Food / Produce) +
 * Showcase + Shelf (docs/modal-redesign-plan.md §2.3, §3). Buy logic carried
 * over from the old Seeds component, crop sell logic from the old Plants
 * component, and Food / Produce selling consolidated from the former Bazaar.
 */
export const MarketItems: React.FC<Props> = ({ show, onClose }) => {
  const [tab, setTab] = useState<Tab>("buy");
  const [selectedSeedName, setSelectedSeedName] = useState<SeedName>("Potato Seed");
  const [selectedCropName, setSelectedCropName] = useState<CropName>("Potato");
  const [isSellAllModalOpen, showSellAllModal] = useState(false);
  const [isPriceBoosted, setIsPriceBoosted] = useState(false);

  const { addToast } = useContext(ToastContext);
  const { shortcutItem } = useContext(Context);
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const inventory = state.inventory;
  const farmingLevel = getSkillLevel(state.skills?.farming ?? 0);

  const foods = FOODS();
  const [selectedFood, setSelectedFood] = useState<Craftable & { name: Food }>(
    foods["Roasted Potato"] as Craftable & { name: Food }
  );
  const [selectedProduce, setSelectedProduce] = useState<ProduceName>("Egg");

  // Halving-aware price maps. `halvingMultiplier` is hydrated from
  // /api/game-stats on game load; prices update automatically when it changes.
  // §5 Step 4d. Selections are tracked by name so the showcase always reflects
  // the current stage's price rather than a stale snapshot.
  const halvingMultiplier = state.halvingMultiplier ?? 1;
  const seeds = useMemo(() => SEEDS(halvingMultiplier), [halvingMultiplier]);
  const crops = useMemo(() => CROPS(halvingMultiplier), [halvingMultiplier]);
  const selectedSeed = seeds[selectedSeedName];
  const selectedCrop = crops[selectedCropName];

  useEffect(() => {
    setIsPriceBoosted(hasSellBoost(inventory));
  }, [state.inventory]);

  // ── Buy (seeds) ──────────────────────────────────────────────────────
  const buyPrice = getBuyPrice(selectedSeed, inventory);
  const levelRequirement = selectedSeed.levelRequirement ?? 0;
  const seedLocked = farmingLevel < levelRequirement;

  const lessFunds = (amount = 1) =>
    new Decimal(state.balance).lessThan(buyPrice.mul(amount).toString());

  const buy = (amount = 1) => {
    dispatch({ type: "item.crafted", item: selectedSeed.name, amount });
    addToast("$LFRG -" + buyPrice.mul(amount).toString());
    shortcutItem(selectedSeed.name);
  };

  const seedCropName = selectedSeed.name.split(" ")[0] as CropName;
  const seedCrop = crops[seedCropName];

  // ── Sell (crops) ─────────────────────────────────────────────────────
  const cropSellPrice = getSellPrice(selectedCrop, inventory);
  const cropAmount = new Decimal(inventory[selectedCrop.name] || 0).toNumber();

  const sellCrop = (amount = 1) => {
    dispatch({ type: "item.sell", item: selectedCrop.name, amount });
    addToast("$LFRG +" + cropSellPrice.mul(amount).toString());
  };

  // ── Sell (food) ──────────────────────────────────────────────────────
  const foodSellPrice = selectedFood.sellPrice || new Decimal(0);

  const sellFood = (amount = 1) => {
    dispatch({ type: "food.sell", item: selectedFood.name, amount });
    addToast("$LFRG +" + foodSellPrice.mul(amount).toString());
  };

  // ── Sell (produce) ───────────────────────────────────────────────────
  const produceSellPrice = new Decimal(RESOURCES[selectedProduce]?.sellPrice ?? 0);

  const sellProduce = (amount = 1) => {
    dispatch({ type: "produce.sell", item: selectedProduce, amount });
    addToast("$LFRG +" + produceSellPrice.mul(amount).toFixed(2));
  };

  // ── Active sell target (crops / food / produce share the sell dock) ───
  const sellTarget = {
    sell: {
      name: selectedCrop.name as string,
      stock: cropAmount,
      run: sellCrop,
    },
    food: {
      name: selectedFood.name as string,
      stock: new Decimal(inventory[selectedFood.name] || 0).toNumber(),
      run: sellFood,
    },
    produce: {
      name: selectedProduce as string,
      stock: new Decimal(inventory[selectedProduce] || 0).toNumber(),
      run: sellProduce,
    },
  } as const;

  const active = tab === "buy" ? sellTarget.sell : sellTarget[tab];
  const noStock = active.stock === 0;

  const handleSellAll = () => {
    active.run(active.stock);
    showSellAllModal(false);
  };

  const openSellAllConfirmation = () => {
    if (active.stock === 1) {
      active.run(1);
    } else {
      showSellAllModal(true);
    }
  };

  // ── Body ─────────────────────────────────────────────────────────────
  let body: React.ReactNode;

  if (tab === "buy") {
    body = (
      <>
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
              <ShowcaseChip icon={token} danger={lessFunds()}>
                {`$${buyPrice.toString()}`}
              </ShowcaseChip>
            </>
          }
        >
          {seedLocked && (
            <div className="flex items-center gap-1.5">
              <img src="/assets/skills/lock.png" className="h-5 pixelated" alt="" />
              <span className="text-[10px] text-shadow text-red-400">
                Requires farming level {levelRequirement}
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
      </>
    );
  } else if (tab === "sell") {
    body = (
      <>
        <ShopShowcase
          image={ITEM_DETAILS[selectedCrop.name]?.image}
          name={selectedCrop.name}
          description={selectedCrop.description}
          chips={
            <ShowcaseChip icon={token}>
              {isPriceBoosted && (
                <img src={lightning || "/placeholder.svg"} alt="Price boosted" className="h-4 pixelated" />
              )}
              {`$${cropSellPrice.toString()}`}
            </ShowcaseChip>
          }
        />

        <ShopShelf>
          {Object.values(crops).map((item) => (
            <Box
              isSelected={selectedCrop.name === item.name}
              key={item.name}
              onClick={() => setSelectedCropName(item.name)}
              image={ITEM_DETAILS[item.name]?.image}
              count={inventory[item.name]}
            />
          ))}
        </ShopShelf>
      </>
    );
  } else if (tab === "food") {
    body = (
      <>
        <ShopShowcase
          image={ITEM_DETAILS[selectedFood.name]?.image}
          name={selectedFood.name}
          description={selectedFood.description}
          chips={<ShowcaseChip icon={token}>{`$${foodSellPrice.toNumber()}`}</ShowcaseChip>}
        />

        <ShopShelf>
          {Object.values(foods).map(
            (item) =>
              item && (
                <Box
                  isSelected={selectedFood.name === item.name}
                  key={item.name}
                  onClick={() => setSelectedFood(item as Craftable & { name: Food })}
                  image={ITEM_DETAILS[item.name]?.image}
                  count={inventory[item.name]}
                />
              )
          )}
        </ShopShelf>
      </>
    );
  } else {
    body = (
      <>
        <ShopShowcase
          image={ITEM_DETAILS[selectedProduce]?.image}
          name={selectedProduce}
          description={RESOURCES[selectedProduce]?.description}
          chips={<ShowcaseChip icon={token}>{`$${produceSellPrice.toFixed(2)}`}</ShowcaseChip>}
        />

        <ShopShelf>
          {PRODUCE_ITEMS.map((name) => (
            <Box
              isSelected={selectedProduce === name}
              key={name}
              onClick={() => setSelectedProduce(name)}
              image={ITEM_DETAILS[name]?.image}
              count={inventory[name]}
            />
          ))}
        </ShopShelf>
      </>
    );
  }

  // ── Dock ─────────────────────────────────────────────────────────────
  const dock =
    tab === "buy" ? (
      <ActionDock
        info={
          <span className="truncate">
            Balance ${new Decimal(state.balance).toDecimalPlaces(3, Decimal.ROUND_DOWN).toString()}
          </span>
        }
      >
        {seedLocked || selectedSeed.disabled ? (
          <span className="text-xs text-shadow px-2">Locked</span>
        ) : (
          <>
            <Button
              disabled={lessFunds()}
              className="text-xs px-3 w-auto"
              onClick={() => buy(1)}
            >
              Buy 1
            </Button>
            <Button
              disabled={lessFunds(10)}
              className="text-xs px-3 w-auto whitespace-nowrap"
              onClick={() => buy(10)}
            >
              Buy 10
            </Button>
          </>
        )}
      </ActionDock>
    ) : (
      <ActionDock
        info={
          <span className="truncate">
            Owned: {active.stock} {active.name}
          </span>
        }
      >
        <Button
          disabled={active.stock < 1}
          className="text-xs px-3 w-auto"
          onClick={() => active.run(1)}
        >
          Sell 1
        </Button>
        <Button
          disabled={noStock}
          className="text-xs px-3 w-auto whitespace-nowrap"
          onClick={openSellAllConfirmation}
        >
          Sell All
        </Button>
      </ActionDock>
    );

  return (
    <>
      <ModalShell
        show={show}
        onClose={onClose}
        tier="panel"
        titleBar={
          <ModalTitleBar
            icon={basket}
            title="Market"
            subtitle="Buy seeds · sell crops, food & produce"
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
        actionDock={dock}
      >
        {body}
      </ModalShell>

      <Modal centered show={isSellAllModalOpen} onHide={() => showSellAllModal(false)}>
        <Panel className="md:w-4/5 m-auto">
          <div className="m-auto flex flex-col">
            <span className="text-sm text-center text-shadow">
              Are you sure you want to sell all your {active.name}?
            </span>
            <span className="text-sm text-center text-shadow mt-1">
              Total: {active.stock}
            </span>
          </div>
          <div className="flex justify-content-around p-1">
            <Button disabled={noStock} className="text-xs" onClick={handleSellAll}>
              Yes
            </Button>
            <Button
              className="text-xs ml-2"
              onClick={() => showSellAllModal(false)}
            >
              No
            </Button>
          </div>
        </Panel>
      </Modal>
    </>
  );
};
