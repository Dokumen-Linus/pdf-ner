import { describe, expect, it } from "bun:test"

import type { ChatModel, ExtractMethod, StdEntityType, Template } from "../../db/types"

/**
 * Compile-time shape checks for public schema Drizzle types.
 */
describe("Public Drizzle Schema Shape Checks", () => {
  it("StdEntityType should have expected public.std_entity_types fields", () => {
    type Expected = {
      id: number
      shortName: string
      longName: string
      category: string
      definition: string
      examples: string[] | null
      datatype: string | null
      exactLength: number | null
      singleWord: boolean
    }
    const _: Expected = {} as StdEntityType
    expect(true).toBe(true)
  })

  it("Template should have expected public.templates fields", () => {
    type Expected = {
      id: number
      txt: string
      includesProjectDescription: boolean
      includesEntityTypeDefinitions: boolean
      includesEntityTypeExampleValues: boolean
      includesEntityTypeExampleFinds: boolean
      includesEntityTypeRegex: boolean
    }
    const _: Expected = {} as Template
    expect(true).toBe(true)
  })

  it("ChatModel should have expected public.chat_models fields", () => {
    type Expected = {
      id: string
      displayName: string
      host: string
      usdPer1mInput: string
      usdPer1mOutput: string
      releaseDate: Date | null
      availableDate: Date | null
      endAvailableDate: Date | null
    }
    const _: Expected = {} as ChatModel
    expect(true).toBe(true)
  })

  it("ExtractMethod should have expected public.extract_methods fields", () => {
    type Expected = {
      id: string
      displayName: string
      methodType: string
      usdPer1mPages: string | null
      usdPerSec: string | null
    }
    const _: Expected = {} as ExtractMethod
    expect(true).toBe(true)
  })
})
