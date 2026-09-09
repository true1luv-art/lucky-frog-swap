/**
 * POST /api/admin/migrate-inventory
 *
 * One-time data migration: converts legacy single-document-per-player inventory
 * documents (`{ playerId, items: {...}, marketReservations: {...}, balance }`)
 * into the new one-document-per-item shape (`{ owner, item, amount, market }`).
 * GDD §9.24
 *
 * For each legacy document:
 *   1. Split `items` + `marketReservations` into per-item documents:
 *      - `amount`  = items[name]                 (usable quantity, unchanged)
 *      - `market`  = marketReservations[name]    (reserved state, or null)
 *   2. Fold the legacy `balance` into the player's persisted game balance
 *      (`players.lfrg`). Applied exactly once per legacy document.
 *   3. Delete the legacy document.
 *
 * Idempotent: legacy documents are identified by having a `playerId` field and
 * NO `item` field. New per-item documents (which have `item` and `owner`) are
 * never re-processed, so re-running the migration is safe.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` (same convention as the
 * cron endpoints) when CRON_SECRET is configured.
 */

import mongoose from "mongoose";
import { connectDatabase } from "@/lib/config/database";
import { InventoryModel } from "@/lib/modules/inventories/model.server";
import type { InventoryItemMarket } from "@/lib/modules/inventories/types.server";
import { PlayerModel } from "@/lib/modules/players/model.server";

export const runtime = "nodejs";

interface LegacyInventoryDoc {
  _id: mongoose.Types.ObjectId;
  playerId: string;
  items?: Record<string, number>;
  marketReservations?: Record<string, InventoryItemMarket | null | undefined>;
  balance?: number;
}

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await connectDatabase();
  const collection = mongoose.connection.collection("inventories");

  // Legacy docs: have `playerId`, no per-item `item` field.
  const legacyDocs = (await collection
    .find({ playerId: { $exists: true }, item: { $exists: false } })
    .toArray()) as unknown as LegacyInventoryDoc[];

  const result = {
    processed: 0,
    itemsCreated: 0,
    balancesFolded: 0,
    skipped: 0,
    errors: [] as Array<{ playerId: string; error: string }>,
  };

  for (const legacy of legacyDocs) {
    const playerId = legacy.playerId;
    try {
      const items = legacy.items ?? {};
      const reservations = legacy.marketReservations ?? {};

      // Every item name that appears in either map becomes its own document.
      const itemNames = new Set<string>([
        ...Object.keys(items),
        ...Object.keys(reservations),
      ]);

      const ops = Array.from(itemNames).map((item) => {
        const reservation = reservations[item];
        const market: InventoryItemMarket | null =
          reservation && reservation.listed
            ? { ...reservation, sold: reservation.sold ?? false }
            : null;
        return {
          updateOne: {
            filter: { owner: playerId, item },
            update: {
              $set: { market },
              $setOnInsert: { owner: playerId, item, amount: items[item] ?? 0 },
            },
            upsert: true,
          },
        };
      });

      if (ops.length > 0) {
        await InventoryModel.bulkWrite(ops);
        result.itemsCreated += ops.length;
      }

      // Fold legacy balance into the player's persisted LFRG game balance.
      const balance = legacy.balance ?? 0;
      if (balance > 0) {
        const player = await PlayerModel.findOne(
          { wallet: playerId },
          { lfrg: 1 },
        ).lean<{ lfrg: number }>();
        if (player) {
          await PlayerModel.updateOne(
            { wallet: playerId },
            { $set: { lfrg: Math.max(0, (player.lfrg ?? 0) + balance) } },
          );
          result.balancesFolded += 1;
        }
      }

      // Remove the legacy document now that it has been split.
      await collection.deleteOne({ _id: legacy._id });
      result.processed += 1;
    } catch (err) {
      result.errors.push({
        playerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(
    `[migrate-inventory] Processed ${result.processed} legacy docs, ` +
      `created ${result.itemsCreated} item docs, ` +
      `folded ${result.balancesFolded} balances.`,
  );

  return Response.json({ ok: true, ...result });
}
