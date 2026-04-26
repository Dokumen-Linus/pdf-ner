import { describe, expect, it } from "bun:test"

import { getBillingOverview } from "./billing"

const runTests = process.env.TEST_DB === "true"

// These server functions now derive userId from the authenticated session
// via getRequestHeaders(). Direct calls outside a request context will throw
// "Unauthorized". Integration tests require a real authenticated request context.
describe.if(runTests)("Billing Server Functions", () => {
  describe("getBillingOverview", () => {
    it("throws when called without an authenticated session", async () => {
      await expect(
        getBillingOverview({ data: { projectId: "00000000-0000-0000-0000-000000000000" } }),
      ).rejects.toThrow("Unauthorized")
    })
  })
})
