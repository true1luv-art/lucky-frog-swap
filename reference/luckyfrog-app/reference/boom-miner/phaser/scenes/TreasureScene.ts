import * as Phaser from "phaser";
import { MapManager } from "../managers/MapManager";
import { HeroManager } from "../managers/HeroManager";
import { BombManager } from "../managers/BombManager";
import { ExplosionManager } from "../managers/ExplosionManager";
import { LootManager } from "../managers/LootManager";
import { AIManager } from "../managers/AIManager";
import { Pathfinding } from "../systems/Pathfinding";
import { TileType, MAP_WIDTH, MAP_HEIGHT } from "@/features/types/TileTypes";
import { useGameStore } from "@/features/store/gameStore";
import { HeroRarity, HeroType } from "@/features/types/HeroRarity";
import { WSSyncManager } from "@/phaser/sync/WSSyncManager";

export class TreasureScene extends Phaser.Scene {
  private map!: MapManager;
  private pathfinding!: Pathfinding;
  private heroes!: HeroManager;
  private bombs!: BombManager;
  private explosions!: ExplosionManager;
  private loot!: LootManager;
  private ai!: AIManager;
  private lastSync = 0;
  private stageCleared = false;
  private stageAdvanceAt = 0;
  private wsSyncManager: WSSyncManager | null = null;

  constructor() {
    super("TreasureScene");
  }

