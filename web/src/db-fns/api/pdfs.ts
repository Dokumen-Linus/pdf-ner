import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm/sql"
import { z } from "zod"
import { db } from "@/db/client"
import { apiPdfs } from "@/db/schemas/api/pdfs"

export const getApiPdfById = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const [pdf] = await db.select().from(apiPdfs).where(eq(apiPdfs.id, data.id)).limit(1)
    if (!pdf) {
      throw new Error("API PDF not found")
    }
    return pdf
  })

export const getApiPdfsByProjectId = createServerFn({ method: "GET" })
  .inputValidator((data: { projectId: string }) => data)
  .handler(async ({ data }) => {
    const pdfsList = await db.select().from(apiPdfs).where(eq(apiPdfs.projectId, data.projectId))
    return pdfsList
  })

export const getApiPdfsByName = createServerFn({ method: "GET" })
  .inputValidator(z.object({ name: z.string() }))
  .handler(async ({ data }) => {
    const pdfsList = await db.select().from(apiPdfs).where(eq(apiPdfs.name, data.name))
    return pdfsList
  })

export const getApiPdfsByExtractMethod = createServerFn({ method: "GET" })
  .inputValidator(z.object({ extractMethod: z.string() }))
  .handler(async ({ data }) => {
    const pdfsList = await db
      .select()
      .from(apiPdfs)
      .where(eq(apiPdfs.extractMethod, data.extractMethod))
    return pdfsList
  })

export const getApiPdfsByModelType = createServerFn({ method: "GET" })
  .inputValidator(z.object({ modelType: z.string() }))
  .handler(async ({ data }) => {
    const pdfsList = await db.select().from(apiPdfs).where(eq(apiPdfs.modelType, data.modelType))
    return pdfsList
  })

export const getAllApiPdfs = createServerFn({ method: "GET" })
  .inputValidator(() => ({}))
  .handler(async () => {
    const pdfsList = await db.select().from(apiPdfs)
    return pdfsList
  })
