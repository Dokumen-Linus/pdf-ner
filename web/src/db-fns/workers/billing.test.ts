import { describe, expect, it } from "bun:test"
import { getStripeCustomer, getUsageSummary } from "./billing"

const runTests = process.env.TEST_DB === "true"

// These server functions now derive userId from the authenticated session
// via getRequestHeaders(). Direct calls outside a request context will throw
// "Unauthorized". Integration tests require a real authenticated request context.
describe.if(runTests)("Billing Server Functions", () => {
  describe("getUsageSummary", () => {
    it("throws when called without an authenticated session", async () => {
      await expect(getUsageSummary()).rejects.toThrow("Unauthorized")
    })
  })

  describe("getStripeCustomer", () => {
    it("throws when called without an authenticated session", async () => {
      await expect(getStripeCustomer()).rejects.toThrow("Unauthorized")
    })
  })
})
