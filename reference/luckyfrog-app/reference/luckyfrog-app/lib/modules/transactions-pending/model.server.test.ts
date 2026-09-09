import { describe, expect, it } from "vitest";
import { InboundTransactionModel } from "./model.server";

function pendingRecord(type: string) {
  return new InboundTransactionModel({
    type,
    signature: `${type}-signature`,
    sender: "wallet",
    tokenAmount: 1,
    rawAmount: "1000000",
    memo: null,
    blockTime: 1,
    status: "pending",
    retryCount: 0,
  });
}

describe("InboundTransactionModel", () => {
  it.each(["transaction", "stash"])("accepts the %s purpose", async (type) => {
    await expect(pendingRecord(type).validate()).resolves.toBeUndefined();
  });

  it.each(["market", "egg"])("rejects unsupported legacy purpose %s", async (type) => {
    await expect(pendingRecord(type).validate()).rejects.toMatchObject({
      errors: { type: expect.anything() },
    });
  });
});
