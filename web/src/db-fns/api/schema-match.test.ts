import { describe, expect, it } from "bun:test"

import type { Prompt } from "../../db/types"

/**
 * Compile-time shape checks for core.prompts Drizzle types (formerly api.prompts).
 */
describe("API Drizzle Schema Shape Checks", () => {
  it("Prompt should have expected core.prompts fields", () => {
    type Expected = {
      id: string
      projectId: string
      templateId: number
      projectDescription: string | null
      entityTypesOrder: string[] | null
      fullText: string | null
    }
    const _: Expected = {} as Prompt
    expect(true).toBe(true)
  })
})
