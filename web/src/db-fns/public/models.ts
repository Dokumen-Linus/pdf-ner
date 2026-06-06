import { and, desc, eq, gt, isNull, or } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db/client"
import { chatModels } from "@/db/schemas/public/chat-models"
import { extractMethods } from "@/db/schemas/public/extract-methods"
import { createMonitoredDbFn } from "@/db-fns/web/monitoring"

export const getChatModelById = createMonitoredDbFn({ eventName: "web.public.model.get_chat_model_by_id", method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const [model] = await db.select().from(chatModels).where(eq(chatModels.id, data.id)).limit(1)
    if (!model) {
      throw new Error("Chat model not found")
    }
    return model
  })

export const getAllChatModels = createMonitoredDbFn({ eventName: "web.public.model.get_all_chat_models", method: "GET" })
  .inputValidator(z.void())
  .handler(async () => {
    const modelsList = await db.select().from(chatModels)
    return modelsList
  })

export const getChatModelsByHost = createMonitoredDbFn({ eventName: "web.public.model.get_chat_models_by_host", method: "GET" })
  .inputValidator(z.object({ host: z.string() }))
  .handler(async ({ data }) => {
    const modelsList = await db.select().from(chatModels).where(eq(chatModels.host, data.host))
    return modelsList
  })

export const getAvailableGoogleChatModels = createMonitoredDbFn({ eventName: "web.public.model.get_available_google_chat_models", method: "GET" })
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

export const getAllExtractMethods = createMonitoredDbFn({ eventName: "web.public.model.get_all_extract_methods", method: "GET" })
  .inputValidator(z.void())
  .handler(async () => {
    const methodsList = await db.select().from(extractMethods)
    return methodsList
  })
