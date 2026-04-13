// Mocks for @/db-fns/api/_helpers. Tests in src/routes/api/ invoke handlers
// that call requireUserId / requireProjectOwnership / apiRequest. Real
// implementations talk to better-auth, Drizzle, and the FastAPI backend —
// none of which are wired up in unit tests.
//
// helpersState.requireUserId and helpersState.requireProjectOwnership are
// the two test-controllable seams. apiRequest is NOT a seam: it still goes
// through the global fetch mock so tests can use setApiSuccess / setApiError
// just like any other API call.

import { mock } from "bun:test"
import { env } from "@/env.server"
import { helpersState } from "./state"

let installed = false

export function installHelpersMock(): void {
  if (installed) return
  installed = true

  mock.module("@/db-fns/api/_helpers", () => ({
    requireUserId: () => helpersState.requireUserId(),
    requireProjectOwnership: (projectId: string, userId: string) =>
      helpersState.requireProjectOwnership(projectId, userId),
    // Real-ish apiRequest: uses global fetch (which is mocked). Keeps the
    // error-shape behavior so tests can assert on thrown messages the same
    // way production code does.
    apiRequest: async (path: string, options: RequestInit = {}) => {
      const response = await fetch(`${env.API_URL}${path}`, {
        ...options,
        headers: {
          "X-API-Key": env.API_KEY,
          ...options.headers,
        },
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({ detail: response.statusText }))
        throw new Error(body.detail ?? `API request failed: ${response.status}`)
      }
      return response.json()
    },
  }))
}
