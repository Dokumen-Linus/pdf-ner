import { describe, expect, it } from "bun:test"

import type { CorePdf, Prompt } from "../../db/types"

describe("core schema match", () => {
  it("Prompt type exists", () => {
    type Check = Prompt
    const _: Check = {} as Check
    expect(true).toBe(true)
  })

  it("CorePdf type exists", () => {
    type Check = CorePdf
    const _: Check = {} as Check
    expect(true).toBe(true)
  })
})
