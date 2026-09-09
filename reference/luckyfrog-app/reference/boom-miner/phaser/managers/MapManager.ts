import * as Phaser from "phaser";
import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE, TileType, isDestructible } from "@/features/types/TileTypes";
import {
  CHEST_TEXTURE,
  ChestRarity,
} from "@/features/types/ChestRarity";
import { useGameStore } from "@/features/store/gameStore";
import type { WSSyncManager } from "@/phaser/sync/WSSyncManager";
import type { SyncLogResponse } from "@/features/types/sync";

// Palette per stage: [groundFill, groundStroke, wallFill, wallStroke]
const STAGE_PALETTES: Array<[number, number, number, number]> = [
  [0x4ea24e, 0x3d7a3d, 0x555555, 0x333333], // 1 - grass/stone
  [0xc9a26b, 0x8a6a3f, 0x7a4a2a, 0x4a2a15], // 2 - desert
  [0x6b7a99, 0x3f4a63, 0x2f3a52, 0x1a1f2e], // 3 - frozen
  [0x5a3a2e, 0x2e1f18, 0x8a2a2a, 0x4a1010], // 4 - lava
  [0x3a2a4e, 0x1f1530, 0x5e3a8a, 0x2a1548], // 5 - void
];

function getStagePalette(): [number, number, number, number] {
  const stage = useGameStore.getState().stage;
  const idx = Math.max(0, (stage - 1) % STAGE_PALETTES.length);
  return STAGE_PALETTES[idx];
}

export interface ChestMeta {
  rarity: ChestRarity;
  hp: number;
  maxHp: number;
  coins: number;
}

export interface DestructibleMeta {
  hp: number;
  maxHp: number;
  coins: number;
  rarity?: ChestRarity;
}

/**
 * Stage-map shape carried by the bootstrap payload and by the WS engine's
 * canonical state. Consumed by applyServerMap() on hydration / stage advance.
 */
interface SyncPayload {
  stageMap: {
    stage: number;
    seed: number;
    width: number;
    height: number;
    nodes: Record<string, {
      x: number;
      y: number;
      kind: "chest" | "bush";
      rarity?: ChestRarity;
      maxHp: number;
      hp: number;
      coins: number;
      destroyed: boolean;
    }>;
    totalChests: number;
    clearedChests: number;
  };
}

export class MapManager {
  readonly grid: TileType[][];
  private scene: Phaser.Scene;
  private tileGfx: Phaser.GameObjects.Graphics;
  private overlayGfx: Phaser.GameObjects.Graphics;
  private chestSprites = new Map<string, Phaser.GameObjects.Image>();
  private meta = new Map<string, DestructibleMeta>();

  /** Counters hydrated from the server. */
  private totalChests   = 0;
  private clearedChests = 0;

  /** Injected by TreasureScene after construction. */
  private wsSyncManager: WSSyncManager | null = null;

  setWSSyncManager(ws: WSSyncManager): void {
    this.wsSyncManager = ws;
  }

  /**
   * Called once per bomb detonation (not per blast tile) in WS mode.
   * Sends a SINGLE bomb:detonate event carrying every destructible node the
   * blast touched. The server applies `power` damage to each and charges
   * exactly 1 energy for the whole blast — matching the optimistic client.
   */
  notifyBombDetonate(heroId: string, nodeKeys: string[], power: number): void {
    if (!this.wsSyncManager || nodeKeys.length === 0) return;
    this.wsSyncManager.sendBombDetonate(heroId, nodeKeys, power);
  }

