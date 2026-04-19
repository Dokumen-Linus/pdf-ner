import { describe, expect, it } from "bun:test"

import { getOrganizationByUserId, getTeamsByOrganizationId } from "./organizations"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("Organization db-fns", () => {
  const testAuthUserId = "00000000-0000-0000-0000-000000000001"

  it("getOrganizationByUserId returns null for unknown user", async () => {
    const result = await getOrganizationByUserId({
      data: { userId: "00000000-0000-0000-0000-000000000000" },
    })
    expect(result).toBeNull()
  })

  it("getOrganizationByUserId returns organization with name and slug if user has one", async () => {
    const result = await getOrganizationByUserId({
      data: { userId: testAuthUserId },
    })
    if (!result) {
      console.warn(
        "Skipping fixture-based test: no organization fixture for test user. Run tests with a properly seeded database.",
      )
      return
    }
    expect(result.id).toBeString()
    expect(result.name).toBeString()
    expect(result.slug).toBeString()
    expect(result.plan).toBe("base")
  })

  it("getTeamsByOrganizationId returns empty array for organization with no teams", async () => {
    // Use a non-existent org id
    const result = await getTeamsByOrganizationId({
      data: { organizationId: "00000000-0000-0000-0000-000000000000" },
    })
    expect(result).toEqual([])
  })

  it("getTeamsByOrganizationId returns teams with names if organization has teams", async () => {
    const org = await getOrganizationByUserId({
      data: { userId: testAuthUserId },
    })
    if (!org) {
      console.warn("Skipping: no organization fixture for test user")
      return
    }

    const teams = await getTeamsByOrganizationId({
      data: { organizationId: org.id },
    })

    if (teams.length === 0) {
      console.warn("Skipping: test organization has no teams")
      return
    }

    expect(teams[0].id).toBeString()
    expect(teams[0].name).toBeString()
    expect(teams[0].organizationId).toBe(org.id)
  })
})
