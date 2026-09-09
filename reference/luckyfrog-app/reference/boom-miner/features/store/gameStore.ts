'use client';

import { create } from "zustand";
import {
  HeroRarity,
  HeroType,
  pickHeroRarity,
  pickHeroType,
  rollHeroAttributes,
  HERO_RARITY_DEFS,
} from "@/features/types/HeroRarity";
import {
  MINT_COST,
  MAX_ON_MAP,
  ENERGY_PER_STAMINA,
  RECOVERY_FRACTION_PER_INTERVAL,
  RECOVERY_INTERVAL_SECONDS,
  maxEnergyFor,
} from "@/lib/constants/game";
import type { ProcessedTx } from "@/hooks/useSettlementNotifier";

// Re-export so client code can still import these from "@/features/store/gameStore".
export { MINT_COST, MAX_ON_MAP, ENERGY_PER_STAMINA, RECOVERY_FRACTION_PER_INTERVAL, RECOVERY_INTERVAL_SECONDS, maxEnergyFor };

export interface HeroSnapshot {
  id: string;
  tileX: number;
  tileY: number;
  state: string;
  type: string;
  rarity: string;
  rarityLabel: string;
  power: number;
  speed: number;
  stamina: number;
  bombNum: number;
  bombRange: number;
  energy: number;
  currentEnergy: number;
}

/** NFT-style character metadata attributes. */
export interface HeroAttributesMeta {
  power: number;
  speed: number;
  stamina: number;
  bomb_number: number;
  bomb_range: number;
}

/** Marketplace listing metadata. */
export interface HeroMarketMeta {
  listed: boolean;
  price: number;
  seller: string | null;
  created: number;
  sold: number;
}

/**
 * Persistent owned hero, shaped as an NFT metadata record.
 * Runtime-only fields (type, rarityLabel, currentEnergy, maxEnergy, onMap)
 * live alongside the metadata for gameplay state.
 */
export interface RosterHero {
  // --- Internal identity (MongoDB _id string) ---
  id: string;

  // --- NFT metadata (canonical format) ---
  name: string;
  /** Sequential mint number — unique, server-assigned. Used as #1234 in UI. */
  minted_number: number;
  description: string;
  image: string | null;
  owner: string;
  level: number;
  rarity: HeroRarity | null;
  attributes: HeroAttributesMeta;
  market: HeroMarketMeta;

  // --- Runtime game state (not persisted to metadata) ---
  type: HeroType;
  rarityLabel: string;
  /** Current energy points. Max = stamina * ENERGY_PER_STAMINA. Each exploded bomb consumes 1. */
  currentEnergy: number;
  /** Cached max energy (stamina * ENERGY_PER_STAMINA). */
  maxEnergy: number;
  onMap: boolean;
}

/**
 * Stage map snapshot embedded in /api/bootstrap and pushed by the WS engine.
 * Consumed by MapManager on hydration.
 */
export interface SyncStageMap {
  stage: number;
  seed: number;
  width: number;
  height: number;
  nodes: Record<string, {
    x: number;
    y: number;
    kind: "chest" | "bush";
    rarity?: string;
    maxHp: number;
    hp: number;
    coins: number;
    destroyed: boolean;
  }>;
  totalChests: number;
  clearedChests: number;
}

/**
 * Shape returned by GET /api/bootstrap.
 * Server-authoritative fields only — cosmetics stay on the client.
 */
export interface BootstrapPayload {
  player: {
    wallet: string;
    username: string | null;
    coins: number;
    stage: number;
  };
  /** Raw IHero documents from the server — mapped to RosterHero on hydration. */
  heroes: RosterHero[];
  /** Full node snapshot from the server. Consumed by MapManager on first boot. */
  stageMap?: SyncStageMap;
}



/**
 * Maps a raw IHero lean document (as returned by the server) into the
 * RosterHero shape used throughout the client store and HUD.
 * IHero uses `attributes.bombNumber / bombRange` (camelCase from Mongoose);
 * RosterHero uses `attributes.bomb_number / bomb_range` (NFT snake_case).
 */
