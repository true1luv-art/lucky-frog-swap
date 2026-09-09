"use client";

import React, { useMemo, useState } from "react";
import { Box } from "@/components/ui/Box";
import { Button } from "@/components/ui/Button";
import { ModalShell, ModalTitleBar, ActionDock } from "@/components/ui/modal";
import { ShopShowcase, ShowcaseChip } from "@/components/game/shops/components/ShopShowcase";
import { ShopShelf } from "@/components/game/shops/components/ShopShelf";
import { useFarmToast } from "@/context/ToastContext";
import { useGameStore } from "@/lib/stores/game/useGameStore";
import {
  forgeCollectible,
  forgeDisabledReason,
  maxForgeQuantity,
  ownedAmount,
  useCollectibles,
} from "@/lib/collectibles/client";
import { COLLECTIBLES } from "@/shared/data/collectibles";
import { COLLECTIBLE_NAMES, type CollectibleName } from "@/shared/types/gameplay/collectibles";

const hammer = "/assets/icons/hammer.png";

interface Props { show: boolean; onClose: () => void; }

export const Crafting: React.FC<Props> = ({ show, onClose }) => {
  const [selectedName, setSelectedName] = useState<CollectibleName>(COLLECTIBLE_NAMES[0]);
  const [pending, setPending] = useState(false);
  const inventory = useGameStore((state) => state.state.inventory);
  const reconcile = useGameStore((state) => state.reconcileServerState);
  const refreshFarm = useGameStore((state) => state.resetToServerState);
  const { addToast } = useFarmToast();
  const { data, error, isLoading, mutate } = useCollectibles(show);

  const definition = COLLECTIBLES[selectedName];
  const collectible = data?.collectibles.find((item) => item.name === selectedName);
  const remainingSupply = collectible?.remainingSupply ?? definition.maxSupply;
  const maximum = useMemo(
    () => maxForgeQuantity(definition.ingredients, inventory, remainingSupply),
    [definition.ingredients, inventory, remainingSupply],
  );
  const disabledReason = forgeDisabledReason({ pending, remainingSupply, maximum });

  const forge = async () => {
    if (disabledReason) return;
    setPending(true);
    try {
      await forgeCollectible({
        name: selectedName,
        quantity: 1,
        reconcile,
        refreshFarm,
        refreshCollectibles: mutate,
      });
      addToast(`Forged ${selectedName}`, definition.image);
    } catch (forgeError) {
      addToast(forgeError instanceof Error ? forgeError.message : "Forge failed");
    } finally {
      setPending(false);
    }
  };

  const dockInfo = (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-xs text-white">{selectedName}</span>
      <span className="truncate text-[9px] text-white/60">
        {disabledReason ?? "Ready to forge"}
      </span>
    </div>
  );

  return (
    <ModalShell
      show={show}
      onClose={onClose}
      tier="panel"
      titleBar={<ModalTitleBar icon={hammer} title="Blacksmith" subtitle="Forge limited legendary collectibles" onClose={onClose} />}
      actionDock={
        <ActionDock info={dockInfo} className="flex-wrap sm:flex-nowrap">
          <Button className="min-w-16 px-1 text-[9px] sm:min-w-24 sm:px-3 sm:text-xs" disabled={Boolean(disabledReason)} onClick={forge}>
            {disabledReason ?? "Forge"}
          </Button>
        </ActionDock>
      }
      bodyClassName="px-1 pb-1"
    >
      <div className="flex flex-col gap-2 py-1">
        <ShopShowcase
          image={definition.image}
          name={definition.name}
          description={definition.description}
          className="collectible-forged-panel"
          chips={
            <>
              <ShowcaseChip>Legendary · {definition.system}</ShowcaseChip>
              <ShowcaseChip>{definition.effect.description}</ShowcaseChip>
              <ShowcaseChip danger={remainingSupply === 0}>
                {collectible?.mintedSupply ?? 0}/{collectible?.maxSupply ?? definition.maxSupply} minted
              </ShowcaseChip>
              <ShowcaseChip>Owned {collectible?.ownedCount ?? 0}</ShowcaseChip>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {definition.ingredients.map(({ item, amount }) => {
              const required = amount;
              const owned = ownedAmount(inventory, item);
              return (
                <div key={item} className="flex items-center justify-between gap-2 rounded bg-brown-600/40 px-1.5 py-1 text-[9px] text-white/70">
                  <span className="truncate">{item}</span>
                  <span className={owned.lessThan(required) ? "text-red-400" : "text-yellow-200"}>
                    {owned.toString()} / {required.toString()}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-white/60">
            {isLoading ? "Reading live supply…" : error ? "Live supply unavailable. Try again." : `${remainingSupply} remaining${maximum < 1 ? " · not affordable" : " · 1 per forge"}`}
          </p>
        </ShopShowcase>

        <ShopShelf>
          {COLLECTIBLE_NAMES.map((name) => {
            const item = data?.collectibles.find((entry) => entry.name === name);
            return (
              <Box
                key={name}
                image={COLLECTIBLES[name].image}
                count={item?.ownedCount}
                disabled={item?.remainingSupply === 0}
                isSelected={selectedName === name}
                onClick={() => setSelectedName(name)}
              />
            );
          })}
        </ShopShelf>
      </div>
    </ModalShell>
  );
};
