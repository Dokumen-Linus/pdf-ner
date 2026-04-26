import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm/sql"
import { z } from "zod"

import { db } from "@/db/client"
import { apiPdfs } from "@/db/schemas/api/pdfs"

export const getApiPdfById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const [pdf] = await db.select().from(apiPdfs).where(eq(apiPdfs.id, data.id)).limit(1)
    if (!pdf) {
      throw new Error("API PDF not found")
    }
    return pdf
  })

export const getAllApiPdfs = createServerFn({ method: "GET" })
  .inputValidator(z.void())
  .handler(async () => {
    const pdfsList = await db.select().from(apiPdfs)
    return pdfsList
  })
