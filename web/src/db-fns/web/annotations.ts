import { createServerFn } from "@tanstack/react-start"
import { eq, inArray } from "drizzle-orm/sql"
import { z } from "zod"
import { db } from "@/db/client"
import { annotations } from "@/db/schemas/web/annotations"

// ** CREATE **
export const CreateAnnotationSchema = z.object({
  id: z.string(),
  pdfId: z.string(),
  subtype: z.string().min(1, "Subtype is required"),
  rect: z.any(),
  segmentRects: z.array(z.any()),
  pageIndex: z.number().int().min(0, "Page index must be non-negative"),
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
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const annotation = await db.select().from(annotations).where(eq(annotations.id, data.id))
    if (annotation.length === 0) {
      throw new Error("Annotation not found")
    }
    return annotation[0]
  })

export const getAnnotationsByPdfId = createServerFn({ method: "GET" })
  .inputValidator((data: { pdfId: string }) => data)
  .handler(async ({ data }) => {
    const pdfAnnotations = await db
      .select()
      .from(annotations)
      .where(eq(annotations.pdfId, data.pdfId))
    return pdfAnnotations
  })

export const getAnnotationsByPdfIds = createServerFn({ method: "GET" })
  .inputValidator((data: { pdfIds: string[] }) => data)
  .handler(async ({ data }) => {
    if (data.pdfIds.length === 0) return []
    return db
      .select({
        id: annotations.id,
        customEntityType: annotations.customEntityType,
        subtype: annotations.subtype,
      })
      .from(annotations)
      .where(inArray(annotations.pdfId, data.pdfIds))
  })

export const getAnnotationsBySubtype = createServerFn({ method: "GET" })
  .inputValidator((data: { subtype: string }) => data)
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
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const annotation = await db.delete(annotations).where(eq(annotations.id, data.id))
    if (annotation.rowCount === 0) {
      throw new Error("Annotation not found")
    }
    return { success: true }
  })
