import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm/sql"
import { z } from "zod"

import { db } from "@/db/client"
import { chatModels } from "@/db/schemas/public/chat-models"

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
