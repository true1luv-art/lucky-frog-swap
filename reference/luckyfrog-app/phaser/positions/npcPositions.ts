export interface NpcPositionDef {
  id: string
  x: number
  y: number
  width: number
  height: number
  facing?: 'left' | 'right'
  texture?: string
  event?: string
  /** Display name shown as a floating label above the NPC sprite. */
  name?: string
}

/**
 * Farm NPC spawn definitions.
 * Coordinates are in tile units (multiplied by TILE_SIZE in WorldInteractionSystem).
 *
 * - Barn Keeper: near the barn zone (tile 8,18) — opens the BarnModal.
 * - Trader: beside the Market building (tile 30,16) — opens the MarketModal.
 */
export const NPC_POSITIONS: NpcPositionDef[] = [
  {
    id: 'npc_barnKeeper',
    x: 8,
    y: 18,
    width: 2,
    height: 2,
    facing: 'right',
    event: 'phaser-barn-open',
    name: 'Barn Keeper',
  },
  {
    id: 'npc_trader',
    // Just left of the Market building (market is at tile 30,16 — Trader at 28,17)
    x: 32,
    y: 20,
    width: 2,
    height: 2,
    facing: 'right',
    event: 'phaser-trader-open',
    name: 'Trader',
  },
]
