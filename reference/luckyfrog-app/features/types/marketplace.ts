export type TradableAssetType =
  | "resource"
  | "seed"
  | "food"
  | "fish"
  | "crafting_material";

export type ListingStatus = "active" | "sold" | "cancelled";

/** Read-optimised listing view returned by the browse and detail API routes. */
export interface ListingView {
  _id:          string;
  assetType:    TradableAssetType;
  assetName:    string;
  sellerId:     string;
  sellerName:   string;
  price:        number;
  quantity:     number;
  status:       ListingStatus;
  createdAt:    string | Date;
  soldAt?:      string | Date;
  completedAt?: string | Date;
  /** Optimistic lock — present when another player is actively buying this listing. */
  lockedBy?:    string | null;
  lockedUntil?: string | Date | null;
}

export interface ListingEarnings {
  sellerNet:  number;
  fee:        number;
  totalPrice: number;
}
