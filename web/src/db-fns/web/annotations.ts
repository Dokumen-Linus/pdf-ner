import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db/client"
import { annotations } from "@/db/schemas/web/annotations"
import { entityTypes } from "@/db/schemas/web/entity-types"
import { pdfs } from "@/db/schemas/web/pdfs"
import { workersPdfs } from "@/db/schemas/workers/pdfs"

import {
  requirePdfAccess,
  requirePdfOwnership,
  requireUserId,
} from "../../lib/authorization.server"

import { LabeledEntitiesSchema, LABELLING_LOCK_STALE_SECONDS } from "./pdfs"

// Zod mirror of the `StoredRect` JSONB shape in db/types.ts. Accepts either
// the nested (EmbedPDF-style) form or the flat form — all keys optional so
// either serialization round-trips. Reads normalize to the strict EmbedPDF
// `Rect` via `toEmbedRect` in db/rect.ts.
const StoredRectSchema = z.object({
  origin: z.object({ x: z.number(), y: z.number() }).optional(),
  size: z.object({ width: z.number(), height: z.number() }).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
})

// ** CREATE **
export const CreateAnnotationSchema = z.object({
  id: z.string(),
  pdfId: z.string(),
  subtype: z.string().min(1, "Subtype is required"),
  rect: StoredRectSchema,
  segmentRects: z.array(StoredRectSchema),
  pageIndex: z.number().int().min(0, "Page index must be non-negative"),
  entityTypeId: z.string().uuid(),
  color: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
  contents: z.string().optional(),
  customEntityType: z.string().optional(),
  author: z.string().optional(),
  created: z.date().optional(),
  modified: z.date().optional(),
  blendMode: z.string().optional(),
})

export const createAnnotation = createServerFn({ method: "POST" })
  .inputValidator(CreateAnnotationSchema)
  .handler(async ({ data }) => {
    const [annotation] = await db.insert(annotations).values(data).returning({ id: annotations.id })
    return { id: annotation.id }
  })

// ** READ **
export const getAnnotationById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const annotation = await db.select().from(annotations).where(eq(annotations.id, data.id))
    if (annotation.length === 0) {
      throw new Error("Annotation not found")
    }
    return annotation[0]
  })

export const getAnnotationsByPdfId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ pdfId: z.string() }))
  .handler(async ({ data }) => {
    await requirePdfAccess(data.pdfId, "label")
    const pdfAnnotations = await db
      .select()
      .from(annotations)
      .where(eq(annotations.pdfId, data.pdfId))
    return pdfAnnotations
  })

export const getAnnotationsByPdfIds = createServerFn({ method: "GET" })
  .inputValidator(z.object({ pdfIds: z.array(z.string()) }))
  .handler(async ({ data }) => {
    if (data.pdfIds.length === 0) return []
    return db
      .select({
        id: annotations.id,
        customEntityType: annotations.customEntityType,
        entityTypeId: annotations.entityTypeId,
        subtype: annotations.subtype,
      })
      .from(annotations)
      .where(inArray(annotations.pdfId, data.pdfIds))
  })

export const getAnnotationsBySubtype = createServerFn({ method: "GET" })
  .inputValidator(z.object({ subtype: z.string() }))
  .handler(async ({ data }) => {
    const subtypeAnnotations = await db
      .select()
      .from(annotations)
      .where(eq(annotations.subtype, data.subtype))
    return subtypeAnnotations
  })

// ** UPDATE **
// partial create schema with id required
export const UpdateAnnotationSchema = CreateAnnotationSchema.partial().extend({
  id: z.string(),
})

export const updateAnnotation = createServerFn({ method: "POST" })
  .inputValidator(UpdateAnnotationSchema)
  .handler(async ({ data }) => {
    const { id, ...updateData } = data
    const updatedAnnotation = await db
      .update(annotations)
      .set(updateData)
      .where(eq(annotations.id, id))
    if (updatedAnnotation.rowCount === 0) {
      throw new Error("Annotation not found")
    }
    return { success: true }
  })

