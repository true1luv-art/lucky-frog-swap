import React, { useContext, useState } from "react";

const basket = "/assets/icons/basket.png";
const button = "/assets/ui/button/round_button.png";

import { Label } from "@/components/ui/Label";
import { Box } from "@/components/ui/Box";

import { InventoryItems } from "@/features/game-components/hud/components/InventoryItems";
import { Context } from "@/context/GameContext";
import { getShortcuts } from "@/features/game-components/hud/lib/shortcuts";
import { ITEM_DETAILS } from "@/features/types/item-details";
import { useGameStore } from "@/features/game-stores/useGameStore";
import type { ToolInstance } from "@/features/types/gameplay/tools";

/** Build the image path for a shortcut item, falling back for tools. */
function getShortcutImage(item: string, tools: ToolInstance[]): string | undefined {
  const detail = ITEM_DETAILS[item as keyof typeof ITEM_DETAILS];
  if (detail?.image) return detail.image;
  // Tools are stored by name (e.g. "Axe") — find the equipped instance for this name.
  const tool = tools.find((t) => (t.name as string) === item);
  if (tool) return `/assets/tools/${tool.tier.toLowerCase()}_${tool.name.toLowerCase().replace(/ /g, "_")}.png`;
  return undefined;
}

export const Inventory: React.FC<{ wallet?: string }> = ({ wallet }) => {
  const [isOpen, setIsOpen]       = useState(false);
  const { shortcutItem, selectedItem } = useContext(Context);
  const inventory                 = useGameStore((s) => s.state.items);
  const tools                     = useGameStore((s) => s.state.tools ?? []) as ToolInstance[];
  const [shortcuts, setShortcuts] = useState(() => getShortcuts());

  const handleClose = () => {
    setIsOpen(false);
    setShortcuts(getShortcuts());
  };

  return (
    <div className="flex flex-col items-end mr-1 sm:mr-2 fixed top-2 right-0 z-50">

      {/* Items button */}
      <div
        className="w-10 h-10 sm:w-16 sm:h-16 sm:mx-8 mt-0 relative flex justify-center items-center shadow rounded-full cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        <img
          src={typeof button === "string" ? button : (button as { src: string })?.src}
          className="absolute w-full h-full -z-10"
          alt="inventoryButton"
        />
        <img
          src={typeof basket === "string" ? basket : (basket as { src: string })?.src}
          className="w-5 sm:w-8 mb-0.5 sm:mb-1"
          alt="inventory"
        />
        <Label className="hidden sm:block absolute -bottom-7">Items</Label>
      </div>

      <InventoryItems show={isOpen} onClose={handleClose} wallet={wallet} />

      <div className="flex flex-col items-center sm:mt-8 sm:mr-8">
        {shortcuts.map((item, index) => {
          const isTool = tools.some((t) => (t.name as string) === item);
          return (
            <Box
              key={index}
              isSelected={item === selectedItem}
              image={getShortcutImage(item, tools)}
              secondaryImage={ITEM_DETAILS[item]?.secondaryImage}
              count={inventory[item]}
              onClick={() => shortcutItem(item)}
              imageClassName={isTool ? "scale-150" : undefined}
            />
          );
        })}
      </div>
    </div>
  );
};
