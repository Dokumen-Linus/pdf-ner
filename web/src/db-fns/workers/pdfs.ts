import { count, eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db/client"
import { corePdfs } from "@/db/schemas/core/pdfs"
import { pdfTxts } from "@/db/schemas/workers/pdf-txts"
import { createMonitoredDbFn } from "@/db-fns/web/monitoring"
import { requirePdfAccess, requireProjectAccess } from "@/lib/project-authorization.server"

// ── core.pdfs ──

export const getCorePdfById = createMonitoredDbFn({ eventName: "web.workers.pdf.get_core_pdf_by_id", method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await requirePdfAccess(data.id, "label")
    const [pdf] = await db.select().from(corePdfs).where(eq(corePdfs.id, data.id)).limit(1)
    if (!pdf) {
      throw new Error("PDF not found")
    }
    return pdf
  })

export const getAllCorePdfs = createMonitoredDbFn({ eventName: "web.workers.pdf.get_all_core_pdfs", method: "GET" })
  .inputValidator(z.void())
  .handler(async () => {
    return db.select().from(corePdfs)
  })

export const getCorePdfIdsByProjectId = createMonitoredDbFn({ eventName: "web.workers.pdf.get_core_pdf_ids_by_project_id", method: "GET" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => {
    await requireProjectAccess(data.projectId, "label")
    return db
      .select({ id: corePdfs.id })
      .from(corePdfs)
      .where(eq(corePdfs.projectId, data.projectId))
  })

export const getCorePdfsCountByProjectId = createMonitoredDbFn({ eventName: "web.workers.pdf.get_core_pdfs_count_by_project_id", method: "GET" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => {
    await requireProjectAccess(data.projectId, "label")
    const [result] = await db
      .select({ count: count() })
      .from(corePdfs)
      .where(eq(corePdfs.projectId, data.projectId))
    return result?.count ?? 0
  })

export const getCorePdfsByProjectId = createMonitoredDbFn({ eventName: "web.workers.pdf.get_core_pdfs_by_project_id", method: "GET" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => {
    await requireProjectAccess(data.projectId, "label")
    return db.select().from(corePdfs).where(eq(corePdfs.projectId, data.projectId))
  })

// ── workers.pdf_txts ──

export const getPdfTxtByPdfId = createMonitoredDbFn({ eventName: "web.workers.pdf.get_txt_by_pdf_id", method: "GET" })
  .inputValidator(z.object({ pdfId: z.string() }))
  .handler(async ({ data }) => {
    const [txt] = await db.select().from(pdfTxts).where(eq(pdfTxts.pdfId, data.pdfId)).limit(1)
    return txt ?? null
  })

export const getPdfTxtsByExtractMethod = createMonitoredDbFn({ eventName: "web.workers.pdf.get_txts_by_extract_method", method: "GET" })
  .inputValidator(z.object({ extractMethod: z.string() }))
  .handler(async ({ data }) => {
    return db.select().from(pdfTxts).where(eq(pdfTxts.extractMethod, data.extractMethod))
  })
