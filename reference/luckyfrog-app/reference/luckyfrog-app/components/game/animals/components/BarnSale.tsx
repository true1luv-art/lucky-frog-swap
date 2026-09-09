"use client";

import React from "react";

import { CraftShop } from "@/components/game/shops/components/CraftShop";
import { ANIMALS } from "@/shared/types/gameplay/craftables";

const chicken = "/assets/animals/chicken.png";

interface Props {
  show: boolean;
  onClose: () => void;
}

/**
 * Barn on the new modal shell — Showcase + Shelf via the shared CraftShop
 * (docs/modal-redesign-plan.md §2.3, §3).
 */
export const BarnSale: React.FC<Props> = ({ show, onClose }) => {
  return (
    <CraftShop
      show={show}
      onClose={onClose}
      title="Barn"
      subtitle="Buy animals"
      icon={chicken}
      items={ANIMALS}
      actionLabel="Buy"
    />
  );
};
