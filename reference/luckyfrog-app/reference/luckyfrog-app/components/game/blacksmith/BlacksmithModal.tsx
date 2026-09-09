"use client";

import { Crafting } from "@/components/game/blacksmith/components/Crafting";

interface BlacksmithModalProps {
  open: boolean;
  onClose: () => void;
}

export function BlacksmithModal({ open, onClose }: BlacksmithModalProps) {
  return <Crafting show={open} onClose={onClose} />;
}
