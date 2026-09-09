/**
 * lib/modules/marketplace-logs/repository.server.ts
 *
 * Thin write helper for the immutable `marketplace_logs` collection. Completes
 * the module contract (model + repository) so callers can migrate off the raw
 * model import over time.
 */

import type { Document } from "mongoose";
import { MarketplaceLogModel } from "./model.server";
import type { IMarketplaceLog } from "./types.server";
import { connectDatabase } from "@/lib/config/database";

export type CreateLogInput = Omit<IMarketplaceLog, keyof Document | "id">;

export async function createMarketplaceLog(data: CreateLogInput): Promise<void> {
  await connectDatabase();
  await new MarketplaceLogModel(data).save();
}