export function iHeroToRosterHero(h: {
  _id?: unknown;
  ownerWallet?: string;
  minted_number: number;
  name: string;
  type: string;
  rarity: string;
  level: number;
  attributes: {
    power: number;
    speed: number;
    stamina: number;
    bombNumber?: number;
    bomb_number?: number;
    bombRange?: number;
    bomb_range?: number;
  };
  currentEnergy: number;
  maxEnergy: number;
  onMap: boolean;
  market: { listed: boolean; price: number; seller: string | null; created: number; sold: number };
}): RosterHero {
  const stamina = h.attributes.stamina;
  const maxE = h.maxEnergy ?? maxEnergyFor(stamina);
  return {
    id:           String(h._id ?? h.minted_number),
    name:         h.name,
    minted_number: h.minted_number,
    description:  HERO_DESCRIPTION,
    image:        null,
    owner:        h.ownerWallet ?? "",
    level:        h.level,
    rarity:       h.rarity as HeroRarity,
    attributes: {
      power:        h.attributes.power,
      speed:        h.attributes.speed,
      stamina,
      bomb_number:  h.attributes.bombNumber ?? h.attributes.bomb_number ?? 1,
      bomb_range:   h.attributes.bombRange  ?? h.attributes.bomb_range  ?? 1,
    },
    market:       h.market,
    type:         h.type as HeroType,
    rarityLabel:  HERO_RARITY_DEFS[h.rarity as HeroRarity]?.label ?? h.rarity,
    currentEnergy: h.currentEnergy,
    maxEnergy:    maxE,
    onMap:        h.onMap,
  };
}

const HERO_DESCRIPTION =
  "Boom Miner Heroes are non-fungible characters that mine treasure by placing bombs across the map. Each hero is randomly generated with a unique combination of Power, Speed, Stamina, Bomb Number, and Bomb Range that determines how effectively they clear terrain and collect $BMCOIN.";

let nextIdSeed = 1;
function makeHero(rarity?: HeroRarity, type?: HeroType): RosterHero {
  const r = rarity ?? pickHeroRarity(Math.random);
  const t = type ?? pickHeroType();
  const a = rollHeroAttributes(r);
  const minted_number = Math.floor(10000 + Math.random() * 89999);
  const maxE = maxEnergyFor(a.stamina);
  return {
    id: `hero-${nextIdSeed++}-${minted_number}`,

    // NFT metadata
    name: t,
    minted_number,
    description: HERO_DESCRIPTION,
    image: null,
    owner: "boom_miner",
    level: 1,
    rarity: r,
    attributes: {
      power: a.power,
      speed: a.speed,
      stamina: a.stamina,
      bomb_number: a.bombNum,
      bomb_range: a.bombRange,
    },
    market: {
      listed: false,
      price: 0,
      seller: null,
      created: 0,
      sold: 0,
    },

    // Runtime state
    type: t,
    rarityLabel: HERO_RARITY_DEFS[r].label,
    currentEnergy: maxE,
    maxEnergy: maxE,
    onMap: false,
  };
}

/**
 * Dev/demo-only roster used by the /test-modals page so the Heroes modal
 * renders a populated list without a live server. Produces a spread of
 * rarities and runtime states (deployed, ready, resting, sleeping).
 */
export function createMockRoster(): RosterHero[] {
  const deployed = makeHero(HeroRarity.Epic);
  deployed.onMap = true;

  const ready = makeHero(HeroRarity.Legendary);

  const resting = makeHero(HeroRarity.Rare);
  resting.currentEnergy = Math.floor(resting.maxEnergy * 0.4);

  const sleeping = makeHero(HeroRarity.Uncommon);
  sleeping.currentEnergy = 0;

  const common = makeHero(HeroRarity.Common);

  return [deployed, ready, resting, sleeping, common];
}

