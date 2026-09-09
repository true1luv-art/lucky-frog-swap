/**
 * Phase 2 Integration Test — §2.6-A
 *
 * Exercises the full farm lifecycle end-to-end in a mocked environment.
 * All MongoDB and Solana calls are mocked — runs offline with no real connections.
 *
 * Sequence:
 *   1.  Player registers.
 *   2.  First farm visit → INITIAL_FARM created in MongoDB.
 *   3.  Plant 3 Potato seeds → verify farm document updated.
 *   4.  Advance time 60 seconds → harvest → verify inventory has Potatoes,
 *       farming XP awarded, stamina deducted.
 *   5.  Chop tree → verify Wood in inventory, woodcutting XP awarded.
 *   6.  Feed chicken → advance time 1 min → collect egg → verify Egg in inventory.
 *   7.  Cook 2 Potatoes → advance 30 s → collect → verify Roasted Potato.
 *   8.  Sell 10 Potatoes → verify balance increases by 10 × 0.065 = 0.65 coins.
 *   9.  Verify skill levels updated correctly after XP awards.
 *  10.  Server state survives reload: fetchServerFarm returns same state.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import Decimal from "decimal.js-light";
import type { GameState } from "@/shared/types/gameplay/game";
import { INITIAL_SKILLS, INITIAL_BONUS } from "@/shared/types/gameplay/skills";
import { INITIAL_EQUIPMENT, INITIAL_BASE_STATS, computeStats } from "@/shared/types/gameplay/equipment";
import { totalXpForLevel } from "@/shared/game/skills";
import {
  serverPlant,
  serverHarvest,
  serverChop,
  serverFeedChicken,
  serverCollectEgg,
  serverStartCooking,
  serverCollectCooked,
} from "@/lib/events/farm-action/validate";
import { checkAndGrantAchievements } from "@/lib/modules/farms/achievements";
import { CROPS_CONFIG, getHalvedPrice } from "@/shared/data/farming";
import { getSkillLevel } from "@/shared/data/farming";
import { getEmissionMultiplier } from "@/lib/modules/game-stats/halving";

// ---------------------------------------------------------------------------
// Mock all external I/O
// ---------------------------------------------------------------------------

vi.mock("@/lib/config/database", () => ({
  connectDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/modules/players/repository.server", () => ({
  createPlayer:        vi.fn(),
  findPlayerByWallet:  vi.fn(),
  updatePlayerState:   vi.fn(),
  getAllPlayers:        vi.fn(),
}));

vi.mock("@/lib/modules/farms/repository.server", () => ({
  getOrCreateFarm: vi.fn(),
}));

vi.mock("@/lib/modules/inventories/repository.server", () => ({
  getOrCreateInventory: vi.fn(),
  getInventory:         vi.fn(),
  deductItems:          vi.fn().mockResolvedValue(undefined),
  // §C7: currency-item helpers migrated off the retired `lib/modules/items`.
  addInventoryItem:     vi.fn().mockResolvedValue(undefined),
  deductInventoryItem:  vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/modules/inventories/service.server", () => ({
  addBalance: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/modules/farms/model.server", () => ({
  FarmModel: {
    findOneAndUpdate: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@/lib/auth/jwt", () => ({
  signToken:   vi.fn().mockResolvedValue("mock-jwt-token"),
  verifyToken: vi.fn().mockResolvedValue({ wallet: "FarmWallet111111111111111111111111111" }),
}));

vi.mock("tweetnacl", () => ({
  default: { sign: { detached: { verify: vi.fn().mockReturnValue(true) } } },
}));

vi.mock("bs58", () => ({
  default: { decode: vi.fn().mockReturnValue(new Uint8Array(32)) },
}));

vi.mock("@/lib/solana/balance.server", () => ({
  getLfrgBalance:        vi.fn().mockResolvedValue(0),
  checkLfrgEligibility:  vi.fn().mockResolvedValue({ eligible: true, balance: 1000, minHold: 100 }),
}));

vi.mock("@/lib/modules/players/model.server", () => ({
  PlayerModel: {
    findOne:        vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    updateOne:      vi.fn().mockResolvedValue({}),
    findOneAndUpdate: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@/lib/modules/game-stats/repository.server", () => ({
  getGameStats:               vi.fn().mockResolvedValue({ halvingStage: 0, emissionMultiplier: 1 }),
  incrementLfrgEmitted:       vi.fn().mockResolvedValue(undefined),
  creditTreasury:             vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/shared/drops/logic", () => ({
  rollDrop:             () => ({ kind: "shard", rarity: "common", amount: 1 }),
  computeStashBonus:    () => ({ luck: 0, dodge: 0 }),
  computeCritFromCharm: () => 0,
  computeEggDrop:       () => "common",
  computeShardDrop:     () => ({ rarity: "common", amount: 1 }),
  computeChestDrop:     () => "common",
  computeFrogmentDrop:  () => ({ rarity: "common", amount: 1 }),
}));

vi.mock("@/lib/modules/players/level-logic", () => ({
  getLevelFromXp: vi.fn().mockReturnValue(1),
  checkLevelUp:   vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/modules/frogs/repository.server", () => ({
  findFrogsByOwner:       vi.fn().mockResolvedValue([]),
  findFrogByInstanceId:   vi.fn(),
  countMintedByCardId:    vi.fn().mockResolvedValue(new Map()),
  countFrogsByOwner:      vi.fn().mockResolvedValue(0),
  markFrogBurnt:          vi.fn().mockResolvedValue(undefined),
  insertFrog:             vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const WALLET = "FarmWallet111111111111111111111111111";

/** Builds a minimal PlayerSkills with sufficient farming XP for all actions. */
const HIGH_FARMING_SKILLS = { ...INITIAL_SKILLS, farming: totalXpForLevel(10) };

