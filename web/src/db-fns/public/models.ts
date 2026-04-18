import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm/sql"
import { z } from "zod"

import { db } from "@/db/client"
import { models } from "@/db/schemas/public/models"

export const getModelById = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const [model] = await db.select().from(models).where(eq(models.id, data.id)).limit(1)
    if (!model) {
      throw new Error("Model not found")
    }
    return model
  })

export const getAllModels = createServerFn({ method: "GET" })
  .inputValidator(() => ({}))
  .handler(async () => {
    const modelsList = await db.select().from(models)
    return modelsList
  })

export const getModelsByProvider = createServerFn({ method: "GET" })
  .inputValidator(z.object({ provider: z.string() }))
  .handler(async ({ data }) => {
    const modelsList = await db.select().from(models).where(eq(models.provider, data.provider))
    return modelsList
  })
