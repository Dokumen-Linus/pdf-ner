import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm/sql"
import { z } from "zod"
import { createBucket } from "@/db-fns/api/storage"
import { db } from "@/db/client"
import { projects } from "@/db/schemas/web/projects"

// ** CREATE **
export const CreateProjectSchema = z.object({
  name: z.string(),
  ownerId: z.string(),
  description: z.string().optional(),
  colorPresets: z.array(z.string()).optional(),
  orientation: z.enum(["any", "portrait", "landscape"]).optional(),
})

export const createProject = createServerFn({ method: "POST" })
  .inputValidator(CreateProjectSchema)
  .handler(async ({ data }) => {
    const [project] = await db.insert(projects).values(data).returning({ id: projects.id })

    // Create an S3 bucket for this project and link it
    try {
      const bucket = await createBucket(`dokumen-${project.id}`)
      await db
        .update(projects)
        .set({ bucketId: bucket.bucket_id })
        .where(eq(projects.id, project.id))
    } catch (error) {
      // Delete the project if bucket creation fails
      await db.delete(projects).where(eq(projects.id, project.id))
      throw new Error(
        `Failed to create storage bucket: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    return { id: project.id }
  })

// ** READ **
export const getProjectById = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const project = await db.select().from(projects).where(eq(projects.id, data.id))
    if (!project) {
      throw new Error("Project not found")
    }
    return project
  })

export const getProjectByName = createServerFn({ method: "GET" })
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    const project = await db.select().from(projects).where(eq(projects.name, data.name))
    if (!project) {
      throw new Error("Project not found")
    }
    return project
  })

export const getProjectsByOwnerId = createServerFn({ method: "GET" })
  .inputValidator((data: { ownerId: string }) => data)
  .handler(async ({ data }) => {
    const userProjects = await db.select().from(projects).where(eq(projects.ownerId, data.ownerId))
    return userProjects
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
