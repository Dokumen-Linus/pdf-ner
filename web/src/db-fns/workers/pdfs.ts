import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm/sql"
import { z } from "zod"
import { db } from "@/db/client"
import { workersPdfs } from "@/db/schemas/workers/pdfs"

export const getWorkersPdfById = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const [pdf] = await db.select().from(workersPdfs).where(eq(workersPdfs.id, data.id)).limit(1)
    if (!pdf) {
      throw new Error("Workers PDF not found")
    }
    return pdf
  })

export const getAllWorkersPdfs = createServerFn({ method: "GET" })
  .inputValidator(() => ({}))
  .handler(async () => {
    return db.select().from(workersPdfs)
  })

export const getWorkersPdfsByProjectId = createServerFn({ method: "GET" })
  .inputValidator((data: { projectId: string }) => data)
  .handler(async ({ data }) => {
    return db.select().from(workersPdfs).where(eq(workersPdfs.projectId, data.projectId))
  })

export const getWorkersPdfsByName = createServerFn({ method: "GET" })
  .inputValidator(z.object({ name: z.string() }))
  .handler(async ({ data }) => {
    return db.select().from(workersPdfs).where(eq(workersPdfs.name, data.name))
  })

export const getWorkersPdfsByExtractMethod = createServerFn({ method: "GET" })
  .inputValidator(z.object({ extractMethod: z.string() }))
  .handler(async ({ data }) => {
    return db.select().from(workersPdfs).where(eq(workersPdfs.extractMethod, data.extractMethod))
  })

export const getWorkersPdfsByModelType = createServerFn({ method: "GET" })
  .inputValidator(z.object({ modelType: z.string() }))
  .handler(async ({ data }) => {
    return db.select().from(workersPdfs).where(eq(workersPdfs.modelType, data.modelType))
  })
