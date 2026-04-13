// Shared mutable state for all test mocks. The mock.module factories close
// over these objects, so tests can change the "current" auth session or
// registered fetch response at any point — every subsequent call to a mocked
// function reads whatever is in here now.
//
// Exports nothing interesting to test authors directly; they should import
// from ./index (the public helper API).

// ─── Types ────────────────────────────────────────────────────────────────────

export type MockUser = {
  id: string
  email: string
  name: string
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
  image: string | null
}

export type MockSessionRecord = {
  id: string
  userId: string
  expiresAt: Date
  token: string
  ipAddress: string | null
  userAgent: string | null
}

export type MockSession = {
  user: MockUser
  session: MockSessionRecord
}

export type MockAuthError = { message: string; code?: string }

export type MockAuthCallResult<T = { success: boolean }> = {
  data: T | null
  error: MockAuthError | null
}

export type MockFetchResponse = {
  status?: number
  json?: unknown
  text?: string
  headers?: Record<string, string>
}

export type MockRoute = {
  /** HTTP method to match. "*" matches any method. */
  method: string
  /** Pathname to match (compared against URL.pathname of each fetch call). */
  pathname: string
  response: MockFetchResponse
}

// ─── Auth state ───────────────────────────────────────────────────────────────

export type AuthMockState = {
  session: MockSession | null
  signInResult: MockAuthCallResult
  signUpResult: MockAuthCallResult
  signOutResult: MockAuthCallResult
}

function defaultAuthState(): AuthMockState {
  return {
    session: null,
    signInResult: { data: { success: true }, error: null },
    signUpResult: { data: { success: true }, error: null },
    signOutResult: { data: { success: true }, error: null },
  }
}

export const authState: AuthMockState = defaultAuthState()

export function resetAuthState(): void {
  Object.assign(authState, defaultAuthState())
}

// ─── Fetch state ──────────────────────────────────────────────────────────────

export type FetchMockState = {
  routes: MockRoute[]
  /** What to do when no route matches a fetch call. */
  fallback: "throw" | MockFetchResponse
}

function defaultFetchState(): FetchMockState {
  return { routes: [], fallback: "throw" }
}

export const fetchState: FetchMockState = defaultFetchState()

export function resetFetchState(): void {
  fetchState.routes.length = 0
  fetchState.fallback = "throw"
}

// ─── Helpers state (db-fns/api/_helpers) ──────────────────────────────────────

const DEFAULT_MOCK_USER_ID = "00000000-0000-0000-0000-000000000001"

export type HelpersMockState = {
  /** Called by the mocked requireUserId(). Throw to simulate unauthorized. */
  requireUserId: () => Promise<string>
  /** Called by the mocked requireProjectOwnership(). Throw to simulate denial. */
  requireProjectOwnership: (projectId: string, userId: string) => Promise<void>
}

function defaultHelpersState(): HelpersMockState {
  return {
    requireUserId: async () => DEFAULT_MOCK_USER_ID,
    requireProjectOwnership: async () => {},
  }
}

export const helpersState: HelpersMockState = defaultHelpersState()

export function resetHelpersState(): void {
  Object.assign(helpersState, defaultHelpersState())
}
