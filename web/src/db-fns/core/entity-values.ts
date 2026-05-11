import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm/sql"
import { z } from "zod"

import { db } from "@/db/client"
import { entityValues } from "@/db/schemas/core/entity-values"

export const getEntityValuesByPdfId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ pdfId: z.string() }))
  .handler(async ({ data }) => {
    const values = await db.select().from(entityValues).where(eq(entityValues.pdfId, data.pdfId))
    return values
  })

export const getEntityValuesByPdfIdAndEntityTypeId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ pdfId: z.string(), entityTypeId: z.string() }))
  .handler(async ({ data }) => {
    const values = await db
      .select()
      .from(entityValues)
      .where(
        and(eq(entityValues.pdfId, data.pdfId), eq(entityValues.entityTypeId, data.entityTypeId)),
      )
    return values
  })

export const getLabelsByPdfId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ pdfId: z.string() }))
  .handler(async ({ data }) => {
    const values = await db
      .select()
      .from(entityValues)
      .where(and(eq(entityValues.pdfId, data.pdfId), eq(entityValues.isLabel, true)))
    return values
  })

export const getPredictionsByPdfId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ pdfId: z.string() }))
  .handler(async ({ data }) => {
    const values = await db
      .select()
      .from(entityValues)
      .where(and(eq(entityValues.pdfId, data.pdfId), eq(entityValues.isLabel, false)))
    return values
  })
