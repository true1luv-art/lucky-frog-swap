/** A settled transaction row shown in the player's history. */
export interface TxHistoryRow {
  _id: string;
  id: string;
  type:
    | "deposit"
    | "withdrawal"
    | "marketplace_purchase"
    | "marketplace_sale"
    | string;
  amount?: number;
  assetName?: string;
  status?: string;
  createdAt?: number;
  txHash?: string;
}
