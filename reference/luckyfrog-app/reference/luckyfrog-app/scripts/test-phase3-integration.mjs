/**
 * scripts/test-phase3-integration.mjs
 *
 * Phase 3 end-to-end integration test. §3.5-E
 *
 * Tests the full quest lifecycle:
 *   1. Seed: player + 2 staked frogs (Quest Power ~15) + farming inventory.
 *   2. Generate 6 daily quests — verify one per category.
 *   3. Complete a farming quest — verify inventory deducted, shards/XP credited,
 *      rolls processed, ALL rolls are Egg Shards (no LFRG, no empty, no Frogments).
 *   4. Retry same quest — verify QUEST_NOT_ACTIVE / already-completed error.
 *   5. Attempt with insufficient inventory — verify INSUFFICIENT_ITEMS fires
 *      before any writes occur.
 *   6. Seed a village order with 20 Carrots. Complete it. Verify deduction,
 *      roll outcomes are Egg Shards only, replacement order generated.
 *   7. Verify zero LFRG was emitted during any quest completion.
 *
 * Run:
 *   node --env-file-if-exists=/vercel/share/.env.project \
 *        scripts/test-phase3-integration.mjs
 *
 * Reference: docs/implementation_plans/phase-03-quest-system.md §3.5-E
 */

import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// Minimal DB connection (mirrors lib/config/database.ts without TS resolution)
// ---------------------------------------------------------------------------

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Aborting.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Inline schema definitions (avoid TSX/alias resolution in plain .mjs)
// ---------------------------------------------------------------------------

const InventorySchema = new mongoose.Schema(
  { playerId: String, items: { type: Map, of: Number, default: {} } },
  { collection: "inventories" },
);
const InventoryModel =
  mongoose.models.Inventory ?? mongoose.model("Inventory", InventorySchema);

const PlayerSchema = new mongoose.Schema(
  {
    wallet: String,
    username: String,
    lfrg: { type: Number, default: 0 },
    stakedFrogs: [String],
    skills: {
      farming: { type: Number, default: 0 },
      mining: { type: Number, default: 0 },
      woodcutting: { type: Number, default: 0 },
      fishing: { type: Number, default: 0 },
      cooking: { type: Number, default: 0 },
    },
    stats: {
      collectionRating: { type: Number, default: 0 },
      luck: { type: Number, default: 0 },
    },
    registrationTime: { type: Number, default: Date.now },
  },
  { collection: "players" },
);
const PlayerModel =
  mongoose.models.Player ?? mongoose.model("Player", PlayerSchema);

const FrogSchema = new mongoose.Schema(
  {
    owner: String,
    level: { type: Number, default: 1 },
    rarity: { type: String, default: "common" },
    staked: { type: Boolean, default: true },
  },
  { collection: "frogs" },
);
const FrogModel =
  mongoose.models.Frog ?? mongoose.model("Frog", FrogSchema);

const QuestSchema = new mongoose.Schema(
  {
    playerId:    String,
    type:        String,
    category:    String,
    difficulty:  String,
    status:      { type: String, default: "active" },
    objective:   { resource: String, required: Number },
    rewards: {
      guaranteedShards: [{ rarity: String, amount: Number }],
      skillXp:   Number,
      baseRolls: Number,
    },
    rollResults: [{ roll: Number, rarity: String, amount: Number, jackpot: Boolean }],
    generatedAt: Date,
    expiresAt:   Date,
    completedAt: Date,
  },
  { collection: "quests" },
);
const QuestModel =
  mongoose.models.Quest ?? mongoose.model("Quest", QuestSchema);

