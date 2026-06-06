import { and, desc, eq, isNotNull, or } from "drizzle-orm/sql"
import { z } from "zod"

import { createBucket } from "@/api-fns/storage"
import { db } from "@/db/client"
import { authMembers, authTeamMembers, authTeams } from "@/db/schemas/auth"
import { projects } from "@/db/schemas/web/projects"
import { users } from "@/db/schemas/web/users"
import { createMonitoredDbFn } from "@/db-fns/web/monitoring"
import {
  getProjectAccessForCurrentUser,
  requireProjectAccess,
  requireWorkspaceUser,
} from "@/lib/project-authorization.server"
import { requirePermission } from "@/lib/role-authorization.server"

const MANAGE_TEAM_ROLE_FILTER = or(
  eq(authMembers.role, "owner"),
  eq(authMembers.role, "admin"),
  eq(authMembers.role, "developer"),
)

// ** CREATE **
export const CreateProjectSchema = z.object({
  name: z.string(),
  ownerUserId: z.string().optional(),
  ownerTeamId: z.string().optional(),
  description: z.string().optional(),
  colorPresets: z.array(z.string()).optional(),
  orientation: z.enum(["any", "portrait", "landscape"]).optional(),
  activeExtractMethod: z.string().optional(),
  activeChatModel: z.string().min(1).optional(),
})

