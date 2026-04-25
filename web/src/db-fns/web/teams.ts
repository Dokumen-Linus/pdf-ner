import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { and, eq, or } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db/client"
import { authMembers, authTeamMembers, authTeams } from "@/db/schemas/auth"
import { webTeams } from "@/db/schemas/web"
import { auth } from "@/lib/auth"
import { requireWorkspaceUser } from "@/lib/authorization.server"

const MANAGE_TEAM_ROLE_FILTER = or(
  eq(authMembers.role, "owner"),
  eq(authMembers.role, "admin"),
  eq(authMembers.role, "developer"),
)

export const CreateTeamSchema = z.object({
  name: z.string().trim().min(1, "Team name is required."),
  organizationId: z.string().uuid(),
})

export const createTeam = createServerFn({ method: "POST" })
  .inputValidator(CreateTeamSchema)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders()
    const team = await auth.api.createTeam({
      headers,
      body: {
        name: data.name,
        organizationId: data.organizationId,
      },
    })

    return {
      id: team.id,
      name: team.name,
      organizationId: team.organizationId,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    }
  })

export const getCurrentUserTeamsByOrganizationId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const workspaceUser = await requireWorkspaceUser()

    const rows = await db
      .select({
        webTeam: webTeams,
        authTeam: authTeams,
      })
      .from(webTeams)
      .innerJoin(authTeams, eq(authTeams.id, webTeams.id))
      .innerJoin(
        authTeamMembers,
        and(
          eq(authTeamMembers.teamId, webTeams.id),
          eq(authTeamMembers.userId, workspaceUser.authUserId),
        ),
      )
      .where(eq(webTeams.organizationId, data.organizationId))

    return rows.map((row) => ({
      ...row.webTeam,
      name: row.authTeam.name,
    }))
  })

export const getTeamById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const workspaceUser = await requireWorkspaceUser()

    const [row] = await db
      .select({
        webTeam: webTeams,
        authTeam: authTeams,
      })
      .from(webTeams)
      .innerJoin(authTeams, eq(authTeams.id, webTeams.id))
      .innerJoin(
        authTeamMembers,
        and(
          eq(authTeamMembers.teamId, webTeams.id),
          eq(authTeamMembers.userId, workspaceUser.authUserId),
        ),
      )
      .where(eq(webTeams.id, data.id))
      .limit(1)

    if (!row) return null
    return {
      ...row.webTeam,
      name: row.authTeam.name,
    }
  })

export const updateTeam = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), description: z.string().nullable().optional() }))
  .handler(async ({ data }) => {
    const workspaceUser = await requireWorkspaceUser()

    const [manageableTeam] = await db
      .select({ id: webTeams.id })
      .from(webTeams)
      .innerJoin(authTeams, eq(authTeams.id, webTeams.id))
      .innerJoin(
        authTeamMembers,
        and(
          eq(authTeamMembers.teamId, webTeams.id),
          eq(authTeamMembers.userId, workspaceUser.authUserId),
        ),
      )
      .innerJoin(
        authMembers,
        and(
          eq(authMembers.organizationId, authTeams.organizationId),
          eq(authMembers.userId, workspaceUser.authUserId),
          MANAGE_TEAM_ROLE_FILTER,
        ),
      )
      .where(eq(webTeams.id, data.id))
      .limit(1)

    if (!manageableTeam) {
      throw new Error("Team not found or you do not have access to manage it")
    }

    const result = await db
      .update(webTeams)
      .set({ description: data.description })
      .where(eq(webTeams.id, data.id))

    if (result.rowCount === 0) {
      throw new Error("Team not found")
    }

    return { success: true }
  })
