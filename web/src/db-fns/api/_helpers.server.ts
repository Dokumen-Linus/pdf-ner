import { getRequestHeaders } from "@tanstack/react-start/server"
import { and, eq, or, sql } from "drizzle-orm/sql"
import { db } from "@/db/client"
import { authMembers, authTeamMembers, authTeams } from "@/db/schemas/auth"
import { workersPdfs } from "@/db/schemas/workers/pdfs"
import { projects } from "@/db/schemas/web/projects"
import { users } from "@/db/schemas/web/users"
import { env } from "@/env.server"
import { auth } from "@/lib/auth"

const MANAGE_PROJECT_ROLES = new Set(["owner", "admin", "developer"])
const LABEL_PROJECT_ROLES = new Set(["owner", "admin", "developer", "analyst"])

type WorkspaceUserContext = {
  userId: string
  authUserId: string
  email: string
}

type ProjectAccessMode = "read" | "label" | "manage"

export type ProjectAccessContext = WorkspaceUserContext & {
  projectId: string
  ownerId: string
  teamId: string | null
  organizationId: string | null
  role: string | null
  isOwner: boolean
  canRead: boolean
  canLabel: boolean
  canManage: boolean
}

async function resolveWorkspaceUserByAuthUserId(authUserId: string): Promise<WorkspaceUserContext> {
  const [user] = await db
    .select({
      userId: users.id,
      authUserId: users.authUserId,
      email: users.email,
    })
    .from(users)
    .where(or(eq(users.authUserId, authUserId), sql`${users.id}::text = ${authUserId}`))
    .limit(1)

  if (!user) {
    throw new Error("User profile not found")
  }

  return {
    userId: user.userId,
    authUserId: user.authUserId ?? authUserId,
    email: user.email,
  }
}

async function resolveWorkspaceUserByWebUserId(userId: string): Promise<WorkspaceUserContext> {
  const [user] = await db
    .select({
      userId: users.id,
      authUserId: users.authUserId,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    throw new Error("Unauthorized")
  }

  return {
    userId: user.userId,
    authUserId: user.authUserId ?? user.userId,
    email: user.email,
  }
}

export async function requireWorkspaceUser(): Promise<WorkspaceUserContext> {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return resolveWorkspaceUserByAuthUserId(session.user.id)
}

export async function requireUserId(): Promise<string> {
  const { userId } = await requireWorkspaceUser()
  return userId
}

async function getProjectAccessContextForUser(
  projectId: string,
  user: WorkspaceUserContext,
): Promise<ProjectAccessContext> {
  const [row] = await db
    .select({
      projectId: projects.id,
      ownerId: projects.ownerId,
      ownerAuthUserId: users.authUserId,
      teamId: projects.teamId,
      organizationId: authTeams.organizationId,
      organizationRole: authMembers.role,
      teamMemberId: authTeamMembers.id,
    })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.ownerId))
    .leftJoin(authTeams, eq(authTeams.id, projects.teamId))
    .leftJoin(
      authMembers,
      and(
        eq(authMembers.organizationId, authTeams.organizationId),
        eq(authMembers.userId, user.authUserId),
      ),
    )
    .leftJoin(
      authTeamMembers,
      and(
        eq(authTeamMembers.teamId, projects.teamId),
        eq(authTeamMembers.userId, user.authUserId),
      ),
    )
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!row) {
    throw new Error("Project not found")
  }

  const isOwner = row.ownerId === user.userId || row.ownerAuthUserId === user.authUserId
  const role = isOwner ? "owner" : row.teamMemberId ? row.organizationRole : null
  const canRead = role != null && LABEL_PROJECT_ROLES.has(role)
  const canLabel = canRead
  const canManage = role != null && MANAGE_PROJECT_ROLES.has(role)

  return {
    ...user,
    projectId: row.projectId,
    ownerId: row.ownerId,
    teamId: row.teamId,
    organizationId: row.organizationId,
    role,
    isOwner,
    canRead,
    canLabel,
    canManage,
  }
}

function assertProjectPermission(mode: ProjectAccessMode, access: ProjectAccessContext) {
  const allowed =
    mode === "manage" ? access.canManage : mode === "label" ? access.canLabel : access.canRead

  if (!allowed) {
    throw new Error("You do not have access to this project")
  }
}

export async function getProjectAccessForCurrentUser(projectId: string) {
  const user = await requireWorkspaceUser()
  return getProjectAccessContextForUser(projectId, user)
}

export async function requireProjectAccess(projectId: string, mode: ProjectAccessMode = "read") {
  const access = await getProjectAccessForCurrentUser(projectId)
  assertProjectPermission(mode, access)
  return access
}

export async function requireProjectOwnership(projectId: string, userId: string) {
  const user = await resolveWorkspaceUserByWebUserId(userId)
  const access = await getProjectAccessContextForUser(projectId, user)
  assertProjectPermission("manage", access)
  return access
}

export async function requirePdfAccess(pdfId: string, mode: ProjectAccessMode = "label") {
  const user = await requireWorkspaceUser()
  return requirePdfAccessForUser(pdfId, user, mode)
}

async function requirePdfAccessForUser(
  pdfId: string,
  user: WorkspaceUserContext,
  mode: ProjectAccessMode,
) {
  const [row] = await db
    .select({ projectId: workersPdfs.projectId })
    .from(workersPdfs)
    .where(eq(workersPdfs.id, pdfId))
    .limit(1)

  if (!row) {
    throw new Error("PDF not found")
  }

  const access = await getProjectAccessContextForUser(row.projectId, user)
  assertProjectPermission(mode, access)
  return access
}

export async function requirePdfOwnership(pdfId: string, userId: string): Promise<string> {
  const user = await resolveWorkspaceUserByWebUserId(userId)
  const access = await requirePdfAccessForUser(pdfId, user, "label")
  return access.projectId
}

export async function apiRequest(path: string, options: RequestInit = {}) {
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
}
