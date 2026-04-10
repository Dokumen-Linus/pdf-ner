import { expect, mock } from "bun:test"
import { isUuidV4 } from "@/lib/misc/uuid"
import setupDB from "./db-setup"
import setupDOM from "./dom-setup"
import "./bun-test-extensions.d.ts"

// ─── Module Mocks ─────────────────────────────────────────────────────────────
//
// createServerFn in client context (window is defined via JSDOM) routes through
// an HTTP proxy that requires a running TanStack Start server. Tests call these
// functions directly, so we replace createServerFn with a thin wrapper that
// executes the handler synchronously — no HTTP involved.
//
// Rules for the mock:
//   - Zod schemas: call .parse() so validation errors propagate correctly
//   - Function validators: call them directly (identity fns, () => ({}) patterns)
//   - No validator: pass data through unchanged
//   - Errors thrown by handlers propagate to callers as-is

mock.module("@tanstack/react-start", () => ({
  createServerFn: (_opts?: { method?: string }) => {
    let _validator: any = null

    const builder: any = {
      inputValidator(v: any) {
        _validator = v
        return builder
      },
      handler(handlerFn: any) {
        return async (callArgs?: { data?: any }) => {
          let validatedData = callArgs?.data

          if (_validator != null) {
            if (typeof _validator === "function") {
              // Plain function validator: identity pass-through or () => ({})
              validatedData = _validator(callArgs?.data)
            } else if (typeof _validator.parse === "function") {
              // Zod schema — parse() throws ZodError on invalid input
              validatedData = _validator.parse(callArgs?.data)
            }
          }

          return handlerFn({ data: validatedData })
        }
      },
    }
    return builder
  },
}))

// getRequestHeaders is used by auth-gated functions (billing, etc.).
// Returning empty Headers causes auth.api.getSession to return null,
// so requireUserId() throws "Unauthorized" — the expected test behavior.
mock.module("@tanstack/react-start/server", () => ({
  getRequestHeaders: () => new Headers(),
}))

// createBucket makes an HTTP call to the API server, which is not running in tests.
// Return a fake bucket_id so createProject doesn't fail during CRUD tests.
mock.module("@/db-fns/api/storage", () => ({
  createBucket: async (name: string) => ({ bucket_id: crypto.randomUUID(), name }),
}))

// ─── Extend expect ────────────────────────────────────────────────────────────
expect.extend({
  toBeUuid(received: unknown): { message: () => string; pass: boolean } {
    const pass = typeof received === "string" && isUuidV4(received)
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

// ─── Setup ────────────────────────────────────────────────────────────────────
const tasks = []
tasks.push(setupDOM())
if (process.env.TEST_DB === "true") tasks.push(setupDB())

await Promise.all(tasks)