  create(): void {
    this.map = new MapManager(this);
    this.pathfinding = new Pathfinding(this.map.grid);
    this.bombs = new BombManager(this);
    this.loot = new LootManager(this);
    this.explosions = new ExplosionManager(this, this.map, this.pathfinding);
    this.heroes = new HeroManager(this);
    this.ai = new AIManager(this.map, this.pathfinding, this.bombs, this.loot, this.explosions);

    // Gameplay is WebSocket-only. If NEXT_PUBLIC_WS_URL is missing there is no
    // valid transport, so we surface a blocking error instead of silently
    // allowing an unvalidated local/HTTP mutation path.
    if (!process.env.NEXT_PUBLIC_WS_URL) {
      console.error("[TreasureScene] NEXT_PUBLIC_WS_URL is not set — gameplay disabled.");
      useGameStore.getState().setSessionError(
        "The game server is not configured. Please try again later.",
      );
    } else {
      this.wsSyncManager = new WSSyncManager(
        (canonical) => this.map.applyServerState(canonical),
      );
      this.map.setWSSyncManager(this.wsSyncManager);
      // Attaches to (or creates) the shared socket. The socket survives
      // scene.restart() across stage transitions.
      this.wsSyncManager.start();
      // Notify the WSSyncManager once the map is fully hydrated so it can
      // flush any canonicalState that arrived before the grid was ready.
      this.map.ready.then(() => this.wsSyncManager?.notifyMapReady());
    }

    // Detach this scene's manager from the shared socket on shutdown so the
    // next scene (after restart) can take over without reconnecting.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.wsSyncManager?.detach();
    });

    this.stageCleared = false;
    this.stageAdvanceAt = 0;
    this.reconcileHeroes();
    this.syncStore();
  }

  update(time: number, deltaMs: number): void {
    const store = useGameStore.getState();
    if (store.gamePaused) return;
    // Gameplay is WebSocket-only: freeze the simulation while the socket is
    // down so heroes don't burn energy / drop bombs that never reach the
    // server. The HUD shows a blocking reconnect overlay meanwhile.
    if (store.connectionLost || store.sessionError) return;
    const deltaSec = deltaMs / 1000;

    this.pathfinding.tick();

    this.bombs.update(time, (b) => {
      // Each exploded bomb consumes 1 Energy from its owner. Hero sleeps at 0.
      useGameStore.getState().consumeBombEnergy(b.ownerId);
      const { destroyed, hitKeys } = this.explosions.detonate(b.tileX, b.tileY, b.range, b.damage, b.ownerId);
      // Coins are auto-credited when a chest is destroyed — no pickup needed.
      // Credit optimistically so the HUD balance ticks up instantly; the WS
      // engine's BOMB_DETONATE_ACK reconciles the authoritative running total.
      let coinGain = 0;
      for (const d of destroyed) coinGain += d.coins;
      if (coinGain > 0) useGameStore.getState().addOptimisticCoins(coinGain);

      // WS mode: send ONE detonation event per bomb (not per node, not per
      // frame tick). It carries every destructible tile the blast touched plus
      // the hero's power, so the server applies identical damage and never
      // resurrects tiles the client already cleared.
      if (hitKeys.length > 0) {
        this.map.notifyBombDetonate(b.ownerId, hitKeys, b.damage);
      }
    });
    this.explosions.update(time);


    const stepAlong = (h: import("../entities/Hero").Hero, dt: number) =>
      this.heroes.stepAlongPath(h, dt);

    for (const hero of this.heroes.heroes) {
      this.ai.update(hero, time, deltaSec, stepAlong);
    }

    // Energy: drain on-map, recover resting. May flip onMap=false when depleted.
    useGameStore.getState().tickEnergy(deltaSec);

    if (time - this.lastSync > 200) {
      this.lastSync = time;
      this.reconcileHeroes();
      this.syncStore();
    }

    // Stage progression: when all chests are gone and no bombs pending, validate the run.
    // Guard: totalChests must be > 0 so an unhydrated (blank) map never triggers a false clear.
    if (!this.stageCleared && this.map.isStageLoaded() && this.map.chestCount() === 0 && this.bombs.getBombs().length === 0) {
      this.stageCleared = true;
      useGameStore.getState().setStageValidating(true);

      const advanceScene = () => {
        useGameStore.getState().setStageValidating(false);
        useGameStore.getState().setStageValidated(true);
        this.time.delayedCall(1800, () => {
          useGameStore.getState().setStageValidated(false);
          useGameStore.getState().advanceStage();
          this.scene.restart();
        });
      };

      // Tell the WS engine to flush and advance. The server auto-advances the
      // stage on the clearing hit and pushes a fresh SESSION_STATE for the new
      // map; the scene restart below re-attaches to the same shared socket.
      const flushPromise = this.wsSyncManager
        ? this.wsSyncManager.flush()
        : Promise.resolve();

      flushPromise
        .then(advanceScene)
        .catch((err) => {
          console.error("[TreasureScene] stage validate flush failed:", err);
          // On error still advance — worst case is some unconfirmed actions.
          advanceScene();
        });
    }
  }

  /** Sync live map heroes with the store's roster onMap flags. */
  private reconcileHeroes(): void {
    const roster = useGameStore.getState().roster;
    const wanted = new Map(roster.filter((r) => r.onMap).map((r) => [r.id, r] as const));
    // Remove heroes no longer wanted (e.g. sent home to rest).
    for (const h of [...this.heroes.heroes]) {
      if (!wanted.has(h.id)) this.heroes.remove(h);
    }
    const existing = new Set(this.heroes.heroes.map((h) => h.id));
    for (const [id, r] of wanted) {
      if (existing.has(id)) continue;
      const spawn = this.findSpawnTile();
      if (!spawn) break;
      this.heroes.spawn({
        id,
        tileX: spawn.x,
        tileY: spawn.y,
        rarity: (r.rarity ?? HeroRarity.Common) as HeroRarity,
        type: r.type as HeroType,
        preset: {
          power: r.attributes.power,
          speed: r.attributes.speed,
          stamina: r.attributes.stamina,
          bombNum: r.attributes.bomb_number,
          bombRange: r.attributes.bomb_range,
          energy: r.maxEnergy,
        },
      });
    }
  }

  /** Pick a random free grass tile that's well-separated from existing heroes. */
  private findSpawnTile(): { x: number; y: number } | null {
    const others = this.heroes.heroes.map((h) => ({ x: h.tileX, y: h.tileY }));
    const occupied = new Set(others.map((o) => `${o.x},${o.y}`));
    const all: { x: number; y: number }[] = [];
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      for (let x = 1; x < MAP_WIDTH - 1; x++) {
        if (this.map.grid[y][x] !== TileType.Grass) continue;
        if (occupied.has(`${x},${y}`)) continue;
        all.push({ x, y });
      }
    }
    if (!all.length) return null;
    // Try progressively looser separation until we find candidates.
    for (const minDist of [7, 5, 3, 2, 1]) {
      const ok = all.filter((c) =>
        others.every((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) >= minDist),
      );
      if (ok.length) return ok[Math.floor(Math.random() * ok.length)];
    }
    return all[Math.floor(Math.random() * all.length)];
  }

  private syncStore(): void {
    const roster = useGameStore.getState().roster;
    const energyById = new Map(roster.map((r) => [r.id, r.currentEnergy] as const));
    const snap = this.heroes.heroes.map((h) => ({
      id: h.id,
      tileX: h.tileX,
      tileY: h.tileY,
      state: h.state,
      type: h.type,
      rarity: h.rarity,
      rarityLabel: h.rarityLabel,
      power: h.power,
      speed: h.speedStat,
      stamina: h.stamina,
      bombNum: h.bombNum,
      bombRange: h.bombRange,
      energy: h.energy,
      currentEnergy: energyById.get(h.id) ?? 0,
    }));
    useGameStore.getState().setMapHeroes(snap);
  }
}

