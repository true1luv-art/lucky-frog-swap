"use client";

/**
 * components/game/quests/QuestKeeperModal.tsx
 *
 * Opened when the player clicks npc_questKeeper in the Phaser scene.
 * Dispatched by FarmScene via NPC_POSITIONS[npc_questKeeper].event
 * ("phaser-npc-quest-open") and handled in PhaserModals.
 *
 * Thin mount — QuestKeeperContent owns the ModalShell (Phase D of
 * docs/modal-redesign-plan.md).
 */

import { QuestKeeperContent } from "@/components/game/quests/components/QuestKeeperContent";

interface QuestKeeperModalProps {
  open:    boolean;
  onClose: () => void;
}

export function QuestKeeperModal({ open, onClose }: QuestKeeperModalProps) {
  return <QuestKeeperContent show={open} onClose={onClose} />;
}
