import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm/sql";
import { z } from "zod";
import { db } from "@/db/client";
import { pdfs } from "@/db/schemas/web/pdfs";


// ** CREATE **
export const CreatePdfSchema = z.object({
  id: z.string(),
  firstViewedAt: z.date().optional(),
})

export const createPdf = createServerFn({ method: "POST" })
  .inputValidator(CreatePdfSchema)
  .handler(async ({ data }) => {
    const [pdf] = await db.insert(pdfs).values(data).returning({ id: pdfs.id })
    return { id: pdf.id }
  })

// ** READ **
export const getPdfById = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const pdf = await db.select().from(pdfs).where(eq(pdfs.id, data.id))
    if (pdf.length === 0) {
      throw new Error("PDF not found")
    }
    return pdf[0]
  })

// ** UPDATE **
// partial create schema with id required
export const UpdatePdfSchema = CreatePdfSchema.partial().extend({
  id: z.string(),
})

export const updatePdf = createServerFn({ method: "POST" })
  .inputValidator(UpdatePdfSchema)
  .handler(async ({ data }) => {
    const { id, ...updateData } = data
    const updatedPdf = await db.update(pdfs).set(updateData).where(eq(pdfs.id, id))
    if (updatedPdf.rowCount === 0) {
      throw new Error("PDF not found")
    }
    return { success: true }
  })

// ** DELETE **
export const deletePdf = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const pdf = await db.delete(pdfs).where(eq(pdfs.id, data.id))
    if (pdf.rowCount === 0) {
      throw new Error("PDF not found")
    }
    return { success: true }
  })