interface GameState {
  /** Authenticated player wallet address (base58). Set on hydrate. */
  wallet: string | null;
  /** Server-confirmed coin balance (authoritative, set only by the server). */
  coins: number;
  /**
   * Optimistic, not-yet-confirmed coin gains from chests the client has
   * destroyed locally but the WS engine has not acked yet. The displayed
   * balance is `coins + pendingCoins`; this drains back toward 0 as
   * hydrateFromServer lands the authoritative running total. This is what
   * makes the balance tick up instantly on each chest destroy instead of
   * waiting for the server round-trip / 5s flush.
   */
  pendingCoins: number;
  mapHeroes: HeroSnapshot[];
  roster: RosterHero[];
  stage: number;
  gamePaused: boolean;
  selectedHero: string | null;
  /**
   * True once GET /api/bootstrap has completed and hydrate() has been called.
   * DynamicPhaserGame uses this to defer mounting until the store is populated,
   * so MapManager.syncFromServer() always finds bootstrapStageMap ready.
   */
  bootstrapped: boolean;
  /**
   * Stage map received from /api/bootstrap. MapManager reads this on first
   * boot; thereafter the WS engine's SESSION_STATE is authoritative.
   * Cleared to null after MapManager consumes it.
   */
  bootstrapStageMap: SyncStageMap | null;
  clearBootstrapStageMap: () => void;
  /**
   * Single-call hydration from GET /api/bootstrap.
   * Replaces all server-authoritative fields in one atomic update.
   */
  hydrate: (payload: BootstrapPayload) => void;
  /**
   * Called after login/register to replace coins + stage with server values.
   * Server is authoritative for both; client mock seeds are dropped.
   */
  hydrateFromServer: (coins: number, stage: number) => void;
  /**
   * Called after GET /api/heroes to replace the local roster with server data.
   * Server is authoritative for the roster; local mock seeds are dropped.
   */
  hydrateRoster: (heroes: RosterHero[]) => void;
  /**
   * Reconcile after any API response. Merges only the server-authoritative
   * fields (coins, stage) without touching client-owned state (selectedHero).
   */
  reconcile: (patch: { coins?: number; stage?: number }) => void;
  /**
   * txHash of the most recently settled mint / withdrawal, as detected by the
   * global settlement poller (useSettlementNotifier). Modals watch these to
   * react to their own completion; the authoritative balance + roster refresh
   * arrives separately over the WS player:state push.
   */
  lastMintTxHash: string | null;
  lastWithdrawalTxHash: string | null;
  /** Full settled mint transaction, including metadata (hero IDs, minted numbers). */
  lastMintTx: ProcessedTx | null;
  /** Records a freshly-detected settlement of the given type. */
  setSettlement: (type: "mint" | "withdrawal", txHash: string, tx?: ProcessedTx) => void;
  /**
   * Optimistically credit coins from a locally-destroyed chest, before the WS
   * engine confirms it. Increments pendingCoins so the HUD balance updates
   * instantly; the value is reconciled away when hydrateFromServer lands the
   * authoritative total.
   */
  addOptimisticCoins: (n: number) => void;
  setMapHeroes: (heroes: HeroSnapshot[]) => void;
  setPaused: (p: boolean) => void;
  selectHero: (id: string | null) => void;
  mint: (count: number) => { ok: boolean; minted: RosterHero[] };
  setHeroOnMap: (id: string, onMap: boolean) => void;
  /**
   * Transient deploy/recall error surfaced by the WS engine's
   * HERO_DEPLOY_REJECT. Read by the Heroes modal; cleared on a new attempt or
   * a successful ack.
   */
  deployError: string | null;
  setDeployError: (message: string | null) => void;
  /** Called when an owned bomb detonates. Consumes 1 Energy; hero sleeps at 0. */
  consumeBombEnergy: (ownerId: string) => void;
  /** Called every frame. Recovers energy for resting heroes at 1 per 5 minutes. */
  tickEnergy: (deltaSec: number) => void;
  /**
   * Called by MapManager.applyServerState() after a sync-log response.
   * Patches currentEnergy for each hero in the map to server-authoritative values.
   */
  patchRosterEnergy: (energyMap: Record<string, number>) => void;
  /** Seeded mock marketplace listings shown in the Market modal. */
  marketListings: RosterHero[];
  /** Purchase a listing. Deducts $BMCOIN and moves the hero into the roster. */
  buyListing: (listingId: string) => { ok: boolean };
  advanceStage: () => void;
  /** Set to true when chests are cleared and the sync-log flush is in flight. */
  stageValidating: boolean;
  /** Set to true once the server confirms the run; triggers the "Stage Clear" banner. */
  stageValidated:  boolean;
  setStageValidating: (v: boolean) => void;
  setStageValidated:  (v: boolean) => void;
  /**
   * Non-null when the WS engine has forcibly terminated this session,
   * e.g. because the player opened a second browser tab.
   * HUD reads this to show a blocking overlay and prevent reconnect.
   */
  sessionError: string | null;
  setSessionError: (message: string | null) => void;
  /**
   * True whenever the real-time WebSocket is not currently connected
   * (initial connect pending, dropped, or reconnecting). Gameplay is
   * WebSocket-only, so while this is true the HUD shows a blocking
   * "reconnecting" overlay and no gameplay mutation can reach the server.
   * Set to false once the socket (re)connects.
   */
  connectionLost: boolean;
  setConnectionLost: (lost: boolean) => void;
}

