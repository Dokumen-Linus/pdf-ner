import { afterEach, expect, mock } from "bun:test"
import { isUuidV4 } from "@/lib/misc/uuid"
import setupDB from "./db-setup"
import setupDOM from "./dom-setup"
import { resetMocks } from "./mocks"
import { installAuthMock, installBetterAuthPackageMock } from "./mocks/auth"
import { installAuthClientMock, installBetterAuthReactMock } from "./mocks/auth-client"
import { installFetchMock } from "./mocks/fetch"
import { installHelpersMock } from "./mocks/helpers"
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

// getRequestHeaders is used by auth-gated functions (billing, etc.). The
// returned Headers object is ignored by the mocked @/lib/auth (below) — it
// reads session state from tests/bun-test-setup/mocks/state.ts instead. We
// still stub this so the real server-only module is never loaded.
mock.module("@tanstack/react-start/server", () => ({
  getRequestHeaders: () => new Headers(),
}))

// createBucket makes an HTTP call to the API server, which is not running in tests.
// Return a fake bucket_id so createProject doesn't fail during CRUD tests.
mock.module("@/api-fns/storage", () => ({
  createBucket: async (name: string) => ({ bucket_id: crypto.randomUUID(), name }),
}))

// ─── Shared auth + fetch mocks ────────────────────────────────────────────────
//
// @/lib/auth and @/lib/auth-client are replaced with stubs that read from a
// shared mutable state object. Tests flip that state with helpers from
// "@/tests/bun-test-setup/mocks" (setAuthenticated, setUnauthenticated,
// setApiSuccess, setApiUnauthorized, etc.).
//
// Default state: unauthenticated + empty fetch registry. Unmatched fetch
// calls throw, so silent real-network hits are impossible. A global
// afterEach() below calls resetMocks() so each test starts clean.
installAuthMock()
installAuthClientMock()
installBetterAuthPackageMock()
installBetterAuthReactMock()
installFetchMock()
installHelpersMock()

afterEach(() => {
  resetMocks()
})

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
