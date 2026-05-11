import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm/sql"
import { z } from "zod"

import { db } from "@/db/client"
import { stdEntityTypes } from "@/db/schemas/public/std-entity-types"

export const getStdEntityTypeById = createServerFn({ method: "GET" })
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

export const getStdEntityTypeByShortName = createServerFn({ method: "GET" })
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

export const getAllStdEntityTypes = createServerFn({ method: "GET" })
  .inputValidator(z.void())
  .handler(async () => {
    const stdEntityTypesList = await db.select().from(stdEntityTypes)
    return stdEntityTypesList
  })

export const getStdEntityTypesByDatatype = createServerFn({ method: "GET" })
  .inputValidator(z.object({ datatype: z.string() }))
  .handler(async ({ data }) => {
    const stdEntityTypesList = await db
      .select()
      .from(stdEntityTypes)
      .where(eq(stdEntityTypes.datatype, data.datatype))
    return stdEntityTypesList
  })

export const getStdEntityTypesByCategory = createServerFn({ method: "GET" })
  .inputValidator(z.object({ category: z.string() }))
  .handler(async ({ data }) => {
    const stdEntityTypesList = await db
      .select()
      .from(stdEntityTypes)
      .where(eq(stdEntityTypes.category, data.category))
    return stdEntityTypesList
  })
