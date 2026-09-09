import React from "react";
import classNames from "classnames";

const bank = "/assets/buildings/tailor.gif";
const token = "/assets/icons/token.png";

import { Action } from "@/components/ui/Action";
import { GRID_WIDTH_PX } from "@/shared/game/constants";
import { WalletModal } from "@/components/game/hud/WalletModal";

export const Bank: React.FC = () => {
  const [isBankModalOpen, showBankModal] = React.useState(false);

  return (
    <div
      className="z-10 absolute"
      style={{
        width: `${GRID_WIDTH_PX * 4}px`,
        right: `${GRID_WIDTH_PX * 6}px`,
        top: `${GRID_WIDTH_PX * 0}px`,
      }}
    >
      <div className={classNames("cursor-pointer", "hover:img-highlight")}>
        <img
          src={typeof bank === "string" ? bank : (bank as { src: string })?.src}
          alt="bank"
          onClick={() => showBankModal(true)}
          className="w-full"
        />
        <Action
          className="absolute bottom-10 left-0"
          text="Bank"
          icon={token}
          onClick={() => showBankModal(true)}
        />
      </div>

      <WalletModal open={isBankModalOpen} onClose={() => showBankModal(false)} />
    </div>
  );
};
