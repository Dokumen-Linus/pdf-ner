import { eq } from "drizzle-orm"

import { db } from "@/db/client"
import { authTeams } from "@/db/schemas/auth"
import { webTeams } from "@/db/schemas/web"

export async function getTeamById({ data }: { data: { id: string } }) {
  const [row] = await db
    .select({
      webTeam: webTeams,
      authTeam: authTeams,
    })
    .from(webTeams)
    .innerJoin(authTeams, eq(authTeams.id, webTeams.id))
    .where(eq(webTeams.id, data.id))
    .limit(1)

  if (!row) return null
  return {
    ...row.webTeam,
    name: row.authTeam.name,
  }
}

export async function updateTeam({ data }: { data: { id: string; description?: string | null } }) {
  const result = await db
    .update(webTeams)
    .set({ description: data.description })
    .where(eq(webTeams.id, data.id))

  if (result.rowCount === 0) {
    throw new Error("Team not found")
  }

  return { success: true }
}
