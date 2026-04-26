import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db/client"
import { authMembers, authOrganizations, authTeams } from "@/db/schemas/auth"
import { organizations, webTeams } from "@/db/schemas/web"
import { auth } from "@/lib/auth"

async function requireUserId(): Promise<string> {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return session.user.id
}

export const getCurrentUserOrganization = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId()

  const [row] = await db
    .select({
      webOrg: organizations,
      authOrg: authOrganizations,
    })
    .from(organizations)
    .innerJoin(authOrganizations, eq(authOrganizations.id, organizations.id))
    .innerJoin(authMembers, eq(authMembers.organizationId, organizations.id))
    .where(eq(authMembers.userId, userId))
    .limit(1)

  if (!row) return null
  return {
    ...row.webOrg,
    name: row.authOrg.name,
    slug: row.authOrg.slug,
  }
})

export const getCurrentUserTeamsByOrganization = createServerFn({ method: "GET" })
  .inputValidator(z.object({ organizationId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()

    const isMember = await db
      .select({ id: authMembers.id })
      .from(authMembers)
      .where(
        and(eq(authMembers.userId, userId), eq(authMembers.organizationId, data.organizationId)),
      )
      .limit(1)

    if (isMember.length === 0) {
      throw new Error("Forbidden: not a member of this organization")
    }

    return db
      .select({
        webTeam: webTeams,
        authTeam: authTeams,
      })
      .from(webTeams)
      .innerJoin(authTeams, eq(authTeams.id, webTeams.id))
      .where(eq(webTeams.organizationId, data.organizationId))
      .then((rows) =>
        rows.map((row) => ({
          ...row.webTeam,
          name: row.authTeam.name,
        })),
      )
  })
