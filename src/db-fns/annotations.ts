import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm/sql"
import { z } from "zod"
import { db } from "@/db/client"
import { annotations } from "@/db/schema/annotations"

// ** CREATE **
export const CreateAnnotationSchema = z.object({
  id: z.string().optional(),
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
    await db.insert(annotations).values(data)
    return { success: true }
  })

// ** READ **
export const getAnnotationById = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const annotation = await db.select().from(annotations).where(eq(annotations.id, data.id))
    if (annotation.length === 0) {
      throw new Error("Annotation not found")
    }
    return annotation[0] as any
  })

export const getAnnotationsByPdfId = createServerFn({ method: "GET" })
  .inputValidator((data: { pdfId: string }) => data)
  .handler(async ({ data }) => {
    const pdfAnnotations = await db
      .select()
      .from(annotations)
      .where(eq(annotations.pdfId, data.pdfId))
    return pdfAnnotations as any
  })

export const getAnnotationsBySubtype = createServerFn({ method: "GET" })
  .inputValidator((data: { subtype: string }) => data)
  .handler(async ({ data }) => {
    const subtypeAnnotations = await db
      .select()
      .from(annotations)
      .where(eq(annotations.subtype, data.subtype))
    return subtypeAnnotations as any
  })

// ** UPDATE **
// partial create schema with id still required
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
