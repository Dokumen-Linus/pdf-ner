import { eq } from "drizzle-orm/sql"
import { z } from "zod"

import { db } from "@/db/client"
import { stdEntityTypes } from "@/db/schemas/public/std-entity-types"
import { createMonitoredDbFn } from "@/db-fns/web/monitoring"

export const getStdEntityTypeById = createMonitoredDbFn({ eventName: "web.public.std_entity_type.get_by_id", method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const [stdEntityType] = await db
      .select()
      .from(stdEntityTypes)
      .where(eq(stdEntityTypes.id, data.id))
      .limit(1)
    if (!stdEntityType) {
      throw new Error("Standard entity type not found")
    }
    return stdEntityType
  })

export const getStdEntityTypeByShortName = createMonitoredDbFn({ eventName: "web.public.std_entity_type.get_by_short_name", method: "GET" })
  .inputValidator(z.object({ shortName: z.string() }))
  .handler(async ({ data }) => {
    const [stdEntityType] = await db
      .select()
      .from(stdEntityTypes)
      .where(eq(stdEntityTypes.shortName, data.shortName))
      .limit(1)
    if (!stdEntityType) {
      throw new Error("Standard entity type not found")
    }
    return stdEntityType
  })

export const getAllStdEntityTypes = createMonitoredDbFn({ eventName: "web.public.std_entity_type.get_all_std_entity_types", method: "GET" })
  .inputValidator(z.void())
  .handler(async () => {
    const stdEntityTypesList = await db.select().from(stdEntityTypes)
    return stdEntityTypesList
  })

export const getStdEntityTypesByDatatype = createMonitoredDbFn({ eventName: "web.public.std_entity_type.get_std_entity_types_by_datatype", method: "GET" })
  .inputValidator(z.object({ datatype: z.string() }))
  .handler(async ({ data }) => {
    const stdEntityTypesList = await db
      .select()
      .from(stdEntityTypes)
      .where(eq(stdEntityTypes.datatype, data.datatype))
    return stdEntityTypesList
  })

export const getStdEntityTypesByCategory = createMonitoredDbFn({ eventName: "web.public.std_entity_type.get_std_entity_types_by_category", method: "GET" })
  .inputValidator(z.object({ category: z.string() }))
  .handler(async ({ data }) => {
    const stdEntityTypesList = await db
      .select()
      .from(stdEntityTypes)
      .where(eq(stdEntityTypes.category, data.category))
    return stdEntityTypesList
  })
