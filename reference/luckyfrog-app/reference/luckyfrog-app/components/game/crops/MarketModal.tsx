"use client";

import { MarketItems } from "@/components/game/crops/components/MarketItems";

interface MarketModalProps {
  open: boolean;
  onClose: () => void;
}

export function MarketModal({ open, onClose }: MarketModalProps) {
  return <MarketItems show={open} onClose={onClose} />;
}
