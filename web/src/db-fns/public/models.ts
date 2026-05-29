import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, gt, isNull, or } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db/client"
import { chatModels } from "@/db/schemas/public/chat-models"
import { extractMethods } from "@/db/schemas/public/extract-methods"

export const getChatModelById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const [model] = await db.select().from(chatModels).where(eq(chatModels.id, data.id)).limit(1)
    if (!model) {
      throw new Error("Chat model not found")
    }
    return model
  })

export const getAllChatModels = createServerFn({ method: "GET" })
  .inputValidator(z.void())
  .handler(async () => {
    const modelsList = await db.select().from(chatModels)
    return modelsList
  })

export const getChatModelsByHost = createServerFn({ method: "GET" })
  .inputValidator(z.object({ host: z.string() }))
  .handler(async ({ data }) => {
    const modelsList = await db.select().from(chatModels).where(eq(chatModels.host, data.host))
    return modelsList
  })

export const getAvailableGoogleChatModels = createServerFn({ method: "GET" })
  .inputValidator(z.void())
  .handler(async () => {
    const now = new Date()
    const modelsList = await db
      .select()
      .from(chatModels)
      .where(
        and(
          eq(chatModels.host, "Google"),
          or(isNull(chatModels.endAvailableDate), gt(chatModels.endAvailableDate, now)),
        ),
      )
      .orderBy(desc(chatModels.releaseDate), desc(chatModels.availableDate), desc(chatModels.id))
    return modelsList
  })

export const getAllExtractMethods = createServerFn({ method: "GET" })
  .inputValidator(z.void())
  .handler(async () => {
    const methodsList = await db.select().from(extractMethods)
    return methodsList
  })

