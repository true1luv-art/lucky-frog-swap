import { describe, expect, it } from "vitest";
import { ProcessedTransactionModel } from "./model.server";

describe("ProcessedTransactionModel", () => {
  it.each(["transaction", "stash"] as const)(
    "accepts the %s purpose",
    async (type) => {
      const record = new ProcessedTransactionModel({
        txHash: `${type}-signature`,
        wallet: "wallet",
        type,
        processedAt: Date.now(),
      });

      await expect(record.validate()).resolves.toBeUndefined();
    },
  );

  it.each(["market", "egg"])("rejects legacy purpose %s", async (type) => {
    const record = new ProcessedTransactionModel({
      txHash: `${type}-signature`,
      wallet: "wallet",
      type,
      processedAt: Date.now(),
    });

    await expect(record.validate()).rejects.toMatchObject({
      errors: { type: expect.anything() },
    });
  });
});
