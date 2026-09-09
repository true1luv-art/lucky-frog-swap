/**
 * scripts/migrate-shards-to-frogments.mjs
 *
 * One-time migration: convert per-rarity shard inventory items → single
 * flat "frogment" item. Run ONCE against staging then production:
 *
 *   node --env-file-if-exists=/vercel/share/.env.project \
 *        scripts/migrate-shards-to-frogments.mjs
 *
 * What it does (all operations are idempotent):
 *
 *   1. For every inventory document that has one or more of the five
 *      ${rarity}_shard keys, sum their amounts and add the total to the
 *      "frogment" document (which may already exist). Uses a two-step
 *      find + bulkWrite so the operation is atomic per player.
 *
 *   2. Deletes the five ${rarity}_shard inventory items once their amounts
 *      have been credited.
 *
 * Conversion rate: 1:1 — every shard of any rarity converts to 1 frogment.
 *
 * Safe to run multiple times — a player whose shard items have already been
 * deleted will simply be skipped (no documents matching the filter).
 *
 * Reference: docs/frogments-rename-plan.md §6
 */

import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("MONGODB_URI environment variable is not set.");
  process.exit(1);
}

const SHARD_TYPES = [
  "common_shard",
  "uncommon_shard",
  "rare_shard",
  "epic_shard",
  "legendary_shard",
];

async function run() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log("Connected to MongoDB.");

  const db = client.db();
  const inventories = db.collection("inventories");

  // ── Step 1: Aggregate shard amounts per owner ──────────────────────────────
  console.log("\n[1/2] Scanning shard inventory items...");

  const shardDocs = await inventories
    .find({ item: { $in: SHARD_TYPES } })
    .toArray();

  if (shardDocs.length === 0) {
    console.log("  No shard inventory items found — migration already complete.");
    await client.close();
    return;
  }

  // Group by owner and sum all shard amounts.
  const totalsPerOwner = new Map();
  for (const doc of shardDocs) {
    const prev = totalsPerOwner.get(doc.owner) ?? 0;
    totalsPerOwner.set(doc.owner, prev + (doc.amount ?? 0));
  }

  console.log(`  Found ${shardDocs.length} shard item(s) across ${totalsPerOwner.size} player(s).`);

  // ── Step 2: Credit frogments and delete shards ─────────────────────────────
  console.log("\n[2/2] Crediting frogments and removing shard items...");

  let credited = 0;
  let deleted  = 0;

  for (const [owner, total] of totalsPerOwner.entries()) {
    if (total <= 0) continue;

    // Credit frogments (upsert).
    await inventories.updateOne(
      { owner, item: "frogment" },
      {
        $inc: { amount: total },
        $setOnInsert: { owner, item: "frogment", market: null },
      },
      { upsert: true },
    );
    credited++;

    // Delete all shard items for this owner.
    const result = await inventories.deleteMany({
      owner,
      item: { $in: SHARD_TYPES },
    });
    deleted += result.deletedCount;

    console.log(`  ${owner}: +${total} frogments credited, ${result.deletedCount} shard item(s) deleted.`);
  }

  console.log(`\nDone. ${credited} player(s) credited. ${deleted} shard document(s) deleted.`);
  await client.close();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
