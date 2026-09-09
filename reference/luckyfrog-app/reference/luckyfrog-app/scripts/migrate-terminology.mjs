/**
 * migrate-terminology.mjs
 *
 * One-time migration for the Shard/Frogment swap and Chest→Egg rename.
 *
 * Run ONCE against production before deploying the new code:
 *
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/migrate-terminology.mjs
 *
 * What it does (all operations are idempotent):
 *
 *   1. inventory collection — rename *_frogment keys → *_shard
 *      (common_frogment, uncommon_frogment, rare_frogment, epic_frogment, legendary_frogment)
 *   2. inventory collection — rename "shard" → "frogment"
 *      (the universal leveling currency gets its correct name)
 *   3. chests collection — rename to eggs (MongoDB: renameCollection)
 *      If the "eggs" collection already exists this step is skipped.
 *   4. inventory collection — rename to items (MongoDB: renameCollection)
 *      If the "items" collection already exists this step is skipped.
 *
 * Safe to run multiple times — all steps are no-ops if data is already migrated.
 */

import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("MONGODB_URI environment variable is not set.");
  process.exit(1);
}

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];

async function run() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log("Connected to MongoDB.");

  const db = client.db();

  // ── Step 1: *_frogment → *_shard in inventory collection ────────────────
  console.log("\n[1/4] Renaming *_frogment → *_shard in inventory...");
  for (const rarity of RARITIES) {
    const oldType = `${rarity}_frogment`;
    const newType = `${rarity}_shard`;
    const result = await db.collection("inventory").updateMany(
      { type: oldType },
      { $set: { type: newType } },
    );
    if (result.modifiedCount > 0) {
      console.log(`  ${oldType} → ${newType}: ${result.modifiedCount} docs updated`);
    } else {
      console.log(`  ${oldType}: nothing to migrate`);
    }
  }

  // ── Step 2: "shard" → "frogment" in inventory collection ────────────────
  console.log("\n[2/4] Renaming 'shard' → 'frogment' in inventory...");
  const shardResult = await db.collection("inventory").updateMany(
    { type: "shard" },
    { $set: { type: "frogment" } },
  );
  if (shardResult.modifiedCount > 0) {
    console.log(`  shard → frogment: ${shardResult.modifiedCount} docs updated`);
  } else {
    console.log("  'shard': nothing to migrate");
  }

  // ── Step 3: rename chests collection → eggs ──────────────────────────────
  console.log("\n[3/4] Renaming collection 'chests' → 'eggs'...");
  const eggCollections = await db.listCollections({ name: "eggs" }).toArray();
  if (eggCollections.length > 0) {
    console.log("  'eggs' collection already exists — skipping rename.");
  } else {
    try {
      await db.collection("chests").rename("eggs");
      console.log("  chests → eggs: collection renamed successfully.");
    } catch (err) {
      if (err.codeName === "NamespaceNotFound") {
        console.log("  'chests' collection does not exist — nothing to rename.");
      } else {
        throw err;
      }
    }
  }

  // ── Step 4: rename inventory collection → items ──────────────────────────
  console.log("\n[4/4] Renaming collection 'inventory' → 'items'...");
  const itemCollections = await db.listCollections({ name: "items" }).toArray();
  if (itemCollections.length > 0) {
    console.log("  'items' collection already exists — skipping rename.");
  } else {
    try {
      await db.collection("inventory").rename("items");
      console.log("  inventory → items: collection renamed successfully.");
    } catch (err) {
      if (err.codeName === "NamespaceNotFound") {
        console.log("  'inventory' collection does not exist — nothing to rename.");
      } else {
        throw err;
      }
    }
  }

  await client.close();
  console.log("\nMigration complete.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
