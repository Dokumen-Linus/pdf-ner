import { createServerFn } from "@tanstack/react-start"
import { count, desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db/client"
import { corePdfs } from "@/db/schemas/core/pdfs"
import { pdfTxts } from "@/db/schemas/workers/pdf-txts"
import { requireProjectAccess } from "@/lib/project-authorization.server"

export const getCorePdfById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const [pdf] = await db.select().from(corePdfs).where(eq(corePdfs.id, data.id)).limit(1)
    if (!pdf) {
      throw new Error("PDF not found")
    }
    return pdf
  })

export const getAllCorePdfs = createServerFn({ method: "GET" })
  .inputValidator(z.void())
  .handler(async () => {
    return db.select().from(corePdfs)
  })

export const getCorePdfIdsByProjectId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => {
    await requireProjectAccess(data.projectId, "label")
    return db
      .select({ id: corePdfs.id })
      .from(corePdfs)
      .where(eq(corePdfs.projectId, data.projectId))
  })

export const getCorePdfsCountByProjectId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => {
    await requireProjectAccess(data.projectId, "label")
    const [result] = await db
      .select({ count: count() })
      .from(corePdfs)
      .where(eq(corePdfs.projectId, data.projectId))
    return result?.count ?? 0
  })

export const getCorePdfsByProjectId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => {
    await requireProjectAccess(data.projectId, "label")
    return db.select().from(corePdfs).where(eq(corePdfs.projectId, data.projectId))
  })

export const getCorePdfsWithLatestTxtByProjectId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => {
    await requireProjectAccess(data.projectId, "label")
    const pdfRows = await db.select().from(corePdfs).where(eq(corePdfs.projectId, data.projectId))
    const pdfIds = pdfRows.map((pdf) => pdf.id)
    if (pdfIds.length === 0) return []

    const txtRows = await db
      .select({
        id: pdfTxts.id,
        pdfId: pdfTxts.pdfId,
        extractMethod: pdfTxts.extractMethod,
        txt: pdfTxts.txt,
        createdAt: pdfTxts.createdAt,
      })
      .from(pdfTxts)
      .where(inArray(pdfTxts.pdfId, pdfIds))
      .orderBy(desc(pdfTxts.createdAt))

    const latestTxtByPdfId = new Map<string, (typeof txtRows)[number]>()
    for (const txt of txtRows) {
      if (!latestTxtByPdfId.has(txt.pdfId)) {
        latestTxtByPdfId.set(txt.pdfId, txt)
      }
    }

    return pdfRows.map((pdf) => ({
      ...pdf,
      latestTxt: latestTxtByPdfId.get(pdf.id) ?? null,
    }))
  })
