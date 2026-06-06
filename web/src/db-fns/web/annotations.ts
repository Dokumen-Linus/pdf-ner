import { and, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db/client"
import { entityValues } from "@/db/schemas/core/entity-values"
import { corePdfs } from "@/db/schemas/core/pdfs"
import { annotations } from "@/db/schemas/web/annotations"
import { entityTypes } from "@/db/schemas/web/entity-types"
import { pdfs } from "@/db/schemas/web/pdfs"
import { createMonitoredDbFn } from "@/db-fns/web/monitoring"
import {
  requirePdfAccess,
  requirePdfOwnership,
  requireUserId,
} from "@/lib/project-authorization.server"

import { LabeledEntitiesSchema, LABELING_LOCK_STALE_SECONDS } from "./pdfs"

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

const HexColorSchema = z
  .string()
  .transform((color) => color.toUpperCase())
  .refine((color) => /^#[0-9A-F]{6}$/.test(color), "Color must be #RRGGBB")

// ** CREATE **
export const CreateAnnotationSchema = z.object({
  id: z.string(),
  pdfId: z.string(),
  subtype: z.string().min(1, "Subtype is required"),
  rect: StoredRectSchema,
  segmentRects: z.array(StoredRectSchema),
  pageIndex: z.number().int().min(0, "Page index must be non-negative"),
  entityTypeId: z.string().uuid(),
  color: HexColorSchema.optional(),
  opacity: z.number().min(0).max(1).optional(),
  contents: z.string().optional(),
  customEntityType: z.string().optional(),
  author: z.string().optional(),
  created: z.date().optional(),
  modified: z.date().optional(),
  blendMode: z.string().optional(),
})

export const createAnnotation = createMonitoredDbFn({ eventName: "web.annotation.create", method: "POST" })
  .inputValidator(CreateAnnotationSchema)
  .handler(async ({ data }) => {
    const [annotation] = await db.insert(annotations).values(data).returning({ id: annotations.id })
    return { id: annotation.id }
  })

// ** READ **
export const getAnnotationById = createMonitoredDbFn({ eventName: "web.annotation.get_by_id", method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const annotation = await db.select().from(annotations).where(eq(annotations.id, data.id))
    if (annotation.length === 0) {
      throw new Error("Annotation not found")
    }
    return annotation[0]
  })

export const getAnnotationsByPdfId = createMonitoredDbFn({ eventName: "web.annotation.get_annotations_by_pdf_id", method: "GET" })
  .inputValidator(z.object({ pdfId: z.string() }))
  .handler(async ({ data }) => {
    await requirePdfAccess(data.pdfId, "label")
    const pdfAnnotations = await db
      .select()
      .from(annotations)
      .where(eq(annotations.pdfId, data.pdfId))
    return pdfAnnotations
  })

export const getAnnotationsByPdfIds = createMonitoredDbFn({ eventName: "web.annotation.get_annotations_by_pdf_ids", method: "GET" })
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

export const getAnnotationsBySubtype = createMonitoredDbFn({ eventName: "web.annotation.get_annotations_by_subtype", method: "GET" })
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

export const updateAnnotation = createMonitoredDbFn({ eventName: "web.annotation.update", method: "POST" })
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
export const deleteAnnotation = createMonitoredDbFn({ eventName: "web.annotation.delete", method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const annotation = await db.delete(annotations).where(eq(annotations.id, data.id))
    if (annotation.rowCount === 0) {
      throw new Error("Annotation not found")
    }
    return { success: true }
  })

// ** BULK SAVE WITH LOCK CHECK **
// Full-replace save path for the labeling page.
// Atomically:
//   1. SELECT … FOR UPDATE verifies the caller still holds the editing lock
//      (and the lock isn't stale).
//   2. DELETE all existing annotations for the pdf.
//   3. INSERT the provided annotation set.
//   4. Refresh the lock heartbeat on web.pdfs.
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

export class LabelingLockLostError extends Error {
  constructor(message = "Lock lost — your editing session expired") {
    super(message)
    this.name = "LabelingLockLostError"
  }
}

export const saveAnnotationsByPdfId = createMonitoredDbFn({ eventName: "web.annotation.save_annotations_by_pdf_id", method: "POST" })
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
          isStale: sql<boolean>`${pdfs.lockedAt} < now() - make_interval(secs => ${LABELING_LOCK_STALE_SECONDS})`,
        })
        .from(pdfs)
        .where(eq(pdfs.id, data.pdfId))
        .for("update")

      if (!row) {
        throw new Error("PDF not found")
      }
      if (row.lockedBy !== userId || row.isStale) {
        throw new LabelingLockLostError()
      }

      const [workersPdf] = await tx
        .select({ projectId: corePdfs.projectId })
        .from(corePdfs)
        .where(eq(corePdfs.id, data.pdfId))
        .limit(1)
      if (!workersPdf) {
        throw new Error("Core PDF not found")
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
      // saving is activity, so resetting the stale timer is correct.
      await tx
        .update(pdfs)
        .set({
          lockedAt: sql`now()`,
        })
        .where(and(eq(pdfs.id, data.pdfId), eq(pdfs.lockedBy, userId)))

      await tx.delete(annotations).where(eq(annotations.pdfId, data.pdfId))
      await tx
        .delete(entityValues)
        .where(and(eq(entityValues.pdfId, data.pdfId), eq(entityValues.isLabel, true)))

      if (resolvedAnnotations.length > 0) {
        await tx.insert(annotations).values(resolvedAnnotations)
      }

      const labelRows = resolvedAnnotations
        .filter((annotation) => annotation.contents)
        .map((annotation) => ({
          pdfId: annotation.pdfId,
          entityTypeId: annotation.entityTypeId,
          textValue: annotation.contents!,
          isLabel: true,
          rect: annotation.rect,
          segmentRects: annotation.segmentRects,
          pageIndex: annotation.pageIndex,
          contents: annotation.contents,
          author: annotation.author,
        }))

      if (labelRows.length > 0) {
        await tx.insert(entityValues).values(labelRows)
      }

      await tx
        .update(corePdfs)
        .set({ hasLabels: labelRows.length > 0 })
        .where(eq(corePdfs.id, data.pdfId))
    })

    return { success: true, count: data.annotations.length }
  })