export const createProject = createMonitoredDbFn({ eventName: "web.project.create", method: "POST" })
  .inputValidator(CreateProjectSchema)
  .handler(async ({ data }) => {
    const workspaceUser = await requireWorkspaceUser()

    const membershipFilters = [
      eq(authTeamMembers.userId, workspaceUser.authUserId),
      MANAGE_TEAM_ROLE_FILTER,
    ]
    if (data.ownerTeamId) {
      membershipFilters.push(eq(authTeamMembers.teamId, data.ownerTeamId))
    }

    const [teamMembership] = await db
      .select({ teamId: authTeamMembers.teamId })
      .from(authTeamMembers)
      .innerJoin(authTeams, eq(authTeams.id, authTeamMembers.teamId))
      .innerJoin(
        authMembers,
        and(
          eq(authMembers.organizationId, authTeams.organizationId),
          eq(authMembers.userId, workspaceUser.authUserId),
        ),
      )
      .where(and(...membershipFilters))
      .orderBy(authTeams.createdAt)
      .limit(1)

    if (data.ownerTeamId && !teamMembership) {
      throw new Error("You do not have access to this team")
    }

    const effectiveTeamId = data.ownerTeamId ?? teamMembership?.teamId ?? null

    // Reuse the bucket from an existing project in the same ownership scope.
    const bucketScopeFilter =
      effectiveTeamId != null
        ? eq(projects.ownerTeamId, effectiveTeamId)
        : eq(projects.ownerUserId, workspaceUser.userId)

    const [existingWithBucket] = await db
      .select({ bucketId: projects.bucketId })
      .from(projects)
      .where(and(bucketScopeFilter, isNotNull(projects.bucketId)))
      .limit(1)

    const [project] = await db
      .insert(projects)
      .values({
        name: data.name,
        description: data.description,
        colorPresets: data.colorPresets,
        orientation: data.orientation,
        activeExtractMethod: data.activeExtractMethod,
        activeChatModel: data.activeChatModel,
        // Keep the creator as the stable owner record even for team-linked projects.
        ownerUserId: workspaceUser.userId,
        ownerTeamId: effectiveTeamId ?? null,
      })
      .returning({ id: projects.id })

    let bucketId: string
    if (existingWithBucket?.bucketId) {
      bucketId = existingWithBucket.bucketId
    } else {
      // No existing bucket — create a new one and link it
      try {
        const bucket = await createBucket({ data: { name: `dokumen-${project.id}` } })
        bucketId = bucket.bucket_id
      } catch (error) {
        await db.delete(projects).where(eq(projects.id, project.id))
        throw new Error(
          `Failed to create storage bucket: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    await db.update(projects).set({ bucketId }).where(eq(projects.id, project.id))

    return { id: project.id }
  })

// ** READ **
export const getProjectById = createMonitoredDbFn({ eventName: "web.project.get_by_id", method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await requireProjectAccess(data.id, "read")
    const project = await db.select().from(projects).where(eq(projects.id, data.id))
    if (project.length === 0) {
      throw new Error("Project not found")
    }
    return project[0]
  })

export const getProjectByName = createMonitoredDbFn({ eventName: "web.project.get_by_name", method: "GET" })
  .inputValidator(z.object({ name: z.string() }))
  .handler(async ({ data }) => {
    const project = await db.select().from(projects).where(eq(projects.name, data.name))
    if (project.length === 0) {
      throw new Error("Project not found")
    }
    return project[0]
  })

export const getProjectsByOwnerId = createMonitoredDbFn({ eventName: "web.project.get_projects_by_owner_id", method: "GET" })
  .inputValidator(z.object({ ownerId: z.string() }))
  .handler(async ({ data }) => {
    const workspaceUser = await requireWorkspaceUser()
    if (data.ownerId !== workspaceUser.userId) {
      throw new Error("You do not have access to this user's projects")
    }
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.ownerUserId, data.ownerId))
    return userProjects
  })

export const getAccessibleProjects = createMonitoredDbFn({ eventName: "web.project.get_accessible_projects", method: "GET" })
  .inputValidator(z.void())
  .handler(async () => {
    const workspaceUser = await requireWorkspaceUser()
    return db
      .selectDistinct({
        id: projects.id,
        ownerUserId: projects.ownerUserId,
        ownerTeamId: projects.ownerTeamId,
        name: projects.name,
        description: projects.description,
        bucketId: projects.bucketId,
        colorPresets: projects.colorPresets,
        orientation: projects.orientation,
        activeExtractMethod: projects.activeExtractMethod,
        activeChatModel: projects.activeChatModel,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .leftJoin(users, eq(users.id, projects.ownerUserId))
      .leftJoin(authTeams, eq(authTeams.id, projects.ownerTeamId))
      .leftJoin(
        authMembers,
        and(
          eq(authMembers.organizationId, authTeams.organizationId),
          eq(authMembers.userId, workspaceUser.authUserId),
        ),
      )
      .leftJoin(
        authTeamMembers,
        and(
          eq(authTeamMembers.teamId, projects.ownerTeamId),
          eq(authTeamMembers.userId, workspaceUser.authUserId),
        ),
      )
      .where(
        or(
          eq(users.id, workspaceUser.userId),
          eq(users.id, workspaceUser.authUserId),
          and(
            eq(authTeamMembers.userId, workspaceUser.authUserId),
            or(
              eq(authMembers.role, "owner"),
              eq(authMembers.role, "admin"),
              eq(authMembers.role, "developer"),
              eq(authMembers.role, "analyst"),
            ),
          ),
        ),
      )
      .orderBy(desc(projects.updatedAt), desc(projects.createdAt))
  })

export const getCurrentProjectAccess = createMonitoredDbFn({ eventName: "web.project.get_current_project_access", method: "GET" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => {
    const access = await getProjectAccessForCurrentUser(data.projectId)
    return {
      projectId: access.projectId,
      role: access.role,
      canRead: access.canRead,
      canLabel: access.canLabel,
      canManage: access.canManage,
      isOwner: access.isOwner,
      userId: access.userId,
      authUserId: access.authUserId,
      accountRole: access.accountRole,
      teamId: access.teamId,
      organizationId: access.organizationId,
    }
  })

export const getProjectsByTeamId = createMonitoredDbFn({ eventName: "web.project.get_projects_by_team_id", method: "GET" })
  .inputValidator(z.object({ teamId: z.string() }))
  .handler(async ({ data }) => {
    const workspaceUser = await requireWorkspaceUser()
    const [teamMembership] = await db
      .select({ teamId: authTeamMembers.teamId })
      .from(authTeamMembers)
      .innerJoin(authTeams, eq(authTeams.id, authTeamMembers.teamId))
      .innerJoin(
        authMembers,
        and(
          eq(authMembers.organizationId, authTeams.organizationId),
          eq(authMembers.userId, workspaceUser.authUserId),
        ),
      )
      .where(
        and(
          eq(authTeamMembers.teamId, data.teamId),
          eq(authTeamMembers.userId, workspaceUser.authUserId),
          or(
            eq(authMembers.role, "owner"),
            eq(authMembers.role, "admin"),
            eq(authMembers.role, "developer"),
            eq(authMembers.role, "analyst"),
          ),
        ),
      )
      .limit(1)

    if (!teamMembership) {
      throw new Error("You do not have access to this team's projects")
    }

    const teamProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.ownerTeamId, data.teamId))
    return teamProjects
  })

// ** UPDATE **
// partial create schema with id still required
export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  id: z.string(),
})

export const updateProject = createMonitoredDbFn({ eventName: "web.project.update", method: "POST" })
  .inputValidator(UpdateProjectSchema)
  .handler(async ({ data }) => {
    const access = await requireProjectAccess(data.id, "manage")
    requirePermission(access, "manage_project")
    const { id, ...updateData } = data
    const updatedProject = await db.update(projects).set(updateData).where(eq(projects.id, id))
    if (updatedProject.rowCount === 0) {
      throw new Error("Project not found")
    }
    return { success: true }
  })

// ** DELETE **
export const deleteProject = createMonitoredDbFn({ eventName: "web.project.delete", method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const access = await requireProjectAccess(data.id, "manage")
    requirePermission(access, "manage_project")
    const project = await db.delete(projects).where(eq(projects.id, data.id))
    if (project.rowCount === 0) {
      throw new Error("Project not found")
    }
    return { success: true }
  })
