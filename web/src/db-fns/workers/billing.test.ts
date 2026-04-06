import { describe, expect, it } from "bun:test"
import { getStripeCustomer, getUsageSummary } from "./billing"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("Billing Server Functions", () => {
  const nonExistentUserId = "00000000-0000-0000-0000-000000000000"

  describe("getUsageSummary", () => {
    it("returns zeroed summary for user with no usage", async () => {
      const result = await getUsageSummary({ data: { userId: nonExistentUserId } })
      expect(result.totalInputTokens).toBe(0)
      expect(result.totalOutputTokens).toBe(0)
      expect(result.totalCostUsd).toBe(0)
      expect(result.callCount).toBe(0)
      expect(result.byModel).toEqual([])
      expect(result.byDay).toEqual([])
    })

    it("returns numeric costUsd values (not string/Decimal)", async () => {
      const result = await getUsageSummary({ data: { userId: nonExistentUserId } })
      expect(typeof result.totalCostUsd).toBe("number")
      expect(result.byModel.every((r) => typeof r.costUsd === "number")).toBe(true)
      expect(result.byDay.every((r) => typeof r.costUsd === "number")).toBe(true)
    })
  })

  describe("getStripeCustomer", () => {
    it("returns null for user with no stripe customer", async () => {
      const result = await getStripeCustomer({ data: { userId: nonExistentUserId } })
      expect(result).toBeNull()
    })
  })
})
