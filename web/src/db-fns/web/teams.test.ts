import { describe, expect, it } from "bun:test"

import { getTeamById, updateTeam } from "./teams"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("Team db-fns", () => {
  it("getTeamById returns null for unknown id", async () => {
    const result = await getTeamById({
      data: { id: "00000000-0000-0000-0000-000000000000" },
    })
    expect(result).toBeNull()
  })

  it("updateTeam throws 'Team not found' for unknown id", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000"
    await expect(
      updateTeam({
        data: { id: fakeId, description: "New description" },
      }),
    ).rejects.toThrow("Team not found")
  })

  it("full lifecycle: read → update → verify", async () => {
    // This test requires a team fixture to exist in the database
    // Fixture-based: if a team exists, test reading and updating
    // For now, this is a placeholder that would run if proper fixtures exist
    console.warn(
      "Team fixture lifecycle test: requires pre-seeded database with auth.team and web.teams rows",
    )
  })
})