// Seed mock marketplace listings so the market is populated on first open.
const SELLER_NAMES = ["dustx", "boomlord", "miner42", "pixelknight", "cryptik", "bombking", "zap_o", "nova"];
function seedListings(count: number): RosterHero[] {
  const out: RosterHero[] = [];
  for (let i = 0; i < count; i++) {
    const h = makeHero();
    const rIdx = ["common", "uncommon", "rare", "epic", "legendary"].indexOf(h.rarity ?? "common");
    const basePrice = [15, 65, 220, 480, 1200][Math.max(0, rIdx)] ?? 15;
    const jitter = 0.75 + Math.random() * 0.6;
    h.market = {
      listed: true,
      price: Math.round(basePrice * jitter * 100) / 100,
      seller: SELLER_NAMES[Math.floor(Math.random() * SELLER_NAMES.length)],
      created: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 72),
      sold: 0,
    };
    h.level = 1 + Math.floor(Math.random() * Math.max(1, rIdx * 4 + 2));
    out.push(h);
  }
  return out;
}

export const useGameStore = create<GameState>((set, get) => ({
  stageValidating:    false,
  stageValidated:     false,
  setStageValidating: (v) => set({ stageValidating: v }),
  setStageValidated:  (v) => set({ stageValidated: v }),
  sessionError:    null,
  setSessionError: (message) => set({ sessionError: message }),
  // Start "lost" — the socket has not connected yet on first mount. The
  // WSSyncManager flips this to false on 'connect'. When the game is not in
  // WS mode this stays false (set explicitly by TreasureScene).
  connectionLost:    true,
  setConnectionLost: (lost) => set({ connectionLost: lost }),
  // Wallet + coins are hydrated from the server after login.
  wallet: null,
  // Coins start at 0 — hydrated from the server after login via hydrateFromServer().
  coins: 0,
  pendingCoins: 0,
  mapHeroes: [],
  roster: [],
  marketListings: seedListings(24),
  stage: 1,
  gamePaused: false,
  selectedHero: null,
  bootstrapped: false,
  bootstrapStageMap: null,
  clearBootstrapStageMap: () => set({ bootstrapStageMap: null }),
  hydrate: ({ player, heroes, stageMap }) =>
    set({ wallet: player.wallet, coins: player.coins, pendingCoins: 0, stage: player.stage, roster: heroes, bootstrapStageMap: stageMap ?? null, bootstrapped: true }),
  hydrateFromServer: (coins, stage) => set((s) => {
    // The authoritative total now includes some (or all) of what we credited
    // optimistically. Draw the confirmed gain out of pendingCoins so the
    // displayed balance (coins + pendingCoins) stays stable instead of being
    // stomped back down, and converges to the server total as acks land.
    const confirmedGain = Math.max(0, coins - s.coins);
    return { coins, stage, pendingCoins: Math.max(0, s.pendingCoins - confirmedGain) };
  }),
  hydrateRoster: (heroes) => set({ roster: heroes }),
  reconcile: (patch) => set((s) => ({
    ...(patch.coins  !== undefined ? { coins: patch.coins }   : {}),
    ...(patch.stage  !== undefined ? { stage: patch.stage }   : {}),
  })),
  lastMintTxHash: null,
  lastWithdrawalTxHash: null,
  lastMintTx: null,
  setSettlement: (type, txHash, tx) =>
    set(type === "mint"
      ? { lastMintTxHash: txHash, lastMintTx: tx ?? null }
      : { lastWithdrawalTxHash: txHash }),
  addOptimisticCoins: (n) => set((s) => ({ pendingCoins: s.pendingCoins + n })),
  setMapHeroes: (mapHeroes) => set({ mapHeroes }),
  setPaused: (gamePaused) => set({ gamePaused }),
  selectHero: (id) => set({ selectedHero: id }),
  deployError: null,
  setDeployError: (message) => set({ deployError: message }),
  mint: (count) => {
    const cost = count * MINT_COST;
    const s = get();
    if (s.coins < cost) return { ok: false, minted: [] };
    const minted: RosterHero[] = [];
    for (let i = 0; i < count; i++) minted.push(makeHero());
    set({ coins: s.coins - cost, roster: [...s.roster, ...minted] });
    return { ok: true, minted };
  },
  setHeroOnMap: (id, onMap) =>
    set((s) => {
      const currentOnMap = s.roster.filter((h) => h.onMap).length;
      const target = s.roster.find((h) => h.id === id);
      if (!target) return s;
      if (onMap) {
        if (currentOnMap >= MAX_ON_MAP) return s;
        // Sleep mode: must have at least 1 energy to deploy.
        if (target.currentEnergy < 1) return s;
      }
      return {
        roster: s.roster.map((h) => (h.id === id ? { ...h, onMap } : h)),
      };
    }),
  consumeBombEnergy: (ownerId) =>
    set((s) => {
      let changed = false;
      const roster = s.roster.map((h) => {
        if (h.id !== ownerId) return h;
        const next = Math.max(0, h.currentEnergy - 1);
        if (next === h.currentEnergy) return h;
        changed = true;
        if (next <= 0) return { ...h, currentEnergy: 0, onMap: false }; // sleep mode
        return { ...h, currentEnergy: next };
      });
      return changed ? { roster } : s;
    }),
  tickEnergy: (deltaSec) =>
    set((s) => {
      let changed = false;
      const roster = s.roster.map((h) => {
        if (h.onMap) return h; // energy only changes via consumeBombEnergy
        const max = h.maxEnergy;
        if (h.currentEnergy >= max) return h;
        // 10% of max energy per 5 minutes.
        const gain = (max * RECOVERY_FRACTION_PER_INTERVAL * deltaSec) / RECOVERY_INTERVAL_SECONDS;
        const next = Math.min(max, h.currentEnergy + gain);
        if (next === h.currentEnergy) return h;
        changed = true;
        return { ...h, currentEnergy: next };
      });
      return changed ? { roster } : s;
    }),
  buyListing: (listingId) => {
    const s = get();
    const listing = s.marketListings.find((l) => l.id === listingId);
    if (!listing) return { ok: false };
    const price = listing.market.price;
    if (s.coins < price) return { ok: false };
    const bought: RosterHero = {
      ...listing,
      owner: "boom_miner",
      market: { listed: false, price: 0, seller: null, created: 0, sold: listing.market.sold + 1 },
    };
    set({
      coins: s.coins - price,
      marketListings: s.marketListings.filter((l) => l.id !== listingId),
      roster: [...s.roster, bought],
    });
    return { ok: true };
  },
  patchRosterEnergy: (energyMap) =>
    set((s) => {
      let changed = false;
      const roster = s.roster.map((h) => {
        const next = energyMap[h.id];
        if (next === undefined || next === h.currentEnergy) return h;
        changed = true;
        return { ...h, currentEnergy: next };
      });
      return changed ? { roster } : s;
    }),
  advanceStage: () => set((s) => ({ stage: s.stage + 1 })),
}));

if (typeof window !== "undefined") {
  (window as unknown as { __gameStore?: typeof useGameStore }).__gameStore = useGameStore;
  (window as unknown as { __makeHero?: (r?: HeroRarity) => RosterHero }).__makeHero = (r?: HeroRarity) => makeHero(r);
}
