/**
 * lib/modules/equipments/repository.server.ts
 *
 * Data-access layer for the `equipments` collection. §4.1-B
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.1-B
 */

import { EquipmentModel } from "@/lib/modules/equipments/model.server";
import type { IEquipment, EquipmentMarket } from "@/lib/modules/equipments/types.server";
import { connectDatabase } from "@/lib/config/database";
// `FilterQuery` is not exported by the installed mongoose 9 typings; use a
// permissive local alias for the plain filter objects passed to updateOne.
type FilterQuery<_T> = Record<string, unknown>;


// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Returns a single equipment document by its MongoDB _id.
 */
export async function getEquipmentById(id: string): Promise<IEquipment | null> {
  await connectDatabase();
  return EquipmentModel.findById(id).lean<IEquipment>();
}

/**
 * Returns a single equipment document by its sequential item_number.
 */
export async function getEquipmentByItemNumber(itemNumber: number): Promise<IEquipment | null> {
  await connectDatabase();
  return EquipmentModel.findOne({ item_number: itemNumber }).lean<IEquipment>();
}

/**
 * Returns all equipment owned by `owner`.
 */
export async function getEquipmentByOwner(owner: string): Promise<IEquipment[]> {
  await connectDatabase();
  return EquipmentModel.find({ owner }).lean<IEquipment[]>();
}

/**
 * Returns all equipment currently listed on the marketplace.
 */
export async function getListedEquipment(): Promise<IEquipment[]> {
  await connectDatabase();
  return EquipmentModel.find({ "market.listed": true }).lean<IEquipment[]>();
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Updates the market embed on an equipment document. §4.1-B
 * Always pass a full `EquipmentMarket` object — the field is never null.
 * To clear a listing (on sale or cancellation) pass an unlisted defaults
 * object: `{ listed: false, price: 0, seller: null, created: null,
 * expires: null, sold: false }`.
 */
export async function updateEquipmentMarket(
  equipmentId: string,
  owner: string,
  market: EquipmentMarket,
): Promise<void> {
  await connectDatabase();
  await EquipmentModel.updateOne(
    { _id: equipmentId, owner } as FilterQuery<IEquipment>,
    { $set: { market } },
  );
}

/**
 * Transfers equipment ownership to `newOwner` and resets the market embed to
 * its unlisted defaults. The market sub-document is NEVER set to null —
 * it is always present on the document. Used by the Marketplace Transaction
 * Service on settlement. §4.4-B
 */
export async function transferEquipment(
  equipmentId: string,
  newOwner: string,
): Promise<void> {
  await connectDatabase();
  await EquipmentModel.updateOne(
    { _id: equipmentId } as FilterQuery<IEquipment>,
    {
      $set: {
        owner:            newOwner,
        equipped:         false,
        "market.listed":  false,
        "market.price":   0,
        "market.seller":  null,
        "market.created": null,
        "market.expires": null,
        "market.sold":    false,
        "market.hash":    undefined,
        "market.locked":  false,
        "market.lockedAt": undefined,
      },
    },
  );
}
