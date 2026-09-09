import type { ClientSession } from "mongoose";
import { connectDatabase } from "@/lib/config/database";
import { InventoryModel } from "@/lib/modules/inventories/model.server";
import {
  COLLECTIBLES,
  isCollectibleName,
} from "@/shared/data/collectibles";
import type {
  CollectibleIngredient,
  CollectibleName,
} from "@/shared/types/gameplay/collectibles";
import {
  getCollectibleSupply,
  insertReservedCollectibles,
  reserveCollectibleMintRange,
} from "./repository.server";
import type { CollectibleSupply, ICollectible } from "./types.server";

export type CraftCollectibleAction = {
  type: "collectible.crafted";
  name: CollectibleName;
  quantity: number;
};

export interface CraftCollectibleResult {
  name: CollectibleName;
  quantity: number;
  collectibleNumbers: number[];
  supply: CollectibleSupply;
}

export function assertCraftCollectibleAction(
  value: unknown,
): asserts value is CraftCollectibleAction {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid collectible craft action");
  }

  const action = value as Record<string, unknown>;
  if (action.type !== "collectible.crafted") {
    throw new Error("Invalid collectible craft action");
  }
  if (typeof action.name !== "string" || !isCollectibleName(action.name)) {
    throw new Error("Unknown collectible");
  }
  if (!Number.isSafeInteger(action.quantity) || (action.quantity as number) <= 0) {
    throw new Error("Collectible quantity must be a positive integer");
  }
}

export function getCollectibleRequirements(
  name: CollectibleName,
  quantity: number,
): Record<string, number> {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Collectible quantity must be a positive integer");
  }

  return Object.fromEntries(
    COLLECTIBLES[name].ingredients.map((ingredient: CollectibleIngredient) => {
      const required = ingredient.amount.mul(quantity);
      if (!required.isInteger() || !required.isPositive()) {
        throw new Error(`Invalid recipe quantity for ${ingredient.item}`);
      }
      return [ingredient.item, required.toNumber()];
    }),
  );
}

async function deductRequirements(
  owner: string,
  requirements: Record<string, number>,
  session: ClientSession,
): Promise<void> {
  for (const [item, amount] of Object.entries(requirements)) {
    const result = await InventoryModel.updateOne(
      { owner, item, amount: { $gte: amount } },
      { $inc: { amount: -amount } },
      { session },
    );

    if (result.modifiedCount !== 1) {
      throw new Error(`Insufficient ingredient: ${item}`);
    }
  }
}

function toResult(
  name: CollectibleName,
  quantity: number,
  documents: ICollectible[],
  supply: CollectibleSupply,
): CraftCollectibleResult {
  return {
    name,
    quantity,
    collectibleNumbers: documents.map((document) => document.collectible_number),
    supply,
  };
}

/**
 * Deducts usable inventory, reserves finite supply, and inserts unique assets
 * in one MongoDB transaction. `withTransaction` retries transient transaction
 * conflicts; any thrown validation or write error aborts every mutation.
 */
export async function craftCollectible(
  ownerInput: string,
  actionInput: unknown,
): Promise<CraftCollectibleResult> {
  assertCraftCollectibleAction(actionInput);
  const owner = ownerInput.trim();
  if (!owner) throw new Error("Collectible owner is required");

  const requirements = getCollectibleRequirements(
    actionInput.name,
    actionInput.quantity,
  );
  const mongoose = await connectDatabase();
  const session = await mongoose.startSession();
  let minted: ICollectible[] = [];

  try {
    await session.withTransaction(async () => {
      await deductRequirements(owner, requirements, session);
      const reservation = await reserveCollectibleMintRange(
        actionInput.name,
        actionInput.quantity,
        session,
      );
      minted = await insertReservedCollectibles(
        owner,
        actionInput.name,
        reservation,
        session,
      );

      if (minted.length !== actionInput.quantity) {
        throw new Error("Collectible mint did not complete");
      }
    });
  } finally {
    await session.endSession();
  }

  if (minted.length !== actionInput.quantity) {
    throw new Error("Collectible transaction did not commit");
  }

  const supply = await getCollectibleSupply(actionInput.name);
  return toResult(actionInput.name, actionInput.quantity, minted, supply);
}
