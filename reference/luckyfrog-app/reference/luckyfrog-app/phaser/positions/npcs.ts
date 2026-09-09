export interface NpcPositionDef {
  id: string
  x: number
  y: number
  width: number
  height: number
  facing?: 'left' | 'right'
  texture?: string
  event?: string
}

export const NPC_POSITIONS: NpcPositionDef[] = [
  { id: 'npc_merchant', x: 24, y: 36, width: 2, height: 2, facing: 'left', event: 'phaser-npc-merchant-open' },
  { id: 'npc_questKeeper', x: 38, y: 15, width: 2, height: 2, facing: 'left', event: 'phaser-npc-quest-open' },
  // Barn keeper — stands beside the animal pen and opens the Barn Sale modal
  { id: 'npc_barnkeeper', x: 49, y: 26, width: 2, height: 2, facing: 'left', event: 'phaser-barnsale-open' },
]
