// Mocks for @/db-fns/api/authorization.server. Tests in src/routes/api/
// invoke handlers that call requireUserId / requireProjectOwnership. Real
// implementations talk to better-auth and Drizzle — neither is wired up
// in unit tests.
//
// helpersState.requireUserId and helpersState.requireProjectOwnership are
// the two test-controllable seams. Other exports get "not mocked" stubs —
// any test that exercises a code path using them will see a loud failure
// rather than silently hit the real DB.
//
// FastAPI-facing calls (apiRequest, proxyToApi) are NOT mocked here — they
// go through the global fetch mock so tests can use setApiSuccess /
// setApiError uniformly.

import { mock } from "bun:test"

import { helpersState } from "./state"

function notMocked(name: string): () => never {
  return () => {
    throw new Error(
      `[test mocks] ${name}() was called but isn't stubbed. Add a seam in ` +
        `tests/bun-test-setup/mocks/helpers.ts if your test needs to control it.`,
    )
  }
}

let installed = false

export function installHelpersMock(): void {
  if (installed) return
  installed = true

  mock.module("@/db-fns/api/authorization.server", () => ({
    requireUserId: () => helpersState.requireUserId(),
    requireProjectOwnership: (projectId: string, userId: string) =>
      helpersState.requireProjectOwnership(projectId, userId),
    requireWorkspaceUser: notMocked("requireWorkspaceUser"),
    requireProjectAccess: notMocked("requireProjectAccess"),
    requirePdfAccess: notMocked("requirePdfAccess"),
    requirePdfOwnership: notMocked("requirePdfOwnership"),
    getProjectAccessForCurrentUser: notMocked("getProjectAccessForCurrentUser"),
  }))

  mock.module("@/lib/project-authorization.server", () => ({
    requireUserId: () => helpersState.requireUserId(),
    requireProjectOwnership: (projectId: string, userId: string) =>
      helpersState.requireProjectOwnership(projectId, userId),
    requireProjectAccess: async (projectId: string) => {
      const userId = await helpersState.requireUserId()
      await helpersState.requireProjectOwnership(projectId, userId)
      return {
        userId,
        authUserId: userId,
        email: "test-user@example.com",
        accountRole: "individual",
        billingStatus: "active",
        hasPaymentMethod: true,
        projectId,
        ownerId: userId,
        teamId: null,
        organizationId: null,
        role: "admin",
        isOwner: true,
        canRead: true,
        canLabel: true,
        canManage: true,
      }
    },
    requireWorkspaceUser: notMocked("requireWorkspaceUser"),
    requirePdfAccess: notMocked("requirePdfAccess"),
    requirePdfOwnership: notMocked("requirePdfOwnership"),
    getProjectAccessForCurrentUser: notMocked("getProjectAccessForCurrentUser"),
  }))

  mock.module("@/lib/authorization.server", () => ({
    requireUserId: () => helpersState.requireUserId(),
    requireProjectOwnership: (projectId: string, userId: string) =>
      helpersState.requireProjectOwnership(projectId, userId),
    requireProjectAccess: notMocked("requireProjectAccess"),
    requireWorkspaceUser: notMocked("requireWorkspaceUser"),
    requirePdfAccess: notMocked("requirePdfAccess"),
    requirePdfOwnership: notMocked("requirePdfOwnership"),
    getProjectAccessForCurrentUser: notMocked("getProjectAccessForCurrentUser"),
  }))

  mock.module("@/lib/role-authorization.server", () => ({
    canUsePermission: () => true,
    requirePermission: (access: unknown) => access,
    requireProjectPermission: async (projectId: string) => {
      const userId = await helpersState.requireUserId()
      await helpersState.requireProjectOwnership(projectId, userId)
      return {
        userId,
        projectId,
        accountRole: "individual",
        canManage: true,
        canLabel: true,
      }
    },
  }))
}
