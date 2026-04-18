import { describe, expect, it } from "bun:test"

import type { FoundWorkersPdf, LlmUsage, StripeCustomer } from "../../db/types"

/**
 * Compile-time shape checks for workers schema Drizzle types.
 *
 * Since workers tables are read-only from web, there are no Zod create/update schemas to match.
 * Instead, these tests verify that the Drizzle InferSelectModel types have the expected
 * fields — catching regressions if the Drizzle schema diverges from the SQL.
 *
 * If these tests fail to compile, the Drizzle workers schema does not match the SQL definition.
 */
describe("Workers Drizzle Schema Shape Checks", () => {
  it("LlmUsage should have expected workers.llm_usage fields", () => {
    type Expected = {
      id: string
      userId: string | null
      projectId: string | null
      provider: string
      model: string
      source: string
      taskName: string | null
      inputTokens: number
      outputTokens: number
      stripeReported: boolean
    }
    const _: Expected = {} as LlmUsage
    expect(true).toBe(true)
  })

  it("StripeCustomer should have expected workers.stripe_customers fields", () => {
    type Expected = {
      id: string
      userId: string
      stripeCustomerId: string
      stripeSubscriptionId: string | null
      stripeSubscriptionItemId: string | null
    }
    const _: Expected = {} as StripeCustomer
    expect(true).toBe(true)
  })

  it("FoundWorkersPdf should have expected workers.pdfs fields", () => {
    type Expected = {
      id: string
      name: string | null
      bucketId: string
      filepath: string
      projectId: string
      fullText: string | null
      extractMethod: string | null
      modelType: string | null
      model: string | null
      promptId: string | null
    }
    const _: Expected = {} as FoundWorkersPdf
    expect(true).toBe(true)
  })
})
