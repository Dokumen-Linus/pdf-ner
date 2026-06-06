import { eq } from "drizzle-orm/sql"
import { z } from "zod"

import { db } from "@/db/client"
import { entityTypes } from "@/db/schemas/web/entity-types"
import { createMonitoredDbFn } from "@/db-fns/web/monitoring"
import { requireProjectAccess } from "@/lib/project-authorization.server"
import { requirePermission } from "@/lib/role-authorization.server"

const HexColorSchema = z
  .string()
  .transform((color) => color.toUpperCase())
  .refine((color) => /^#[0-9A-F]{6}$/.test(color), "Color must be #RRGGBB")

// ** CREATE **
export const CreateEntityTypeSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  standardEntityTypeId: z.number().optional(),
  userDefinition: z.string().optional(),
  userExampleValues: z.array(z.string()).optional(),
  userFormatDescription: z.string().optional(),
  datatype: z.string().optional(),
  regex: z.string().optional(),
  exactLength: z.number().int().optional(),
  unique: z.boolean(),
  required: z.boolean(),
  subtype: z.string().optional(),
  color: HexColorSchema,
  opacity: z.number().optional(),
})

export const createEntityType = createMonitoredDbFn({ eventName: "web.entity_type.create", method: "POST" })
  .inputValidator(CreateEntityTypeSchema)
  .handler(async ({ data }) => {
    const access = await requireProjectAccess(data.projectId, "manage")
    requirePermission(access, "manage_entity_types")
    const [entityType] = await db.insert(entityTypes).values(data).returning({ id: entityTypes.id })
    return { id: entityType.id }
  })

// ** READ **
export const getEntityTypeById = createMonitoredDbFn({ eventName: "web.entity_type.get_by_id", method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const entityType = await db.select().from(entityTypes).where(eq(entityTypes.id, data.id))
    if (entityType.length === 0) {
      throw new Error("Entity type not found")
    }
    return entityType[0]
  })

export const getEntityTypesByProjectId = createMonitoredDbFn({ eventName: "web.entity_type.get_entity_types_by_project_id", method: "GET" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => {
    await requireProjectAccess(data.projectId, "label")
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

export const updateEntityType = createMonitoredDbFn({ eventName: "web.entity_type.update", method: "POST" })
  .inputValidator(UpdateEntityTypeSchema)
  .handler(async ({ data }) => {
    const { id, ...updateData } = data
    const [existing] = await db
      .select({ projectId: entityTypes.projectId })
      .from(entityTypes)
      .where(eq(entityTypes.id, id))
      .limit(1)
    if (!existing) {
      throw new Error("Entity type not found")
    }
    const access = await requireProjectAccess(existing.projectId, "manage")
    requirePermission(access, "manage_entity_types")
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
export const deleteEntityType = createMonitoredDbFn({ eventName: "web.entity_type.delete", method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const [existing] = await db
      .select({ projectId: entityTypes.projectId })
      .from(entityTypes)
      .where(eq(entityTypes.id, data.id))
      .limit(1)
    if (!existing) {
      throw new Error("Entity type not found")
    }
    const access = await requireProjectAccess(existing.projectId, "manage")
    requirePermission(access, "manage_entity_types")
    const entityType = await db.delete(entityTypes).where(eq(entityTypes.id, data.id))
    if (entityType.rowCount === 0) {
      throw new Error("Entity type not found")
    }
    return { success: true }
  })
