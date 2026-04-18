import { describe, expect, it } from "bun:test"

import type { FoundDbApiPdf, FoundPrompt } from "../../db/types"

/**
 * Compile-time shape checks for api schema Drizzle types.
 *
 * Since api tables are read-only from web, there are no Zod create/update schemas to match.
 * Instead, these tests verify that the Drizzle InferSelectModel types have the expected
 * fields — catching regressions if the Drizzle schema diverges from the SQL.
 *
 * If these tests fail to compile, the Drizzle api schema does not match the SQL definition.
 */
describe("API Drizzle Schema Shape Checks", () => {
  it("FoundDbApiPdf should match api.pdfs SQL shape (id, bookmarks, originalHasText)", () => {
    type Expected = { id: string; bookmarks: string[] | null; originalHasText: boolean | null }
    const _: Expected = {} as FoundDbApiPdf
    expect(true).toBe(true)
  })

  it("FoundPrompt should have expected api.prompts fields", () => {
    type Expected = {
      id: string
      projectId: string
      templateId: number | null
      fullText: string | null
    }
    const _: Expected = {} as FoundPrompt
    expect(true).toBe(true)
  })
})
