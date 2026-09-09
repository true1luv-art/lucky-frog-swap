/**
 * features/types/sync.ts
 *
 * Shared types for the real-time WebSocket sync pipeline.
 *
 * NOTE: The legacy HTTP action-log types (ActionLogEntry, SyncLogRequest) and
 * the /api/stage-map/* routes have been removed. Gameplay is WebSocket-only:
 * the WS engine pushes the authoritative `canonicalState` (shape below) on
 * connect, after every accepted action, and on stage advance.
 */

/**
 * Full authoritative map + hero state pushed by the WS engine.
 * MapManager.applyServerState() consumes `canonicalState` to reconcile the
 * client with ground truth.
 */
export interface SyncLogResponse {
  /** Full authoritative map + hero state — client must apply this. */
  canonicalState: {
    nodes: Record<string, {
      x:         number;
      y:         number;
      kind:      "chest" | "bush";
      rarity?:   string;
      maxHp:     number;
      hp:        number;
      coins:     number;
      destroyed: boolean;
    }>;
    heroes: Record<string, {
      currentEnergy: number;
      maxEnergy:     number;
    }>;
    coins:         number;
    stage:         number;
    totalNodes:    number;
    destroyedNodes: number;
  };
}