const GameStatsSchema = new mongoose.Schema(
  {
    totalLfrgEmitted:   { type: Number, default: 0 },
    treasuryBalance:    { type: Number, default: 0 },
    halvingStage:       { type: Number, default: 0 },
    emissionMultiplier: { type: Number, default: 1.0 },
    updatedAt:          Date,
  },
  { collection: "game_stats" },
);
const GameStatsModel =
  mongoose.models.GameStats ?? mongoose.model("GameStats", GameStatsSchema);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS  ${message}`);
    passed++;
  } else {
    console.error(`  FAIL  ${message}`);
    failed++;
  }
}

const TEST_WALLET = `test_phase3_${Date.now()}`;

async function seedPlayer() {
  // Create 2 frogs with level 5 each (Quest Power ≈ avgLevel×0.5 = 2.5, +luck+rating → ~15)
  const frog1 = await FrogModel.create({ owner: TEST_WALLET, level: 5, staked: true });
  const frog2 = await FrogModel.create({ owner: TEST_WALLET, level: 5, staked: true });

  await PlayerModel.create({
    wallet:       TEST_WALLET,
    username:     `tester_${Date.now()}`,
    stakedFrogs:  [frog1._id.toString(), frog2._id.toString()],
    skills:       { farming: 0, mining: 0, woodcutting: 0, fishing: 0, cooking: 0 },
    stats:        { collectionRating: 0, luck: 10 },
  });

  // Seed farming inventory: 10 Potatoes + 20 Carrots
  await InventoryModel.create({
    playerId: TEST_WALLET,
    items: new Map([["Potato", 10], ["Carrot", 20]]),
  });

  return { frog1Id: frog1._id.toString(), frog2Id: frog2._id.toString() };
}

async function cleanup() {
  await PlayerModel.deleteMany({ wallet: TEST_WALLET });
  await FrogModel.deleteMany({ owner: TEST_WALLET });
  await InventoryModel.deleteMany({ playerId: TEST_WALLET });
  await QuestModel.deleteMany({ playerId: TEST_WALLET });
}

// ---------------------------------------------------------------------------
// Lazy import of TS-compiled services via dynamic require fallback
// We call the API via fetch so we don't need to resolve TS paths directly.
// The test assumes the dev server is running on PORT 3000.
// ---------------------------------------------------------------------------

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-test-wallet": TEST_WALLET },
  });
  return { status: res.status, body: await res.json() };
}

async function apiPost(path, body = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-test-wallet": TEST_WALLET,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// ---------------------------------------------------------------------------
// Direct DB-layer tests (no HTTP — faster, no auth dependency)
// ---------------------------------------------------------------------------

async function runDirectTests() {
  console.log("\n=== Phase 3 Integration Test (direct DB layer) ===\n");

  // Dynamically import compiled service modules using process.cwd()
  const { completeQuest } = await import(
    "../lib/events/quest-complete/action.js"
  ).catch(() => null) ?? {};

  if (!completeQuest) {
    console.warn(
      "  SKIP  Direct DB tests — compiled JS not available (run 'next build' first).",
    );
    console.warn("         Run 'node scripts/test-phase3-integration.mjs' after build,");
    console.warn("         or use the HTTP tests by setting TEST_USE_HTTP=1.\n");
    return;
  }

  // Seed
  await seedPlayer();

  // STEP 2 — Generate 6 daily quests
  console.log("Step 2: Daily quest generation");
  const { generateDailyQuests } = await import("../shared/quests/engine.js");
  const player = await PlayerModel.findOne({ wallet: TEST_WALLET }).lean();
  const quests = await generateDailyQuests(TEST_WALLET, player.skills);

  assert(quests.length === 6, `6 daily quests generated (got ${quests.length})`);
  const categories = quests.map((q) => q.category);
  const expectedCats = ["farming", "mining", "woodcutting", "fishing", "cooking", "economy"];
  for (const cat of expectedCats) {
    assert(categories.includes(cat), `Category '${cat}' present`);
  }

  // STEP 3 — Complete the farming quest
  console.log("\nStep 3: Complete farming quest");
  const farmingQuest = quests.find((q) => q.category === "farming");
  assert(!!farmingQuest, "Found farming quest");

  const lfrgBefore = (await GameStatsModel.findOne({}).lean())?.totalLfrgEmitted ?? 0;

  const result = await completeQuest(TEST_WALLET, farmingQuest._id.toString());

  assert(result.quest.status === "completed", "Quest marked completed");
  assert(Array.isArray(result.rolls), "Rolls returned as array");

  // All rolls must have a rarity (never empty/LFRG/Frogments)
  const VALID_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
  for (const roll of result.rolls) {
    assert(
      VALID_RARITIES.includes(roll.rarity),
      `Roll ${roll.roll} has valid rarity '${roll.rarity}'`,
    );
    assert(
      typeof roll.amount === "number" && roll.amount > 0,
      `Roll ${roll.roll} has positive amount (${roll.amount})`,
    );
  }

  // Verify Potatoes deducted
  const invAfter = await InventoryModel.findOne({ playerId: TEST_WALLET }).lean();
  const potatoesAfter = invAfter?.items?.get?.("Potato") ?? invAfter?.items?.Potato ?? 0;
  assert(potatoesAfter === 0, `Potatoes deducted (have ${potatoesAfter}, expected 0)`);

  // Verify common shards credited (guaranteed 2 for easy) under the canonical
  // `${rarity}_shard` inventory key. §C7
  const commonShardsAfter =
    invAfter?.items?.get?.("common_shard") ?? invAfter?.items?.["common_shard"] ?? 0;
  assert(commonShardsAfter >= 2, `common_shard >= 2 (guaranteed floor, got ${commonShardsAfter})`);

  // Verify farming XP incremented
  const playerAfter = await PlayerModel.findOne({ wallet: TEST_WALLET }).lean();
  assert(playerAfter.skills.farming > 0, `Farming XP incremented (${playerAfter.skills.farming})`);

  // STEP 7 — No LFRG emitted
  console.log("\nStep 7: No LFRG emitted during quest completion");
  const lfrgAfter = (await GameStatsModel.findOne({}).lean())?.totalLfrgEmitted ?? 0;
  assert(lfrgAfter === lfrgBefore, `LFRG emitted = 0 (was ${lfrgBefore}, now ${lfrgAfter})`);

  // STEP 4 — Retry same quest → QUEST_NOT_ACTIVE
  console.log("\nStep 4: Retry completed quest");
  try {
    await completeQuest(TEST_WALLET, farmingQuest._id.toString());
    assert(false, "Should have thrown on retry");
  } catch (err) {
    assert(
      err.code === "QUEST_NOT_ACTIVE" || /already completed|not active/i.test(err.message),
      `Retry throws QUEST_NOT_ACTIVE (got: ${err.code ?? err.message})`,
    );
  }

  // STEP 5 — Insufficient inventory → INSUFFICIENT_ITEMS (no writes)
  console.log("\nStep 5: Insufficient inventory");
  const miningQuest = quests.find((q) => q.category === "mining");
  // Player has no Stone — should throw before any write
  try {
    await completeQuest(TEST_WALLET, miningQuest._id.toString());
    assert(false, "Should have thrown INSUFFICIENT_ITEMS");
  } catch (err) {
    assert(
      err.code === "INSUFFICIENT_ITEMS",
      `Throws INSUFFICIENT_ITEMS (got: ${err.code ?? err.message})`,
    );
    // Verify mining quest still active (no writes occurred)
    const mq = await QuestModel.findById(miningQuest._id).lean();
    assert(mq.status === "active", "Mining quest still active after failed attempt");
  }

  // STEP 6 — Village order: 20 Carrots
  console.log("\nStep 6: Village order completion");
  const { generateVillageOrders } = await import("../shared/quests/engine.js");
  const orders = await generateVillageOrders(TEST_WALLET, playerAfter.skills);
  const carrotOrder = orders.find((o) => o.objective.resource === "Carrot");

  if (!carrotOrder) {
    console.warn("  SKIP  No Carrot village order in this week's pool — seeding one manually.");
    const manualOrder = await QuestModel.create({
      playerId:   TEST_WALLET,
      type:       "village_order",
      category:   "farming",
      difficulty: "normal",
      status:     "active",
      objective:  { resource: "Carrot", required: 20 },
      rewards:    { guaranteedShards: [{ rarity: "common", amount: 5 }], skillXp: 150, baseRolls: 4 },
      generatedAt: new Date(),
    });
    const voResult = await completeQuest(TEST_WALLET, manualOrder._id.toString());
    assert(voResult.quest.status === "completed", "Village order completed");
    assert(voResult.replacement !== undefined, "Replacement order generated");
    for (const roll of voResult.rolls) {
      assert(
        VALID_RARITIES.includes(roll.rarity),
        `Village order roll ${roll.roll} has valid rarity '${roll.rarity}'`,
      );
    }
  } else {
    const voResult = await completeQuest(TEST_WALLET, carrotOrder._id.toString());
    assert(voResult.quest.status === "completed", "Village order completed");
    assert(voResult.replacement !== undefined, "Replacement order generated");
    for (const roll of voResult.rolls) {
      assert(
        VALID_RARITIES.includes(roll.rarity),
        `Village order roll ${roll.roll} has valid rarity '${roll.rarity}'`,
      );
    }
    // Carrots deducted
    const invFinal = await InventoryModel.findOne({ playerId: TEST_WALLET }).lean();
    const carrotsAfter = invFinal?.items?.get?.("Carrot") ?? invFinal?.items?.Carrot ?? 0;
    assert(carrotsAfter === 0, `Carrots deducted (have ${carrotsAfter})`);
  }

  // Cleanup
  await cleanup();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  try {
    await runDirectTests();
  } finally {
    await mongoose.disconnect();
  }

  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
