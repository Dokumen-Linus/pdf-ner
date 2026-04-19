import { afterEach, beforeEach, describe, expect, it } from "bun:test"

import {
  createProject,
  deleteProject,
  getAccessibleProjects,
  getCurrentProjectAccess,
  getProjectById,
  getProjectByName,
  getProjectsByOwnerId,
  getProjectsByTeamId,
  updateProject,
} from "./projects"
import {
  authenticateAs,
  cleanupFixtures,
  createFixtureTracker,
  seedOrganization,
  seedOrganizationMember,
  seedProject,
  seedTeam,
  seedTeamMember,
  seedUser,
} from "./test-fixtures"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("Project Table Server Functions", () => {
  let tracker = createFixtureTracker()

  beforeEach(() => {
    tracker = createFixtureTracker()
  })

  afterEach(async () => {
    await cleanupFixtures(tracker)
  })

  it("handles the personal project lifecycle for the authenticated owner", async () => {
    const label = `project-personal-${crypto.randomUUID().slice(0, 8)}`
    const user = await seedUser(tracker, { label })
    authenticateAs(user)

    const created = await createProject({
      data: {
        name: `${label}-created`,
        description: "Personal project",
        colorPresets: ["#ff0000", "#00ff00"],
        orientation: "portrait",
      },
    })
    tracker.projectIds.push(created.id)

    const createdById = await getProjectById({ data: { id: created.id } })
    expect(createdById.id).toBe(created.id)
    expect(createdById.ownerId).toBe(user.webUserId)
    expect(createdById.teamId).toBeNull()
    expect(createdById.bucketId).toBeUuid()
    expect(createdById.orientation).toBe("portrait")

    const createdByName = await getProjectByName({ data: { name: `${label}-created` } })
    expect(createdByName.id).toBe(created.id)

    const projectsByOwner = await getProjectsByOwnerId({
      data: { ownerId: user.webUserId },
    })
    expect(projectsByOwner.some((project) => project.id === created.id)).toBe(true)

    const updateResult = await updateProject({
      data: {
        id: created.id,
        name: `${label}-updated`,
        colorPresets: ["#0000ff"],
      },
    })
    expect(updateResult.success).toBe(true)

    const updatedProject = await getProjectById({ data: { id: created.id } })
    expect(updatedProject.name).toBe(`${label}-updated`)
    expect(updatedProject.colorPresets).toEqual(["#0000ff"])

    const deleteResult = await deleteProject({ data: { id: created.id } })
    expect(deleteResult.success).toBe(true)

    await expect(getProjectById({ data: { id: created.id } })).rejects.toThrow("Project not found")
  })

  it("auto-selects the caller's manageable team when creating an org-scoped project", async () => {
    const label = `project-auto-team-${crypto.randomUUID().slice(0, 8)}`
    const user = await seedUser(tracker, { label })
    const { organizationId } = await seedOrganization(tracker, { label })
    const { teamId } = await seedTeam(tracker, { label, organizationId })
    await seedOrganizationMember(tracker, {
      organizationId,
      authUserId: user.authUserId,
      role: "developer",
    })
    await seedTeamMember(tracker, { teamId, authUserId: user.authUserId })
    authenticateAs(user)

    const created = await createProject({
      data: {
        name: `${label}-created`,
      },
    })
    tracker.projectIds.push(created.id)

    const project = await getProjectById({ data: { id: created.id } })
    expect(project.ownerId).toBe(user.webUserId)
    expect(project.teamId).toBe(teamId)
  })

  it("reuses buckets within the same personal workspace", async () => {
    const label = `project-personal-bucket-${crypto.randomUUID().slice(0, 8)}`
    const user = await seedUser(tracker, { label })
    authenticateAs(user)

    const first = await createProject({ data: { name: `${label}-one` } })
    const second = await createProject({ data: { name: `${label}-two` } })
    tracker.projectIds.push(first.id, second.id)

    const firstProject = await getProjectById({ data: { id: first.id } })
    const secondProject = await getProjectById({ data: { id: second.id } })

    expect(firstProject.teamId).toBeNull()
    expect(secondProject.teamId).toBeNull()
    expect(secondProject.bucketId).toBe(firstProject.bucketId)
  })

  it("reuses buckets within the same team workspace", async () => {
    const label = `project-team-bucket-${crypto.randomUUID().slice(0, 8)}`
    const user = await seedUser(tracker, { label })
    const { organizationId } = await seedOrganization(tracker, { label })
    const { teamId } = await seedTeam(tracker, { label, organizationId })
    await seedOrganizationMember(tracker, {
      organizationId,
      authUserId: user.authUserId,
      role: "owner",
    })
    await seedTeamMember(tracker, { teamId, authUserId: user.authUserId })
    authenticateAs(user)

    const first = await createProject({ data: { name: `${label}-one`, teamId } })
    const second = await createProject({ data: { name: `${label}-two`, teamId } })
    tracker.projectIds.push(first.id, second.id)

    const firstProject = await getProjectById({ data: { id: first.id } })
    const secondProject = await getProjectById({ data: { id: second.id } })

    expect(firstProject.teamId).toBe(teamId)
    expect(secondProject.teamId).toBe(teamId)
    expect(secondProject.bucketId).toBe(firstProject.bucketId)
  })

  it("rejects team-scoped creation when the caller is not allowed to manage that team", async () => {
    const label = `project-inaccessible-team-${crypto.randomUUID().slice(0, 8)}`
    const user = await seedUser(tracker, { label: `${label}-actor` })
    const owner = await seedUser(tracker, { label: `${label}-owner` })
    const { organizationId } = await seedOrganization(tracker, { label })
    const { teamId } = await seedTeam(tracker, { label, organizationId })
    await seedOrganizationMember(tracker, {
      organizationId,
      authUserId: owner.authUserId,
      role: "owner",
    })
    await seedTeamMember(tracker, { teamId, authUserId: owner.authUserId })
    authenticateAs(user)

    await expect(
      createProject({
        data: {
          name: `${label}-created`,
          teamId,
        },
      }),
    ).rejects.toThrow("You do not have access to this team")
  })

  it("denies reading projects for another owner id", async () => {
    const label = `project-owner-deny-${crypto.randomUUID().slice(0, 8)}`
    const actor = await seedUser(tracker, { label: `${label}-actor` })
    const otherUser = await seedUser(tracker, { label: `${label}-other` })
    authenticateAs(actor)

    await expect(
      getProjectsByOwnerId({
        data: { ownerId: otherUser.webUserId },
      }),
    ).rejects.toThrow("You do not have access to this user's projects")
  })

  it("allows analyst team members to list team projects and exposes read-only access flags", async () => {
    const label = `project-analyst-read-${crypto.randomUUID().slice(0, 8)}`
    const owner = await seedUser(tracker, { label: `${label}-owner` })
    const analyst = await seedUser(tracker, { label: `${label}-analyst` })
    const { organizationId } = await seedOrganization(tracker, { label })
    const { teamId } = await seedTeam(tracker, { label, organizationId })
    await seedOrganizationMember(tracker, {
      organizationId,
      authUserId: owner.authUserId,
      role: "owner",
    })
    await seedOrganizationMember(tracker, {
      organizationId,
      authUserId: analyst.authUserId,
      role: "analyst",
    })
    await seedTeamMember(tracker, { teamId, authUserId: owner.authUserId })
    await seedTeamMember(tracker, { teamId, authUserId: analyst.authUserId })
    const seededProject = await seedProject(tracker, {
      ownerId: owner.webUserId,
      teamId,
      name: `${label}-seeded`,
      bucketId: crypto.randomUUID(),
    })

    authenticateAs(analyst)

    const teamProjects = await getProjectsByTeamId({ data: { teamId } })
    expect(teamProjects.some((project) => project.id === seededProject.projectId)).toBe(true)

    const access = await getCurrentProjectAccess({
      data: { projectId: seededProject.projectId },
    })
    expect(access.role).toBe("analyst")
    expect(access.canRead).toBe(true)
    expect(access.canLabel).toBe(true)
    expect(access.canManage).toBe(false)
    expect(access.teamId).toBe(teamId)
    expect(access.organizationId).toBe(organizationId)

    await expect(
      updateProject({
        data: {
          id: seededProject.projectId,
          name: `${label}-updated`,
        },
      }),
    ).rejects.toThrow("You do not have access to this project")

    await expect(deleteProject({ data: { id: seededProject.projectId } })).rejects.toThrow(
      "You do not have access to this project",
    )
  })

  it("lists only accessible personal and team projects", async () => {
    const label = `project-accessible-${crypto.randomUUID().slice(0, 8)}`
    const actor = await seedUser(tracker, { label: `${label}-actor` })
    const teammate = await seedUser(tracker, { label: `${label}-teammate` })
    const outsider = await seedUser(tracker, { label: `${label}-outsider` })
    const { organizationId } = await seedOrganization(tracker, { label })
    const { teamId } = await seedTeam(tracker, { label, organizationId })
    const { teamId: otherTeamId } = await seedTeam(tracker, {
      label: `${label}-other`,
      organizationId,
    })

    await seedOrganizationMember(tracker, {
      organizationId,
      authUserId: actor.authUserId,
      role: "developer",
    })
    await seedOrganizationMember(tracker, {
      organizationId,
      authUserId: teammate.authUserId,
      role: "owner",
    })
    await seedOrganizationMember(tracker, {
      organizationId,
      authUserId: outsider.authUserId,
      role: "owner",
    })

    await seedTeamMember(tracker, { teamId, authUserId: actor.authUserId })
    await seedTeamMember(tracker, { teamId, authUserId: teammate.authUserId })
    await seedTeamMember(tracker, { teamId: otherTeamId, authUserId: outsider.authUserId })

    const personalProject = await seedProject(tracker, {
      ownerId: actor.webUserId,
      name: `${label}-personal`,
      bucketId: crypto.randomUUID(),
    })
    const teamProject = await seedProject(tracker, {
      ownerId: teammate.webUserId,
      teamId,
      name: `${label}-team`,
      bucketId: crypto.randomUUID(),
    })
    await seedProject(tracker, {
      ownerId: outsider.webUserId,
      teamId: otherTeamId,
      name: `${label}-hidden`,
      bucketId: crypto.randomUUID(),
    })

    authenticateAs(actor)

    const accessibleProjects = await getAccessibleProjects()
    const accessibleIds = new Set(accessibleProjects.map((project) => project.id))

    expect(accessibleIds.has(personalProject.projectId)).toBe(true)
    expect(accessibleIds.has(teamProject.projectId)).toBe(true)
    expect(accessibleProjects.some((project) => project.name === `${label}-hidden`)).toBe(false)
  })

  describe("Error handling", () => {
    it("throws for unknown ids and names", async () => {
      const label = `project-errors-${crypto.randomUUID().slice(0, 8)}`
      const user = await seedUser(tracker, { label })
      authenticateAs(user)

      await expect(
        getProjectById({ data: { id: "00000000-0000-0000-0000-000000000000" } }),
      ).rejects.toThrow("Project not found")
      await expect(
        getProjectByName({ data: { name: `${label}-missing` } }),
      ).rejects.toThrow("Project not found")
      await expect(
        updateProject({
          data: {
            id: "00000000-0000-0000-0000-000000000000",
            name: `${label}-updated`,
          },
        }),
      ).rejects.toThrow("Project not found")
      await expect(
        deleteProject({ data: { id: "00000000-0000-0000-0000-000000000000" } }),
      ).rejects.toThrow("Project not found")
      await expect(
        getProjectsByTeamId({ data: { teamId: "00000000-0000-0000-0000-000000000000" } }),
      ).rejects.toThrow("You do not have access to this team's projects")
    })
  })
})
