// Public test helper API for the shared mocks. Tests should import from here,
// not from the individual mock files.
//
// Typical usage:
//
//   import {
//     setAuthenticated, setUnauthenticated,
//     setApiSuccess, setApiUnauthorized,
//     resetMocks,
//   } from "@/tests/bun-test-setup/mocks"
//
//   it("guards a protected page", async () => {
//     setUnauthenticated()
//     // ... assert redirect
//   })
//
//   it("loads usage data", async () => {
//     setAuthenticated({ email: "u@example.com" })
//     setApiSuccess("/api/v1/usage/summary", { totalCostUsd: 1.23 })
//     // ... assert rendered value
//   })
//
// A global afterEach() in main.ts calls resetMocks() for you, so each test
// starts from a clean slate.

import {
  authState,
  fetchState,
  type MockAuthCallResult,
  type MockFetchResponse,
  type MockRoute,
  type MockSession,
  type MockUser,
  resetAuthState,
  resetFetchState,
} from "./state"

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const DEFAULT_USER: MockUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test-user@example.com",
  name: "Test User",
  emailVerified: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  image: null,
}

/**
 * Put the shared auth state into an "authenticated" state. Returns the full
 * session object so tests can assert against it if needed.
 *
 * Pass a partial MockUser to override specific fields; anything you omit
 * falls back to DEFAULT_USER.
 */
export function setAuthenticated(userOverrides: Partial<MockUser> = {}): MockSession {
  const user: MockUser = { ...DEFAULT_USER, ...userOverrides }
  const session: MockSession = {
    user,
    session: {
      id: `sess-${user.id}`,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // +1 day
      token: `token-${user.id}`,
      ipAddress: null,
      userAgent: null,
    },
  }
  authState.session = session
  return session
}

/** Put the shared auth state into an "unauthenticated" state. */
export function setUnauthenticated(): void {
  authState.session = null
}

/** Configure what authClient.signIn.email() resolves to on the next call. */
export function setSignInResult(result: MockAuthCallResult): void {
  authState.signInResult = result
}

/** Configure what authClient.signUp.email() resolves to on the next call. */
export function setSignUpResult(result: MockAuthCallResult): void {
  authState.signUpResult = result
}

/** Configure what authClient.signOut() resolves to on the next call. */
export function setSignOutResult(result: MockAuthCallResult): void {
  authState.signOutResult = result
}

// ─── Fetch / API helpers ──────────────────────────────────────────────────────

/**
 * Parse a test-facing route key like "POST /api/v1/foo" into { method, pathname }.
 * A key without a method prefix ("/api/v1/foo") matches any HTTP verb.
 */
function parseRouteKey(key: string): { method: string; pathname: string } {
  const trimmed = key.trim()
  const firstSpace = trimmed.indexOf(" ")
  if (firstSpace > 0) {
    const method = trimmed.slice(0, firstSpace).toUpperCase()
    const pathname = trimmed.slice(firstSpace + 1).trim()
    // Only treat it as a METHOD prefix if it looks like one.
    if (/^[A-Z]+$/.test(method)) {
      return { method, pathname }
    }
  }
  return { method: "*", pathname: trimmed }
}

/**
 * Register a mock response for a specific API call.
 *
 * @param key  Either a bare path ("/api/v1/foo" — matches any method) or
 *             a method-prefixed path ("POST /api/v1/foo").
 * @param response  { status?, json?, text?, headers? }. status defaults to 200.
 */
export function setApiResponse(key: string, response: MockFetchResponse): void {
  const { method, pathname } = parseRouteKey(key)
  const route: MockRoute = { method, pathname, response }
  fetchState.routes.push(route)
}

/** Shortcut: register a 200 OK JSON response for the given path. */
export function setApiSuccess(key: string, json: unknown): void {
  setApiResponse(key, { status: 200, json })
}

/** Shortcut: register a 401 Unauthorized response for the given path. */
export function setApiUnauthorized(key: string, detail: string = "Unauthorized"): void {
  setApiResponse(key, { status: 401, json: { detail } })
}

/** Shortcut: register an arbitrary error response (4xx/5xx) for the given path. */
export function setApiError(key: string, status: number, detail: string = "Request failed"): void {
  setApiResponse(key, { status, json: { detail } })
}

/** Override the behavior when no registered route matches a fetch call. */
export function setFetchFallback(fallback: "throw" | MockFetchResponse): void {
  fetchState.fallback = fallback
}

// ─── Reset helpers ────────────────────────────────────────────────────────────

/** Reset only the auth state back to "unauthenticated" + default call results. */
export function resetAuthMocks(): void {
  resetAuthState()
}

/** Clear all registered fetch routes and reset fallback to "throw". */
export function resetFetchMocks(): void {
  resetFetchState()
}

/** Reset both auth and fetch state. Called automatically by the global afterEach. */
export function resetMocks(): void {
  resetAuthState()
  resetFetchState()
}

// ─── Re-export types for convenience ──────────────────────────────────────────

export type {
  MockAuthCallResult,
  MockAuthError,
  MockFetchResponse,
  MockSession,
  MockSessionRecord,
  MockUser,
} from "./state"
