import type { TradableAssetType } from "@/shared/types/marketplace";

export type ListingStatus = "active" | "sold" | "cancelled" | "expired";

/** Read-optimized listing reconstructed from an embedded market record or history. */
export interface ListingView {
  _id: string;
  hash: string;
  assetType: TradableAssetType;
  assetId: string;
  assetName: string;
  sellerId: string;
  sellerName: string;
  price: number;
  quantity: number;
  category: string;
  status: ListingStatus;
  createdAt: string | Date;
  expiresAt: string | Date;
  soldAt?: string | Date;
}

export interface ListingEarnings {
  sellerNet: number;
  fee: number;
  totalPrice: number;
}
