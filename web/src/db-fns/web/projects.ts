import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, isNotNull, or } from "drizzle-orm/sql"
import { z } from "zod"
import {
  getProjectAccessForCurrentUser,
  requireProjectAccess,
  requireWorkspaceUser,
} from "@/db-fns/api/_helpers.server"
import { createBucket } from "@/db-fns/api/storage"
import { db } from "@/db/client"
import { authMembers, authTeamMembers, authTeams } from "@/db/schemas/auth"
import { projects } from "@/db/schemas/web/projects"
import { users } from "@/db/schemas/web/users"

// ** CREATE **
export const CreateProjectSchema = z.object({
  name: z.string(),
  ownerId: z.string(),
  teamId: z.string().optional(),
  description: z.string().optional(),
  colorPresets: z.array(z.string()).optional(),
  orientation: z.enum(["any", "portrait", "landscape"]).optional(),
})

export const createProject = createServerFn({ method: "POST" })
  .inputValidator(CreateProjectSchema)
  .handler(async ({ data }) => {
    const workspaceUser = await requireWorkspaceUser()

    if (data.ownerId && data.ownerId !== workspaceUser.userId) {
      throw new Error("Cannot create a project for another user")
    }

    const effectiveTeamId =
      data.teamId ??
      (
        await db
          .select({ teamId: authTeamMembers.teamId })
          .from(authTeamMembers)
          .innerJoin(authTeams, eq(authTeams.id, authTeamMembers.teamId))
          .where(eq(authTeamMembers.userId, workspaceUser.authUserId))
          .orderBy(authTeams.createdAt)
          .limit(1)
      )[0]?.teamId

    // Reuse the bucket from an existing project if the user already has one
    const [existingWithBucket] = await db
      .select({ bucketId: projects.bucketId })
      .from(projects)
      .where(and(eq(projects.ownerId, workspaceUser.userId), isNotNull(projects.bucketId)))
      .limit(1)

    const [project] = await db
      .insert(projects)
      .values({
        ...data,
        ownerId: workspaceUser.userId,
        teamId: effectiveTeamId,
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
export const getProjectById = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireProjectAccess(data.id, "read")
    const project = await db.select().from(projects).where(eq(projects.id, data.id))
    if (project.length === 0) {
      throw new Error("Project not found")
    }
    return project[0]
  })

export const getProjectByName = createServerFn({ method: "GET" })
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    const project = await db.select().from(projects).where(eq(projects.name, data.name))
    if (project.length === 0) {
      throw new Error("Project not found")
    }
    return project[0]
  })

export const getProjectsByOwnerId = createServerFn({ method: "GET" })
  .inputValidator((data: { ownerId: string }) => data)
  .handler(async ({ data }) => {
    const userProjects = await db.select().from(projects).where(eq(projects.ownerId, data.ownerId))
    return userProjects
  })

export const getAccessibleProjects = createServerFn({ method: "GET" })
  .inputValidator(() => ({}))
  .handler(async () => {
    const workspaceUser = await requireWorkspaceUser()
    return db
      .selectDistinct({
        id: projects.id,
        ownerId: projects.ownerId,
        teamId: projects.teamId,
        name: projects.name,
        description: projects.description,
        bucketId: projects.bucketId,
        colorPresets: projects.colorPresets,
        orientation: projects.orientation,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.ownerId))
      .leftJoin(authTeams, eq(authTeams.id, projects.teamId))
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
          eq(authTeamMembers.teamId, projects.teamId),
          eq(authTeamMembers.userId, workspaceUser.authUserId),
        ),
      )
      .where(
        or(
          eq(users.id, workspaceUser.userId),
          eq(users.authUserId, workspaceUser.authUserId),
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

export const getCurrentProjectAccess = createServerFn({ method: "GET" })
  .inputValidator((data: { projectId: string }) => data)
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
      teamId: access.teamId,
      organizationId: access.organizationId,
    }
  })

export const getProjectsByTeamId = createServerFn({ method: "GET" })
  .inputValidator((data: { teamId: string }) => data)
  .handler(async ({ data }) => {
    const teamProjects = await db.select().from(projects).where(eq(projects.teamId, data.teamId))
    return teamProjects
  })

// ** UPDATE **
// partial create schema with id still required
export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  id: z.string(),
})

export const updateProject = createServerFn({ method: "POST" })
  .inputValidator(UpdateProjectSchema)
  .handler(async ({ data }) => {
    await requireProjectAccess(data.id, "manage")
    const { id, ...updateData } = data
    const updatedProject = await db.update(projects).set(updateData).where(eq(projects.id, id))
    if (updatedProject.rowCount === 0) {
      throw new Error("Project not found")
    }
    return { success: true }
  })

// ** DELETE **
export const deleteProject = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireProjectAccess(data.id, "manage")
    const project = await db.delete(projects).where(eq(projects.id, data.id))
    if (project.rowCount === 0) {
      throw new Error("Project not found")
    }
    return { success: true }
  })
