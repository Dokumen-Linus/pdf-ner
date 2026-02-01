import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm/sql";
import { z } from "zod";
import { db } from "@/db/client"
import { entityTypes } from "@/db/schemas/web/entity_types"

// ** CREATE **
export const CreateEntityTypeSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  standardEntityTypeId: z.number().optional(),
  userDefinition: z.string().optional(),
  userExamples: z.array(z.string()).optional(),
  userFormatDescription: z.string().optional(),
  datatype: z.string().optional(),
  singleWord: z.boolean().optional(),
  exactLength: z.number().int().optional(),
  unique: z.boolean(),
  required: z.boolean(),
  subtype: z.string().optional(),
  color: z.string().optional(),
  opacity: z.number().optional(),
})

export const createEntityType = createServerFn({ method: "POST" })
  .inputValidator(CreateEntityTypeSchema)
  .handler(async ({ data }) => {
    const [entityType] = await db.insert(entityTypes).values(data).returning({id: entityTypes.id})
    return { id: entityType.id }
  })

// ** READ **
export const getEntityTypeById = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const entityType = await db.select().from(entityTypes).where(eq(entityTypes.id, data.id))
    if (entityType.length === 0) {
      throw new Error("Entity type not found")
    }
    return entityType[0]
  })

export const getEntityTypesByProjectId = createServerFn({ method: "GET" })
  .inputValidator((data: { projectId: string }) => data)
  .handler(async ({ data }) => {
    const entityTypesList = await db
      .select()
      .from(entityTypes)
      .where(eq(entityTypes.projectId, data.projectId))
    return entityTypesList
  })

// ** UPDATE **
// partial create schema with id required
export const UpdateEntityTypeSchema = CreateEntityTypeSchema.partial().extend({
  id: z.string(),
})

export const updateEntityType = createServerFn({ method: "POST" })
  .inputValidator(UpdateEntityTypeSchema)
  .handler(async ({ data }) => {
    const { id, ...updateData } = data
    const updatedEntityType = await db
      .update(entityTypes)
      .set(updateData)
      .where(eq(entityTypes.id, id))
    if (updatedEntityType.rowCount === 0) {
      throw new Error("Entity type not found")
    }
    return { success: true }
  })

// ** DELETE **
export const deleteEntityType = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const entityType = await db.delete(entityTypes).where(eq(entityTypes.id, data.id))
    if (entityType.rowCount === 0) {
      throw new Error("Entity type not found")
    }
    return { success: true }
  })