import { inArray } from "drizzle-orm"

import { setAuthenticated } from "~/tests/bun-test-setup/mocks"
import { db } from "@/db/client"
import {
  authMembers,
  authOrganizations,
  authTeamMembers,
  authTeams,
  authUsers,
} from "@/db/schemas/auth"
import { organizations, projects, users, webTeams } from "@/db/schemas/web"

type FixtureTracker = {
  authUserIds: string[]
  webUserIds: string[]
  authOrganizationIds: string[]
  webOrganizationIds: string[]
  authMemberIds: string[]
  authTeamIds: string[]
  webTeamIds: string[]
  authTeamMemberIds: string[]
  projectIds: string[]
}

type SeedUserOptions = {
  label: string
  authUserId?: string
}

type SeedOrganizationOptions = {
  label: string
  organizationId?: string
}

type SeedTeamOptions = {
  label: string
  organizationId: string
  teamId?: string
  description?: string | null
}

type SeedProjectOptions = {
  ownerUserId: string
  name: string
  ownerTeamId?: string | null
  bucketId?: string | null
  description?: string | null
}

export function createFixtureTracker(): FixtureTracker {
  return {
    authUserIds: [],
    webUserIds: [],
    authOrganizationIds: [],
    webOrganizationIds: [],
    authMemberIds: [],
    authTeamIds: [],
    webTeamIds: [],
    authTeamMemberIds: [],
    projectIds: [],
  }
}

export async function cleanupFixtures(tracker: FixtureTracker) {
  if (tracker.projectIds.length > 0) {
    await db.delete(projects).where(inArray(projects.id, tracker.projectIds))
  }
  if (tracker.authTeamMemberIds.length > 0) {
    await db.delete(authTeamMembers).where(inArray(authTeamMembers.id, tracker.authTeamMemberIds))
  }
  if (tracker.webTeamIds.length > 0) {
    await db.delete(webTeams).where(inArray(webTeams.id, tracker.webTeamIds))
  }
  if (tracker.authTeamIds.length > 0) {
    await db.delete(authTeams).where(inArray(authTeams.id, tracker.authTeamIds))
  }
  if (tracker.authMemberIds.length > 0) {
    await db.delete(authMembers).where(inArray(authMembers.id, tracker.authMemberIds))
  }
  if (tracker.webOrganizationIds.length > 0) {
    await db.delete(organizations).where(inArray(organizations.id, tracker.webOrganizationIds))
  }
  if (tracker.authOrganizationIds.length > 0) {
    await db
      .delete(authOrganizations)
      .where(inArray(authOrganizations.id, tracker.authOrganizationIds))
  }
  if (tracker.webUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, tracker.webUserIds))
  }
  if (tracker.authUserIds.length > 0) {
    await db.delete(authUsers).where(inArray(authUsers.id, tracker.authUserIds))
  }
}

export async function seedUser(tracker: FixtureTracker, options: SeedUserOptions) {
  const authUserId = options.authUserId ?? crypto.randomUUID()
  const webUserId = authUserId
  const now = new Date()
  const email = `${options.label}-${authUserId}@example.com`

  await db.insert(authUsers).values({
    id: authUserId,
    name: `${options.label} Auth User`,
    email,
    image: null,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(users).values({
    id: webUserId,
    email,
    displayName: `${options.label} Web User`,
    createdAt: now,
    updatedAt: now,
  })

  tracker.authUserIds.push(authUserId)
  tracker.webUserIds.push(webUserId)

  return { authUserId, webUserId, email }
}

export async function seedOrganization(tracker: FixtureTracker, options: SeedOrganizationOptions) {
  const organizationId = options.organizationId ?? crypto.randomUUID()
  const now = new Date()

  await db.insert(authOrganizations).values({
    id: organizationId,
    name: `${options.label} Org`,
    slug: `${options.label}-${organizationId.slice(0, 8)}`,
    createdAt: now,
    metadata: JSON.stringify({ plan: "base" }),
  })

  await db.insert(organizations).values({
    id: organizationId,
    createdAt: now,
    updatedAt: now,
  })

  tracker.authOrganizationIds.push(organizationId)
  tracker.webOrganizationIds.push(organizationId)

  return { organizationId }
}

export async function seedOrganizationMember(
  tracker: FixtureTracker,
  options: {
    organizationId: string
    authUserId: string
    role: string
  },
) {
  const memberId = crypto.randomUUID()
  await db.insert(authMembers).values({
    id: memberId,
    organizationId: options.organizationId,
    userId: options.authUserId,
    role: options.role,
    createdAt: new Date(),
  })
  tracker.authMemberIds.push(memberId)
  return { memberId }
}

export async function seedTeam(tracker: FixtureTracker, options: SeedTeamOptions) {
  const teamId = options.teamId ?? crypto.randomUUID()
  const now = new Date()

  await db.insert(authTeams).values({
    id: teamId,
    name: `${options.label} Team`,
    organizationId: options.organizationId,
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(webTeams).values({
    id: teamId,
    organizationId: options.organizationId,
    description: options.description ?? null,
    createdAt: now,
    updatedAt: now,
  })

  tracker.authTeamIds.push(teamId)
  tracker.webTeamIds.push(teamId)

  return { teamId }
}

export async function seedTeamMember(
  tracker: FixtureTracker,
  options: {
    teamId: string
    authUserId: string
  },
) {
  const teamMemberId = crypto.randomUUID()
  await db.insert(authTeamMembers).values({
    id: teamMemberId,
    teamId: options.teamId,
    userId: options.authUserId,
    createdAt: new Date(),
  })
  tracker.authTeamMemberIds.push(teamMemberId)
  return { teamMemberId }
}

export async function seedProject(tracker: FixtureTracker, options: SeedProjectOptions) {
  const projectId = crypto.randomUUID()

  await db.insert(projects).values({
    id: projectId,
    ownerUserId: options.ownerUserId,
    ownerTeamId: options.ownerTeamId ?? null,
    name: options.name,
    description: options.description ?? null,
    bucketId: options.bucketId ?? null,
  })

  tracker.projectIds.push(projectId)

  return { projectId }
}

export function authenticateAs(user: { authUserId: string; email: string }) {
  setAuthenticated({
    id: user.authUserId,
    email: user.email,
    name: user.email.split("@")[0] ?? "Test User",
  })
}
