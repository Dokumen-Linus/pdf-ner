import { describe, expect, it } from "bun:test"

import type { FoundModel, FoundStandardEntityType, FoundTemplate } from "../../db/types"

/**
 * Compile-time shape checks for public schema Drizzle types.
 *
 * Since public tables are read-only from web, there are no Zod create/update schemas to match.
 * Instead, these tests verify that the Drizzle InferSelectModel types have the expected
 * fields — catching regressions if the Drizzle schema diverges from the SQL.
 *
 * If these tests fail to compile, the Drizzle public schema does not match the SQL definition.
 */
describe("Public Drizzle Schema Shape Checks", () => {
  it("FoundStandardEntityType should have expected public.std_entity_types fields", () => {
    type Expected = {
      id: number
      shortName: string
      longName: string | null
      definition: string | null
      examples: string[] | null
      datatype: string | null
      singleWord: boolean | null
    }
    const _: Expected = {} as FoundStandardEntityType
    expect(true).toBe(true)
  })

  it("FoundTemplate should have expected public.templates fields", () => {
    type Expected = {
      id: number
      txt: string
      inserts: string[]
      documentAtEnd: boolean
    }
    const _: Expected = {} as FoundTemplate
    expect(true).toBe(true)
  })

  it("FoundModel should have expected public.models fields", () => {
    type Expected = {
      id: string
      provider: string
      usdPer1mInput: string
      usdPer1mOutput: string
      releaseDate: Date
      availableDate: Date | null
      endAvailableDate: Date | null
    }
    const _: Expected = {} as FoundModel
    expect(true).toBe(true)
  })
})
