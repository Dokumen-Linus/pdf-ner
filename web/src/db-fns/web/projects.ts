import { createServerFn } from "@tanstack/react-start"
import { and, eq, isNotNull } from "drizzle-orm/sql"
import { z } from "zod"
import { createBucket } from "@/db-fns/api/storage"
import { db } from "@/db/client"
import { projects } from "@/db/schemas/web/projects"

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
    // Reuse the bucket from an existing project if the user already has one
    const [existingWithBucket] = await db
      .select({ bucketId: projects.bucketId })
      .from(projects)
      .where(and(eq(projects.ownerId, data.ownerId), isNotNull(projects.bucketId)))
      .limit(1)

    const [project] = await db.insert(projects).values(data).returning({ id: projects.id })

    let bucketId: string
    if (existingWithBucket?.bucketId) {
      bucketId = existingWithBucket.bucketId
    } else {
      // No existing bucket — create a new one and link it
      try {
        const bucket = await createBucket(`dokumen-${project.id}`)
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
    const project = await db.delete(projects).where(eq(projects.id, data.id))
    if (project.rowCount === 0) {
      throw new Error("Project not found")
    }
    return { success: true }
  })
