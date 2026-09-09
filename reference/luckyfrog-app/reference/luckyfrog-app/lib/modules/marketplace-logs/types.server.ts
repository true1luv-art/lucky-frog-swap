import type { Document } from "mongoose";

/** Supported immutable marketplace activity records. */
export type MarketplaceLogType =
  | "market_sale"
  | "listing_cancelled"
  | "listing_expired";

/** Immutable marketplace log record. */
export interface IMarketplaceLog extends Document {
  type: MarketplaceLogType;
  listingId?: string;
  assetType: string;
  assetId: string;
  assetName: string;
  sellerId?: string;
  buyerId?: string;
  quantity: number;
  price: number;
  totalPrice: number;
  fee: number;
  sellerNet: number;
  completedAt: Date;
  /** Buyer payment signature; used as the settlement idempotency key. */
  signature?: string;
  /** On-chain settlement transfer signature when applicable. */
  txHash?: string;
}
