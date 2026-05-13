import { describe, expect, it } from "bun:test"

import { isUuidV4 } from "./uuid"

describe("isUuidV4", () => {
  it.each([
    "00000000-0000-4000-8000-000000000000",
    "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "F47AC10B-58CC-4372-A567-0E02B2C3D479",
  ])("accepts UUID v4 values: %s", (value) => {
    expect(isUuidV4(value)).toBe(true)
  })

  it.each([
    "not-a-uuid",
    "f47ac10b58cc4372a5670e02b2c3d479",
    "f47ac10b-58cc-1372-a567-0e02b2c3d479",
    "f47ac10b-58cc-7372-a567-0e02b2c3d479",
    "f47ac10b-58cc-4372-c567-0e02b2c3d479",
    "f47ac10b-58cc-4372-a567-0e02b2c3d47z",
    "",
  ])("rejects non-v4 UUID values: %s", (value) => {
    expect(isUuidV4(value)).toBe(false)
  })
})
