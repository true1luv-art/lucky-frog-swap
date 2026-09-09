"use client";

import { BarnSale } from "@/components/game/animals/components/BarnSale";

interface BarnModalProps {
  open: boolean;
  onClose: () => void;
}

export function BarnModal({ open, onClose }: BarnModalProps) {
  return <BarnSale show={open} onClose={onClose} />;
}
