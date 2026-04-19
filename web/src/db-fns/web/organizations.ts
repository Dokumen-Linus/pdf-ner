import { eq } from "drizzle-orm"

import { db } from "@/db/client"
import { authMembers, authOrganizations, authTeams } from "@/db/schemas/auth"
import { organizations, webTeams } from "@/db/schemas/web"

export async function getOrganizationByUserId({ data }: { data: { userId: string } }) {
  const [row] = await db
    .select({
      webOrg: organizations,
      authOrg: authOrganizations,
    })
    .from(organizations)
    .innerJoin(authOrganizations, eq(authOrganizations.id, organizations.id))
    .innerJoin(authMembers, eq(authMembers.organizationId, organizations.id))
    .where(eq(authMembers.userId, data.userId))
    .limit(1)

  if (!row) return null
  return {
    ...row.webOrg,
    name: row.authOrg.name,
    slug: row.authOrg.slug,
  }
}

export async function getTeamsByOrganizationId({ data }: { data: { organizationId: string } }) {
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
}
