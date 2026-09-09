"use client";

import { Crafting } from "@/components/game/kitchen/components/Crafting";

interface KitchenModalProps {
  open: boolean;
  onClose: () => void;
}

export function KitchenModal({ open, onClose }: KitchenModalProps) {
  return <Crafting show={open} onClose={onClose} />;
}
