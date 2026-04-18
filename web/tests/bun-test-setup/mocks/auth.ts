// Mocks for server-side auth. Replaces @/lib/auth and the runtime entry points
// of the better-auth package, so no test ever touches the real Postgres Pool,
// Resend client, or env-var validation inside auth.ts.
//
// authState.session is the single source of truth. Mocked functions close over
// it, so helpers in ./index can flip authenticated/unauthenticated at any time
// and the next getSession() call reflects the change.

import { mock } from "bun:test"

import { authState } from "./state"

// ─── Installers ───────────────────────────────────────────────────────────────

/**
 * Install the @/lib/auth mock. Call once at preload time before any test file
 * imports from @/lib/auth (transitively via middleware/auth.ts, db-fns/api/_helpers.ts, etc).
 */
export function installAuthMock(): void {
  mock.module("@/lib/auth", () => ({
    auth: {
      api: {
        // Signature mirrors real auth.api.getSession — accepts { headers } but
        // the mock ignores them and reads from shared state instead.
        getSession: async (_opts?: { headers?: Headers | Record<string, string> }) => {
          return authState.session
        },
      },
    },
  }))
}

/**
 * Install stubs for the better-auth package runtime. Since @/lib/auth and
 * @/lib/auth-client are mocked, nothing should actually call these — but if
 * some code path slips through, we want a loud failure, not a silent real call.
 */
export function installBetterAuthPackageMock(): void {
  mock.module("better-auth", () => ({
    betterAuth: () => {
      throw new Error(
        "[test mocks] better-auth's betterAuth() was called. " +
          "Tests should use @/lib/auth (mocked) instead of constructing a real auth instance.",
      )
    },
  }))

  mock.module("better-auth/plugins", () => ({
    // Plugins are passed to betterAuth() as a list. If betterAuth() is properly
    // stubbed, these are never invoked — but stub them as no-ops so module
    // resolution doesn't fail at import time.
    haveIBeenPwned: () => ({ id: "haveIBeenPwned", hooks: {} }),
  }))

  mock.module("better-auth/tanstack-start", () => ({
    tanstackStartCookies: () => ({ id: "tanstackStartCookies", hooks: {} }),
  }))
}
