import { and, eq } from "drizzle-orm/sql"
import { z } from "zod"

import { db } from "@/db/client"
import { entityValues } from "@/db/schemas/core/entity-values"
import { createMonitoredDbFn } from "@/db-fns/web/monitoring"

export const getEntityValuesByPdfId = createMonitoredDbFn({ eventName: "web.core.entity_value.get_entity_values_by_pdf_id", method: "GET" })
  .inputValidator(z.object({ pdfId: z.string() }))
  .handler(async ({ data }) => {
    const values = await db.select().from(entityValues).where(eq(entityValues.pdfId, data.pdfId))
    return values
  })

export const getEntityValuesByPdfIdAndEntityTypeId = createMonitoredDbFn({ eventName: "web.core.entity_value.get_entity_values_by_pdf_id_and_entity_type_id", method: "GET" })
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

export const getLabelsByPdfId = createMonitoredDbFn({ eventName: "web.core.entity_value.get_labels_by_pdf_id", method: "GET" })
  .inputValidator(z.object({ pdfId: z.string() }))
  .handler(async ({ data }) => {
    const values = await db
      .select()
      .from(entityValues)
      .where(and(eq(entityValues.pdfId, data.pdfId), eq(entityValues.isLabel, true)))
    return values
  })

export const getPredictionsByPdfId = createMonitoredDbFn({ eventName: "web.core.entity_value.get_predictions_by_pdf_id", method: "GET" })
  .inputValidator(z.object({ pdfId: z.string() }))
  .handler(async ({ data }) => {
    const values = await db
      .select()
      .from(entityValues)
      .where(and(eq(entityValues.pdfId, data.pdfId), eq(entityValues.isLabel, false)))
    return values
  })
