export interface NpcPositionDef {
  id: string
  x: number
  y: number
  width: number
  height: number
  facing?: 'up' | 'down' | 'left' | 'right'
  texture?: string
  event?: string
  /** Display name shown as a floating label above the NPC sprite. */
  name?: string
}

/**
 * Farm NPC spawn definitions.
 * Coordinates are in tile units (multiplied by TILE_SIZE in WorldInteractionSystem).
 */
export const NPC_POSITIONS: NpcPositionDef[] = [
  {
    id: 'npc_rancher',
    x: 20,
    y: 24,
    width: 2,
    height: 2,
    facing: 'down',
    texture: 'npc_rancher',
    event: 'phaser-barn-open',
    name: 'Rancher',
  },
  {
    id: 'npc_trader',
    x: 36,
    y: 21,
    width: 2,
    height: 2,
    facing: 'down',
    texture: 'npc_trader',
    event: 'phaser-trader-open',
    name: 'Trader',
  },
  {
    id: 'npc_blacksmith',
    x: 35.4375,
    y: 3,
    width: 2,
    height: 2,
    facing: 'down',
    texture: 'npc_blacksmith',
    event: 'phaser-blacksmith-open',
    name: 'Blacksmith',
  },
]
