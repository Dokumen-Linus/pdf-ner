// Public test helper API for the shared mocks. Tests should import from here.
// A global afterEach() in main.ts calls resetMocks() after each test.

import {
  authState,
  fetchState,
  helpersState,
  type MockAuthCallResult,
  type MockCreateTeamArgs,
  type MockCreateTeamResult,
  type MockFetchResponse,
  type MockRoute,
  type MockSession,
  type MockSocialSignInArgs,
  type MockUser,
  resetAuthState,
  resetFetchState,
  resetHelpersState,
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

/** Configure what authClient.signIn.social() resolves to on the next call. */
export function setSignInSocialResult(result: MockAuthCallResult): void {
  authState.signInSocialResult = result
}

/** Return authClient.signIn.social() calls recorded since the last mock reset. */
export function getSignInSocialCalls(): MockSocialSignInArgs[] {
  return [...authState.signInSocialCalls]
}

/** Configure what authClient.signUp.email() resolves to on the next call. */
export function setSignUpResult(result: MockAuthCallResult): void {
  authState.signUpResult = result
}

/** Configure what authClient.signOut() resolves to on the next call. */
export function setSignOutResult(result: MockAuthCallResult): void {
  authState.signOutResult = result
}

/** Override the function the mocked auth.api.createTeam() calls. */
export function setCreateTeamHandler(
  fn: (args?: MockCreateTeamArgs) => Promise<MockCreateTeamResult>,
): void {
  authState.createTeam = fn
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

// ─── Helpers (db-fns/api/_helpers) ────────────────────────────────────────────

/** Override the function the mocked requireUserId() calls. Throw to simulate errors. */
export function setRequireUserId(fn: () => Promise<string>): void {
  helpersState.requireUserId = fn
}

/** Shortcut: make requireUserId() throw "Unauthorized" (matches production error string). */
export function setRequireUserIdUnauthorized(): void {
  helpersState.requireUserId = async () => {
    throw new Error("Unauthorized")
  }
}

/** Override the function the mocked requireProjectOwnership() calls. */
export function setRequireProjectOwnership(
  fn: (projectId: string, userId: string) => Promise<void>,
): void {
  helpersState.requireProjectOwnership = fn
}

/** Shortcut: make requireProjectOwnership() reject with the production "access" error string. */
export function setRequireProjectOwnershipDenied(): void {
  helpersState.requireProjectOwnership = async () => {
    throw new Error("You do not have access to this project")
  }
}

/** Shortcut: make requireProjectOwnership() reject with the production "not found" string. */
export function setProjectNotFound(): void {
  helpersState.requireProjectOwnership = async () => {
    throw new Error("Project not found")
  }
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

/** Reset the helpers state (requireUserId / requireProjectOwnership) to pass-through defaults. */
export function resetHelpersMocks(): void {
  resetHelpersState()
}

/** Reset auth, fetch, and helpers state. Called automatically by the global afterEach. */
export function resetMocks(): void {
  resetAuthState()
  resetFetchState()
  resetHelpersState()
}

// ─── Re-export types for convenience ──────────────────────────────────────────

export type {
  MockAuthCallResult,
  MockAuthError,
  MockCreateTeamArgs,
  MockCreateTeamResult,
  MockFetchResponse,
  MockSession,
  MockSessionRecord,
  MockUser,
} from "./state"