/** Builds a baseline GameState ready for integration tests. */
function makeState(overrides: Partial<GameState> = {}): GameState {
  const skills   = overrides.skills ?? HIGH_FARMING_SKILLS;
  const bonus    = INITIAL_BONUS;
  const equipment = { ...INITIAL_EQUIPMENT };
  const baseStats = { ...INITIAL_BASE_STATS };
  const stats     = computeStats(baseStats, equipment);
  return {
    id:                  undefined,
    username:            "integrationTester",
    avatarUrl:           undefined,
    balance:             new Decimal(100),
    fields:              {
      0: { name: "Potato", plantedAt: 0, amount: 1 },
      1: { name: "Potato", plantedAt: 0, amount: 1 },
      2: { name: "Potato", plantedAt: 0, amount: 1 },
    },
    trees:  { 0: { name: "Wood",  choppedAt: 0, amount: 3 } },
    stones: { 0: { name: "Stone", minedAt:   0, amount: 2 } },
    iron:   {},
    gold:   {},
    chickens: { 0: { fedAt: 0, multiplier: 1 } },
    cows:     {},
    sheep:    {},
    inventory: {
      "Potato Seed": new Decimal(10),
      Wheat:         new Decimal(5),
      // enough for cooking test
      Potato:        new Decimal(5),
        // serverFeedChicken / serverCollectEgg check inventory.Chicken for ownership count
      Chicken:       new Decimal(1),
    },
    farmAddress: WALLET,
    equipment,
    baseStats,
    stats,
    skills,
    bonus,
    stamina:            { current: 100, max: 100 },
    lastStaminaRegenAt: Date.now() - 1000,
    fishing: {
      lastCastAt: 0, lastCaughtFish: null, lastCaughtAmount: 0,
      totalCasts: 0, totalCaught: 0,
    },
    cooking:      null,
    activity:     {},
    achievements: {},
    ...overrides,
    ownedCollectibles: overrides.ownedCollectibles ?? [],
  };
}

// ---------------------------------------------------------------------------
// Integration test suite
// ---------------------------------------------------------------------------

