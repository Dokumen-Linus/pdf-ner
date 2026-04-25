import { afterEach, beforeEach, describe, expect, it } from "bun:test"

import { setCreateTeamHandler } from "~/tests/bun-test-setup/mocks"

import { createTeam, getCurrentUserTeamsByOrganizationId, getTeamById, updateTeam } from "./teams"
import {
  authenticateAs,
  cleanupFixtures,
  createFixtureTracker,
  seedOrganization,
  seedOrganizationMember,
  seedTeam,
  seedTeamMember,
  seedUser,
} from "./test-fixtures"

const runDbTests = process.env.TEST_DB === "true"

describe("Team createTeam server function", () => {
  it("delegates team creation to Better Auth and returns the created team", async () => {
    const organizationId = crypto.randomUUID()
    const createdAt = new Date("2026-04-18T12:00:00Z")
    let receivedArgs:
      | {
          body?: {
            name: string
            organizationId?: string
          }
        }
      | undefined

    setCreateTeamHandler(async (args) => {
      receivedArgs = args
      return {
        id: crypto.randomUUID(),
        name: args?.body?.name ?? "Missing Name",
        organizationId: args?.body?.organizationId ?? organizationId,
        createdAt,
        updatedAt: createdAt,
      }
    })

    const result = await createTeam({
      data: {
        name: "Operations",
        organizationId,
      },
    })

    expect(receivedArgs?.body).toEqual({
      name: "Operations",
      organizationId,
    })
    expect(result.name).toBe("Operations")
    expect(result.organizationId).toBe(organizationId)
    expect(result.createdAt).toEqual(createdAt)
  })

  it("propagates Better Auth team creation errors", async () => {
    const organizationId = crypto.randomUUID()

    setCreateTeamHandler(async () => {
      throw new Error("Unauthorized")
    })

    await expect(
      createTeam({
        data: {
          name: "Restricted Team",
          organizationId,
        },
      }),
    ).rejects.toThrow("Unauthorized")
  })

  it("validates createTeam input", async () => {
    await expect(
      createTeam({
        data: {
          name: "   ",
          organizationId: crypto.randomUUID(),
        },
      }),
    ).rejects.toThrow()
  })
})

describe.if(runDbTests)("Team db-fns", () => {
  let tracker = createFixtureTracker()

  beforeEach(() => {
    tracker = createFixtureTracker()
  })

  afterEach(async () => {
    await cleanupFixtures(tracker)
  })

  it("returns only teams that the current user belongs to in the organization", async () => {
    const label = `team-current-user-${crypto.randomUUID().slice(0, 8)}`
    const user = await seedUser(tracker, { label: `${label}-user` })
    const teammate = await seedUser(tracker, { label: `${label}-teammate` })
    const { organizationId } = await seedOrganization(tracker, { label })
    const joinedTeam = await seedTeam(tracker, { label: `${label}-joined`, organizationId })
    const otherTeam = await seedTeam(tracker, { label: `${label}-other`, organizationId })

    await seedOrganizationMember(tracker, {
      organizationId,
      authUserId: user.authUserId,
      role: "developer",
    })
    await seedOrganizationMember(tracker, {
      organizationId,
      authUserId: teammate.authUserId,
      role: "owner",
    })
    await seedTeamMember(tracker, {
      teamId: joinedTeam.teamId,
      authUserId: user.authUserId,
    })
    await seedTeamMember(tracker, {
      teamId: otherTeam.teamId,
      authUserId: teammate.authUserId,
    })

    authenticateAs(user)

    const teams = await getCurrentUserTeamsByOrganizationId({
      data: { organizationId },
    })

    expect(teams.map((team) => team.id)).toEqual([joinedTeam.teamId])
    expect(teams[0]?.name).toContain(`${label}-joined`)
  })

  it("getTeamById returns the team for members and null for non-members", async () => {
    const label = `team-by-id-${crypto.randomUUID().slice(0, 8)}`
    const member = await seedUser(tracker, { label: `${label}-member` })
    const outsider = await seedUser(tracker, { label: `${label}-outsider` })
    const { organizationId } = await seedOrganization(tracker, { label })
    const team = await seedTeam(tracker, { label, organizationId })

    await seedOrganizationMember(tracker, {
      organizationId,
      authUserId: member.authUserId,
      role: "developer",
    })
    await seedTeamMember(tracker, {
      teamId: team.teamId,
      authUserId: member.authUserId,
    })

    authenticateAs(member)
    const visibleTeam = await getTeamById({ data: { id: team.teamId } })
    expect(visibleTeam?.id).toBe(team.teamId)
    expect(visibleTeam?.name).toContain(label)

    authenticateAs(outsider)
    const hiddenTeam = await getTeamById({ data: { id: team.teamId } })
    expect(hiddenTeam).toBeNull()
  })

  it("updateTeam lets manage-capable team members update descriptions", async () => {
    const label = `team-update-${crypto.randomUUID().slice(0, 8)}`
    const user = await seedUser(tracker, { label })
    const { organizationId } = await seedOrganization(tracker, { label })
    const team = await seedTeam(tracker, {
      label,
      organizationId,
      description: "Before update",
    })

    await seedOrganizationMember(tracker, {
      organizationId,
      authUserId: user.authUserId,
      role: "developer",
    })
    await seedTeamMember(tracker, {
      teamId: team.teamId,
      authUserId: user.authUserId,
    })

    authenticateAs(user)

    const updateResult = await updateTeam({
      data: {
        id: team.teamId,
        description: "After update",
      },
    })
    expect(updateResult.success).toBe(true)

    const updatedTeam = await getTeamById({ data: { id: team.teamId } })
    expect(updatedTeam?.description).toBe("After update")
  })

  it("updateTeam denies analysts and unknown teams", async () => {
    const label = `team-update-denied-${crypto.randomUUID().slice(0, 8)}`
    const analyst = await seedUser(tracker, { label })
    const { organizationId } = await seedOrganization(tracker, { label })
    const team = await seedTeam(tracker, { label, organizationId })

    await seedOrganizationMember(tracker, {
      organizationId,
      authUserId: analyst.authUserId,
      role: "analyst",
    })
    await seedTeamMember(tracker, {
      teamId: team.teamId,
      authUserId: analyst.authUserId,
    })

    authenticateAs(analyst)

    await expect(
      updateTeam({
        data: { id: team.teamId, description: "Nope" },
      }),
    ).rejects.toThrow("Team not found or you do not have access to manage it")

    await expect(
      updateTeam({
        data: {
          id: "00000000-0000-0000-0000-000000000000",
          description: "Missing team",
        },
      }),
    ).rejects.toThrow("Team not found or you do not have access to manage it")
  })
})
