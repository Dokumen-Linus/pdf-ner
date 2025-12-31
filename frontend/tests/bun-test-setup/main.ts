import setupDB from "./db-setup"
import setupDOM from "./dom-setup"
import { expect } from "bun:test"
import { isUuidV4 } from "@/lib/misc/uuid"
import "./bun-test-extensions.d.ts"

// Extend expect with custom matchers
expect.extend({
  toBeUuid(received: unknown): { message: () => string; pass: boolean } {
    const pass = typeof received === 'string' && isUuidV4(received)
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID v4`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID v4`,
        pass: false,
      }
    }
  },
})

const tasks = []
tasks.push(setupDOM())
if (process.env.TEST_DB === "true") tasks.push(setupDB())

await Promise.all(tasks)