// ** DELETE **
export const deleteAnnotation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const annotation = await db.delete(annotations).where(eq(annotations.id, data.id))
    if (annotation.rowCount === 0) {
      throw new Error("Annotation not found")
    }
    return { success: true }
  })

// ** BULK SAVE WITH LOCK CHECK **
// Full-replace save path for the labelling page.
// Atomically:
//   1. SELECT … FOR UPDATE verifies the caller still holds the editing lock
//      (and the lock isn't stale).
//   2. DELETE all existing annotations for the pdf.
//   3. INSERT the provided annotation set.
//   4. PATCH labeled_entities on web.pdfs so the row carries the aggregate.
// Transaction ensures no partial state on network/client death mid-save.
// Throws "Lock lost" if the lock was stolen after going stale.
export const SaveAnnotationsSchema = z.object({
  pdfId: z.string(),
  userId: z.string().optional(),
  annotations: z.array(
    CreateAnnotationSchema.omit({ entityTypeId: true }).extend({
      entityTypeId: z.string().uuid().optional(),
    }),
  ),
  labeledEntities: LabeledEntitiesSchema.optional(),
})

export class LabellingLockLostError extends Error {
  constructor(message = "Lock lost — your editing session expired") {
    super(message)
    this.name = "LabellingLockLostError"
  }
}

export const saveAnnotationsByPdfId = createServerFn({ method: "POST" })
  .inputValidator(SaveAnnotationsSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    if (data.userId && data.userId !== userId) {
      throw new Error("Cannot act as another user")
    }
    await requirePdfOwnership(data.pdfId, userId)

    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          lockedBy: pdfs.lockedBy,
          isStale: sql<boolean>`${pdfs.lockedAt} < now() - make_interval(secs => ${LABELLING_LOCK_STALE_SECONDS})`,
        })
        .from(pdfs)
        .where(eq(pdfs.id, data.pdfId))
        .for("update")

      if (!row) {
        throw new Error("PDF not found")
      }
      if (row.lockedBy !== userId || row.isStale) {
        throw new LabellingLockLostError()
      }

      const [workersPdf] = await tx
        .select({ projectId: workersPdfs.projectId })
        .from(workersPdfs)
        .where(eq(workersPdfs.id, data.pdfId))
        .limit(1)
      if (!workersPdf) {
        throw new Error("Workers PDF not found")
      }

      const projectEntityTypes = await tx
        .select({ id: entityTypes.id, name: entityTypes.name })
        .from(entityTypes)
        .where(eq(entityTypes.projectId, workersPdf.projectId))
      const entityTypeById = new Map(projectEntityTypes.map((et) => [et.id, et]))
      const entityTypeByName = new Map(projectEntityTypes.map((et) => [et.name, et]))
      const resolvedAnnotations = data.annotations.map((annotation) => {
        const resolved = annotation.entityTypeId
          ? entityTypeById.get(annotation.entityTypeId)
          : annotation.customEntityType
            ? entityTypeByName.get(annotation.customEntityType)
            : undefined

        if (!resolved) {
          throw new Error("Annotation entity type is invalid for this project")
        }

        return {
          ...annotation,
          entityTypeId: resolved.id,
          customEntityType: annotation.customEntityType ?? resolved.name,
        }
      })

      // Refresh the lock's heartbeat as a side effect of a successful save —
      // saving is activity, so resetting the stale timer is correct. Also
      // update the `annotated` fast-path flag so future loads of this pdf
      // can short-circuit the annotations fetch when empty.
      await tx
        .update(pdfs)
        .set({
          labeledEntities: data.labeledEntities ?? null,
          lockedAt: sql`now()`,
          annotated: resolvedAnnotations.length > 0,
        })
        .where(and(eq(pdfs.id, data.pdfId), eq(pdfs.lockedBy, userId)))

      await tx.delete(annotations).where(eq(annotations.pdfId, data.pdfId))

      if (resolvedAnnotations.length > 0) {
        await tx.insert(annotations).values(resolvedAnnotations)
      }
    })

    return { success: true, count: data.annotations.length }
  })