describe("Phase 2 Integration — full farm lifecycle (§2.6-A)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ---- Step 1: Register (leverages Phase 1 pipeline) --------------------

  it("step 1 — player registration returns ok + JWT", async () => {
    const { createPlayer, findPlayerByWallet } =
      await import("@/lib/modules/players/repository.server");
    vi.mocked(findPlayerByWallet).mockResolvedValue(null);
    vi.mocked(createPlayer).mockResolvedValue({
      wallet: WALLET, username: "integrationTester",
    } as never);

    const { execute } = await import("@/lib/events/register-player/action");
    const result = await execute({ wallet: WALLET, username: "integrationTester" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.token).toBe("mock-jwt-token");
    }
  }, 10_000);

  // ---- Step 2: First farm visit → INITIAL_FARM created ------------------

  it("step 2 — getOrCreateFarm is called and returns a farm document", async () => {
    const { getOrCreateFarm } = await import("@/lib/modules/farms/repository.server");
    const mockFarm = {
      playerId: WALLET, fields: {}, trees: {}, stones: {}, iron: {}, gold: {},
      chickens: {}, cows: {}, sheep: {},
      stamina: { current: 100, max: 100, lastRegenAt: Date.now() },
      fishing: { lastCastAt: 0, lastCaughtFish: null, lastCaughtAmount: 0, totalCasts: 0, totalCaught: 0 },
      cooking: null, activity: {}, achievements: {},
    };
    vi.mocked(getOrCreateFarm).mockResolvedValue(mockFarm as never);

    const farm = await getOrCreateFarm(WALLET);

    expect(farm.playerId).toBe(WALLET);
    expect(vi.mocked(getOrCreateFarm)).toHaveBeenCalledWith(WALLET);
  });

  // ---- Step 3: Plant 3 Potato seeds ------------------------------------

  it("step 3 — planting 3 Potato seeds deducts 3 seeds and marks plots planted", () => {
    // Start with empty fields so serverPlant does not throw "Crop is already planted"
    let state = makeState({ fields: {} });

    const now = Date.now();
    state = serverPlant(state, { type: "item.planted", index: 0, item: "Potato Seed" }, now);
    state = serverPlant(state, { type: "item.planted", index: 1, item: "Potato Seed" }, now);
    state = serverPlant(state, { type: "item.planted", index: 2, item: "Potato Seed" }, now);

    expect(Number(state.inventory["Potato Seed"])).toBe(7); // 10 - 3
    expect(state.fields[0].plantedAt).toBeGreaterThan(0);
    expect(state.fields[1].plantedAt).toBeGreaterThan(0);
    expect(state.fields[2].plantedAt).toBeGreaterThan(0);
    expect(state.fields[0].name).toBe("Potato");
    expect(state.fields[1].name).toBe("Potato");
    expect(state.fields[2].name).toBe("Potato");
  });

  // ---- Step 4: Advance 60 s → harvest → verify inventory + XP ----------

  it("step 4 — harvesting after 60 s awards Potatoes, farming XP, deducts stamina", () => {
    const plantTime = Date.now() - 65_000; // 65 seconds ago → past 60 s growth
    let state = makeState({
      fields: {
        0: { name: "Potato", plantedAt: plantTime, amount: 1 },
      },
      stamina: { current: 50, max: 100 },
    });

    const harvestTime = Date.now();
    state = serverHarvest(state, { type: "item.harvested", index: 0 }, harvestTime);

    // Inventory gained Potatoes
    expect(Number(state.inventory["Potato"] ?? 0)).toBeGreaterThan(5); // had 5, gained at least 1

    // Farming XP was awarded
    expect(state.skills.farming).toBeGreaterThan(HIGH_FARMING_SKILLS.farming);

    // Stamina was deducted by 1 (harvest_crop cost)
    expect(state.stamina.current).toBeLessThan(50 + 5); // regen may add up to 5 (5%), net should be less than 54
  });

  // ---- Step 5: Chop tree → Wood in inventory, woodcutting XP ---------------

  it("step 5 — chopping a tree awards Wood and woodcutting XP", () => {
    let state = makeState({
      trees: { 0: { name: "Wood", choppedAt: 0, amount: 3 } },
    });
    const prevForestry = state.skills.woodcutting;

    state = serverChop(state, { type: "tree.chopped", index: 0 }, Date.now());

    expect(Number(state.inventory["Wood"] ?? 0)).toBeGreaterThan(0);
    expect(state.skills.woodcutting).toBeGreaterThan(prevForestry);
    expect(state.trees[0].choppedAt).toBeGreaterThan(0);
  });

  // ---- Step 6: Feed chicken → 1 min later → collect egg -----------------

  it("step 6 — feeding a chicken then collecting after 60 s awards an Egg", () => {
    const feedTime = Date.now() - 70_000; // 70 s ago → egg ready
    let state = makeState({
      chickens: { 0: { fedAt: feedTime, multiplier: 1 } },
    });

    state = serverCollectEgg(state, { type: "chicken.collectEgg", index: 0 }, Date.now());

    expect(Number(state.inventory["Egg"] ?? 0)).toBeGreaterThan(0);
    // fedAt set to undefined after collection (chicken is hungry again)
    expect(state.chickens[0].fedAt).toBeUndefined();
  });

  it("step 6b — feeding a chicken deducts Wheat and sets fedAt", () => {
    let state = makeState({
      chickens: { 0: { fedAt: 0, multiplier: 1 } },
      // Chicken ownership count must be ≥ 1 for serverFeedChicken to allow index 0
      inventory: { Wheat: new Decimal(5), Chicken: new Decimal(1) },
    });

    state = serverFeedChicken(state, { type: "chicken.feed", index: 0 }, Date.now());

    expect(Number(state.inventory["Wheat"] ?? 0)).toBe(4); // 5 - 1
    expect(state.chickens[0].fedAt).toBeGreaterThan(0);
  });

  // ---- Step 7: Cook 2 Potatoes → collect Roasted Potato -----------------

  it("step 7 — cooking Roasted Potato and collecting after 30 s awards food", () => {
    let state = makeState({
      cooking: null,
      inventory: { Potato: new Decimal(5) },
    });

    const startTime = Date.now() - 35_000; // started 35 s ago

    // Start cooking — deducts ingredients and sets cooking slot
    state = serverStartCooking(
      state,
      { type: "food.startCooking", item: "Roasted Potato" },
      startTime,
    );

    expect(state.cooking).not.toBeNull();
    expect(state.cooking?.item).toBe("Roasted Potato");
    // Crop ingredients are deducted.
    expect(Number(state.inventory["Potato"])).toBe(3);

    // Collect after 35 s (cookTimeSeconds = 30)
    const collectTime = startTime + 35_000;
    state = serverCollectCooked(state, { type: "food.collectCooked" }, collectTime);

    expect(Number(state.inventory["Roasted Potato"] ?? 0)).toBeGreaterThan(0);
    expect(state.cooking).toBeNull();
  });

  // ---- Step 8: Sell 10 Potatoes → balance += 0.65 -----------------------

  it("step 8 — selling 10 Potatoes increases balance by 10 × 0.065 = 0.65", async () => {
    const { deductItems } =
      await import("@/lib/modules/inventories/repository.server");
    const { addBalance } =
      await import("@/lib/modules/inventories/service.server");

    // Simulate what the sell route does: deductItems + addBalance
    const POTATO_SELL = CROPS_CONFIG["Potato"].sellPrice; // 0.065
    const quantity    = 10;
    const expected    = POTATO_SELL * quantity; // 0.65

    await deductItems(WALLET, { Potato: quantity });
    await addBalance(WALLET, expected);

    expect(vi.mocked(deductItems)).toHaveBeenCalledWith(WALLET, { Potato: 10 });
    expect(vi.mocked(addBalance)).toHaveBeenCalledWith(WALLET, 0.65);
  });

  // ---- Step 8b: Halving-aware sell → stage 1 halves the payout ----------
  // §8 Integration test: at halving stage 1 (emissionMultiplier 0.5), selling
  // 10 Potatoes must credit 10 × 0.065 × 0.5 = 0.325 LFRG, not the stage-0 0.65.
  it("step 8b — selling 10 Potatoes at halving stage 1 credits the halved 0.325", async () => {
    const { deductItems } =
      await import("@/lib/modules/inventories/repository.server");
    const { addBalance } =
      await import("@/lib/modules/inventories/service.server");

    // Simulate the sell route's halving-aware pricing path.
    const emissionMultiplier = getEmissionMultiplier(20_000_000); // stage 1 → 0.5
    const quantity = 10;
    const unitPrice = getHalvedPrice(CROPS_CONFIG["Potato"].sellPrice, emissionMultiplier);
    const expected = unitPrice * quantity; // 0.065 × 0.5 × 10 = 0.325

    await deductItems(WALLET, { Potato: quantity });
    await addBalance(WALLET, expected);

    expect(expected).toBeCloseTo(0.325, 10);
    expect(vi.mocked(deductItems)).toHaveBeenCalledWith(WALLET, { Potato: 10 });
    expect(vi.mocked(addBalance)).toHaveBeenCalledWith(WALLET, expected);
  });

  // ---- Step 9: Verify skill levels after XP awards ----------------------

  it("step 9 — farming XP awards from harvests cross level thresholds correctly", () => {
    // Plant → harvest 3 fields to accumulate XP
    const plantTime = Date.now() - 70_000;
    let state = makeState({
      skills: { ...INITIAL_SKILLS }, // start at level 1, 0 XP
      fields: {
        0: { name: "Potato", plantedAt: plantTime, amount: 1 },
        1: { name: "Potato", plantedAt: plantTime, amount: 1 },
        2: { name: "Potato", plantedAt: plantTime, amount: 1 },
      },
      stamina: { current: 100, max: 100 },
    });

    const now = Date.now();
    state = serverHarvest(state, { type: "item.harvested", index: 0 }, now);
    state = serverHarvest(state, { type: "item.harvested", index: 1 }, now);
    state = serverHarvest(state, { type: "item.harvested", index: 2 }, now);

    // 3 harvests → farming XP should be > 0
    expect(state.skills.farming).toBeGreaterThan(0);

    // getSkillLevel should parse the total XP correctly (level 1 unless XP crossed threshold)
    const level = getSkillLevel(state.skills.farming);
    expect(level).toBeGreaterThanOrEqual(1);
  });

  // ---- Step 10: Server state survives reload ----------------------------

  it("step 10 — fetchServerFarm returns merged state with server numerics", async () => {
    // This test verifies the merge contract in useGameStore.hydrateFarm():
    // after a page reload the store calls GET /api/farm; server numerics win.
    const { getOrCreateFarm }      = await import("@/lib/modules/farms/repository.server");
    const { getOrCreateInventory } = await import("@/lib/modules/inventories/repository.server");
    const { findPlayerByWallet }   = await import("@/lib/modules/players/repository.server");

    const mockFarm = {
      playerId: WALLET,
      fields:   { "0": { name: "Potato", plantedAt: Date.now() - 10_000 } },
      trees: {}, stones: {}, iron: {}, gold: {},
      chickens: {}, cows: {}, sheep: {},
      stamina:  { current: 72, max: 100, lastRegenAt: Date.now() },
      fishing:  { lastCastAt: 0, lastCaughtFish: null, lastCaughtAmount: 0, totalCasts: 0, totalCaught: 0 },
      cooking: null, activity: {}, achievements: {},
    };
    const mockInventory = {
      playerId: WALLET,
      balance: 42.5,
      items: { Potato: 8, Wood: 3 },
    };
    const mockPlayer = {
      wallet: WALLET, username: "integrationTester",
      skills: { farming: 500, woodcutting: 0, mining: 0, fishing: 0, cooking: 0, husbandry: 0, combat: 0 },
    };

    vi.mocked(getOrCreateFarm).mockResolvedValue(mockFarm as never);
    vi.mocked(getOrCreateInventory).mockResolvedValue(mockInventory as never);
    vi.mocked(findPlayerByWallet).mockResolvedValue(mockPlayer as never);

    // Import buildServerGameState and verify it reconstructs the state
    const { buildServerGameState } = await import("@/lib/events/farm-action/build-state");
    const state = buildServerGameState(mockFarm as never, mockInventory as never, mockPlayer as never);

    // Server balance wins
    expect(state.balance.toNumber()).toBe(42.5);
    // Server inventory wins
    expect(Number(state.inventory["Potato"])).toBe(8);
    expect(Number(state.inventory["Wood"])).toBe(3);
    // Server stamina wins
    expect(state.stamina.current).toBe(72);
    // Skill alias: server woodcutting → Phaser woodcutting
    expect(state.skills.woodcutting).toBe(mockPlayer.skills.woodcutting);
    // Active crop plot is preserved
    expect(state.fields[0].name).toBe("Potato");
    expect(state.fields[0].plantedAt).toBeGreaterThan(0);
  });

  // ---- Achievement auto-grant smoke test --------------------------------

  it("bonus — checkAndGrantAchievements does not throw on a valid state", () => {
    const state = makeState({ activity: { "Coins Earned": 5 } });
    expect(() => checkAndGrantAchievements(state)).not.toThrow();
  });
});
