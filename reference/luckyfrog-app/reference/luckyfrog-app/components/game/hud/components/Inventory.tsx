import React, { useContext, useState } from "react";

const basket = "/assets/icons/basket.png";
const button = "/assets/ui/button/round_button.png";

import { Label } from "@/components/ui/Label";
import { Box } from "@/components/ui/Box";

import { InventoryItems } from "@/components/game/hud/components/InventoryItems";
import { Context } from "@/context/GameContext";
import { getShortcuts } from "@/components/game/hud/lib/shortcuts";
import { ITEM_DETAILS } from "@/shared/types/gameplay/images";
import { useGameStore } from "@/lib/stores/game/useGameStore";

export const Inventory: React.FC<{ wallet?: string }> = ({ wallet }) => {
  const [isOpen, setIsOpen]  = useState(false);
  const { shortcutItem }     = useContext(Context);
  const inventory            = useGameStore((s) => s.state.inventory);
  const [shortcuts, setShortcuts] = useState(() => getShortcuts());

  // Refresh shortcut slots whenever the modal closes (new item may have been selected)
  const handleClose = () => {
    setIsOpen(false);
    setShortcuts(getShortcuts());
  };

  return (
    <div className="flex flex-col items-end mr-1 sm:mr-2 fixed top-2 right-0 z-50">
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

      <div className="flex flex-col items-center sm:mt-8">
        {shortcuts.map((item, index) => (
          <Box
            key={index}
            isSelected={index === 0}
            image={ITEM_DETAILS[item]?.image}
            secondaryImage={ITEM_DETAILS[item]?.secondaryImage}
            count={inventory[item]}
            onClick={() => shortcutItem(item)}
          />
        ))}
      </div>
    </div>
  );
};
