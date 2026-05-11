// Mocks for client-side auth. Replaces @/lib/auth-client and better-auth/react
// so components like <Header /> and routes like /_private (client branch),
// /signin, /signup, /signout can be tested without a real browser auth session.
//
// authState.session drives getSession() and useSession(); authState.signInResult
// / signUpResult / signOutResult drive the respective methods. Configure via
// helpers in ./index.

import { mock } from "bun:test"

import { authState } from "./state"

// ─── Installers ───────────────────────────────────────────────────────────────

/**
 * Install the @/lib/auth-client mock. Call once at preload time before any
 * test file imports @/lib/auth-client (directly or through _private.tsx,
 * header.tsx, signin/signup/signout routes).
 */
export function installAuthClientMock(): void {
  mock.module("@/lib/auth-client", () => ({
    authClient: {
      // Server-fn shape: { data: Session | null, error?: null }
      getSession: async () => ({ data: authState.session, error: null }),

      // React hook shape used by <Header />: { data, isPending, error, refetch }.
      // Not reactive by design — good enough for single-render assertions.
      // For reactive scenarios, tests should flip state and re-render.
      useSession: () => ({
        data: authState.session,
        isPending: false,
        error: null,
        refetch: async () => ({ data: authState.session, error: null }),
      }),

      signIn: {
        email: async (_credentials: { email: string; password: string }) => {
          return authState.signInResult
        },
        social: async (args: {
          provider: string
          callbackURL?: string
          errorCallbackURL?: string
          newUserCallbackURL?: string
          disableRedirect?: boolean
        }) => {
          authState.signInSocialCalls.push(args)
          return authState.signInSocialResult
        },
      },

      signUp: {
        email: async (_credentials: { email: string; password: string; name?: string }) => {
          return authState.signUpResult
        },
      },

      signOut: async () => authState.signOutResult,
    },
  }))
}

/**
 * Install a stub for better-auth/react. @/lib/auth-client is already mocked
 * so createAuthClient() should never actually run — but if something imports
 * createAuthClient() directly, fail loudly.
 */
export function installBetterAuthReactMock(): void {
  mock.module("better-auth/react", () => ({
    createAuthClient: () => {
      throw new Error(
        "[test mocks] better-auth/react's createAuthClient() was called. " +
          "Tests should use @/lib/auth-client (mocked) instead of constructing a real client.",
      )
    },
  }))
}
