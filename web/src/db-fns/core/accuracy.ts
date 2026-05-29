import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db/client"
import { entityValues } from "@/db/schemas/core/entity-values"
import { corePdfs } from "@/db/schemas/core/pdfs"
import { entityTypes } from "@/db/schemas/web/entity-types"
import { requireProjectAccess } from "@/lib/project-authorization.server"

export const getAccuracyDataByProjectId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => {
    // 1. Authenticate user access to the project
    await requireProjectAccess(data.projectId, "read")

    // 2. Fetch all PDFs in this project that have labels
    const pdfs = await db
      .select()
      .from(corePdfs)
      .where(and(eq(corePdfs.projectId, data.projectId), eq(corePdfs.hasLabels, true)))

    const pdfIds = pdfs.map((pdf) => pdf.id)

    // 3. Fetch all entity values (labels and predictions) for these PDFs
    let values: (typeof entityValues.$inferSelect)[] = []
    if (pdfIds.length > 0) {
      values = await db.select().from(entityValues).where(inArray(entityValues.pdfId, pdfIds))
    }

    // 4. Fetch all entity types for this project
    const types = await db
      .select()
      .from(entityTypes)
      .where(eq(entityTypes.projectId, data.projectId))

    return {
      pdfs,
      entityValues: values,
      entityTypes: types,
    }
  })