  /**
   * Resolves when the initial map hydration from the server is complete.
   * WSSyncManager uses this to know when it is safe to apply canonicalState.
   */
  readonly ready: Promise<void>;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Start with a blank grid; hydration will populate it.
    this.grid = this.blankGrid();
    this.tileGfx = scene.add.graphics();
    this.tileGfx.setDepth(0);
    this.overlayGfx = scene.add.graphics();
    this.overlayGfx.setDepth(5);
    this.redraw();
    // Kick off async hydration; expose the promise so callers can await readiness.
    this.ready = this.syncFromServer();
  }

  // ---------------------------------------------------------------------------
  // Server sync
  // ---------------------------------------------------------------------------

  /**
   * Hydrates the map from the bootstrap payload if available.
   *
   * Gameplay is WebSocket-only: the WS engine pushes the authoritative
   * `SESSION_STATE` (canonicalState) on connect, which WSSyncManager applies
   * via applyServerState() once the map is ready. So if bootstrap did not
   * carry a stage map, we simply leave the grid blank and let the incoming
   * SESSION_STATE populate it — there is NO HTTP fallback and NO local
   * offline generation (that was a second, unvalidated mutation path).
   */
  async syncFromServer(): Promise<void> {
    const store = useGameStore.getState();
    if (store.bootstrapStageMap) {
      this.applyServerMap(store.bootstrapStageMap as SyncPayload["stageMap"]);
      store.clearBootstrapStageMap();
    }
    // Otherwise: wait for the WS engine's SESSION_STATE push. The grid stays
    // blank (already drawn in the constructor) until then.
  }

  /**
   * Called by WSSyncManager with the canonicalState pushed by the WS engine
   * (on connect, after accepted actions, and on stage advance). Applies any
   * revoked changes back to ground truth so the client converges.
   */
  applyServerState(canonical: SyncLogResponse["canonicalState"]): void {
    // Patch hero energy in the store with server-authoritative values.
    const energyMap: Record<string, number> = {};
    for (const [heroId, h] of Object.entries(canonical.heroes)) {
      energyMap[heroId] = h.currentEnergy;
    }
    useGameStore.getState().patchRosterEnergy(energyMap);

    // Always apply server-authoritative coins and stage on every sync response.
    // The server total includes all accepted chest destroys in this batch.
    useGameStore.getState().hydrateFromServer(canonical.coins, canonical.stage);

    // Reconcile map nodes — only touch tiles that differ from local state.
    for (const [key, node] of Object.entries(canonical.nodes)) {
      const localMeta = this.meta.get(key);

      if (node.destroyed) {
        // Server says destroyed — ensure it's gone locally.
        if (localMeta || this.grid[node.y]?.[node.x] !== TileType.Grass) {
          this.meta.delete(key);
          this.grid[node.y][node.x] = TileType.Grass;
          const sprite = this.chestSprites.get(key);
          if (sprite) { sprite.destroy(); this.chestSprites.delete(key); }
        }
      } else if (!localMeta) {
        // Server says alive but client has it missing (client over-destroyed).
        // Restore it.
        this.grid[node.y][node.x] = node.kind === "chest" ? TileType.Chest : TileType.Bush;
        this.meta.set(key, {
          rarity: node.rarity as ChestRarity | undefined,
          hp:     node.hp,
          maxHp:  node.maxHp,
          coins:  node.coins,
        });
        // Re-add sprite.
        const tex = node.kind === "chest" && node.rarity
          ? CHEST_TEXTURE[node.rarity as ChestRarity]
          : node.kind === "bush" ? "bush" : null;
        if (tex) {
          const px = node.x * TILE_SIZE + TILE_SIZE / 2;
          const py = node.y * TILE_SIZE + TILE_SIZE / 2;
          const img = this.scene.add.image(px, py, tex);
          img.setDepth(4);
          img.setDisplaySize(TILE_SIZE - 4, TILE_SIZE - 4);
          this.chestSprites.set(key, img);
        }
      } else {
        // Both alive — reconcile HP.
        localMeta.hp = node.hp;
      }
    }

    this.totalChests   = Object.values(canonical.nodes).filter((n) => n.kind === "chest").length;
    this.clearedChests = Object.values(canonical.nodes).filter((n) => n.kind === "chest" && n.destroyed).length;

    this.redraw();
    this.redrawOverlay();
  }

  /** Hydrates the grid and meta from a server SyncPayload.stageMap. */
  applyServerMap(stageMap: SyncPayload["stageMap"]): void {
    // Sync the stage counter into the store.
    useGameStore.getState().hydrateFromServer(
      useGameStore.getState().coins,
      stageMap.stage,
    );

    this.totalChests   = stageMap.totalChests;
    this.clearedChests = stageMap.clearedChests;

    // Reset grid to all-wall/grass base.
    this.resetBaseGrid();

    // Clear old sprites & meta.
    this.chestSprites.forEach((s) => s.destroy());
    this.chestSprites.clear();
    this.meta.clear();

    for (const [key, node] of Object.entries(stageMap.nodes)) {
      if (node.destroyed) continue;
      const { x, y, kind, rarity, maxHp, hp, coins } = node;

      // Set tile type.
      if (this.grid[y]) {
        this.grid[y][x] = kind === "chest" ? TileType.Chest : TileType.Bush;
      }

      this.meta.set(key, { rarity, hp, maxHp, coins });
    }

    this.redraw();
    this.refreshChestSprites();
    this.redrawOverlay();
  }

  // ---------------------------------------------------------------------------
  // Stage complete
  // ---------------------------------------------------------------------------

  /** Returns true once the server has hydrated at least one chest onto this map. */
  isStageLoaded(): boolean {
    return this.totalChests > 0;
  }

  /** Returns true when all chests have been cleared (server-confirmed). */
  isStageCleared(): boolean {
    return this.totalChests > 0 && this.clearedChests >= this.totalChests;
  }

  // ---------------------------------------------------------------------------
  // Grid helpers
  // ---------------------------------------------------------------------------

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  /** Builds a blank all-grass grid with perimeter + even-even walls. */
  private blankGrid(): TileType[][] {
    const g: TileType[][] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const row: TileType[] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        row.push(this.baseType(x, y));
      }
      g.push(row);
    }
    return g;
  }

  private baseType(x: number, y: number): TileType {
    if (x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1) return TileType.Wall;
    if (x % 2 === 0 && y % 2 === 0) return TileType.Wall;
    return TileType.Grass;
  }

  /** Resets every cell to the base wall/grass pattern (no destructibles). */
  private resetBaseGrid(): void {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        this.grid[y][x] = this.baseType(x, y);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Damage API — optimistic local, fire-and-forget to server
  // ---------------------------------------------------------------------------

  chestCount(): number {
    let n = 0;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (this.grid[y][x] === TileType.Chest) n++;
      }
    }
    return n;
  }

  getMeta(x: number, y: number): DestructibleMeta | undefined {
    return this.meta.get(this.key(x, y));
  }

  /**
   * Apply `dmg` blast damage optimistically to the local grid.
   * This does NOT send a hit to the server — the WS engine is notified once
   * per bomb detonation via notifyBombDetonate(). Returns { destroyed, coins }
   * from the optimistic local state immediately.
   */
  damageTile(x: number, y: number, dmg = 1, _heroId = ""): { destroyed: boolean; coins: number } {
    const t = this.grid[y]?.[x];
    if (t === undefined || !isDestructible(t)) return { destroyed: false, coins: 0 };
    const m = this.meta.get(this.key(x, y));
    if (!m) {
      this.grid[y][x] = TileType.Grass;
      this.redraw();
      this.redrawOverlay();
      return { destroyed: true, coins: 0 };
    }
    m.hp -= dmg;
    if (m.hp > 0) {
      this.redrawOverlay();
      return { destroyed: false, coins: 0 };
    }
    const coins = m.coins;
    this.meta.delete(this.key(x, y));
    this.grid[y][x] = TileType.Grass;
    const sprite = this.chestSprites.get(this.key(x, y));
    if (sprite) {
      sprite.destroy();
      this.chestSprites.delete(this.key(x, y));
    }
    this.redraw();
    this.redrawOverlay();
    return { destroyed: true, coins };
  }

  /** Legacy: destroys immediately regardless of HP. Kept for compat. */
  destroyTile(x: number, y: number): boolean {
    if (!isDestructible(this.grid[y][x])) return false;
    this.grid[y][x] = TileType.Grass;
    this.meta.delete(this.key(x, y));
    const sprite = this.chestSprites.get(this.key(x, y));
    if (sprite) {
      sprite.destroy();
      this.chestSprites.delete(this.key(x, y));
    }
    this.redraw();
    this.redrawOverlay();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private refreshChestSprites(): void {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const t = this.grid[y][x];
        if (t !== TileType.Chest && t !== TileType.Bush) continue;
        const m = this.meta.get(this.key(x, y));
        let tex: string | null = null;
        if (t === TileType.Chest && m?.rarity) tex = CHEST_TEXTURE[m.rarity as ChestRarity];
        else if (t === TileType.Bush) tex = "bush";
        if (!tex) continue;
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        const img = this.scene.add.image(px, py, tex);
        img.setDepth(4);
        img.setDisplaySize(TILE_SIZE - 4, TILE_SIZE - 4);
        this.chestSprites.set(this.key(x, y), img);
      }
    }
  }

  private redrawOverlay(): void {
    const g = this.overlayGfx;
    g.clear();
    for (const [key, m] of this.meta) {
      if (m.maxHp <= 1 || m.hp >= m.maxHp) continue;
      const [xs, ys] = key.split(",");
      const x = Number(xs);
      const y = Number(ys);
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      const w = TILE_SIZE - 6;
      const frac = Math.max(0, m.hp / m.maxHp);
      g.fillStyle(0x000000, 0.6);
      g.fillRect(px + 3, py + 2, w, 4);
      g.fillStyle(0x22dd55, 1);
      g.fillRect(px + 3, py + 2, w * frac, 4);
    }
  }

  redraw(): void {
    const g = this.tileGfx;
    g.clear();
    const [groundFill, groundStroke, wallFill, wallStroke] = getStagePalette();
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        g.fillStyle(groundFill, 1);
        g.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        g.lineStyle(1, groundStroke, 0.4);
        g.strokeRect(px, py, TILE_SIZE, TILE_SIZE);

        const t = this.grid[y][x];
        if (t === TileType.Wall) {
          g.fillStyle(wallFill, 1);
          g.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          g.lineStyle(2, wallStroke, 1);
          g.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        }
      }
    }
  }

}
