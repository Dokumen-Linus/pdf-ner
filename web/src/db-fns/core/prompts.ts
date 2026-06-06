import { eq } from "drizzle-orm/sql"
import { z } from "zod"

import { db } from "@/db/client"
import { prompts } from "@/db/schemas/core/prompts"
import { createMonitoredDbFn } from "@/db-fns/web/monitoring"

export const getPromptById = createMonitoredDbFn({ eventName: "web.core.prompt.get_by_id", method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const [prompt] = await db.select().from(prompts).where(eq(prompts.id, data.id)).limit(1)
    if (!prompt) {
      throw new Error("Prompt not found")
    }
    return prompt
  })

export const getPromptsByProjectId = createMonitoredDbFn({ eventName: "web.core.prompt.get_prompts_by_project_id", method: "GET" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => {
    const promptsList = await db.select().from(prompts).where(eq(prompts.projectId, data.projectId))
    return promptsList
  })

export const getPromptsByTemplateId = createMonitoredDbFn({ eventName: "web.core.prompt.get_prompts_by_template_id", method: "GET" })
  .inputValidator(z.object({ templateId: z.number() }))
  .handler(async ({ data }) => {
    const promptsList = await db
      .select()
      .from(prompts)
      .where(eq(prompts.templateId, data.templateId))
    return promptsList
  })

export const getAllPrompts = createMonitoredDbFn({ eventName: "web.core.prompt.get_all_prompts", method: "GET" })
  .inputValidator(z.void())
  .handler(async () => {
    const promptsList = await db.select().from(prompts)
    return promptsList
  })
