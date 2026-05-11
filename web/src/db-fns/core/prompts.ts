import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm/sql"
import { z } from "zod"

import { db } from "@/db/client"
import { prompts } from "@/db/schemas/core/prompts"

export const getPromptById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const [prompt] = await db.select().from(prompts).where(eq(prompts.id, data.id)).limit(1)
    if (!prompt) {
      throw new Error("Prompt not found")
    }
    return prompt
  })

export const getPromptsByProjectId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => {
    const promptsList = await db.select().from(prompts).where(eq(prompts.projectId, data.projectId))
    return promptsList
  })

export const getPromptsByTemplateId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ templateId: z.number() }))
  .handler(async ({ data }) => {
    const promptsList = await db
      .select()
      .from(prompts)
      .where(eq(prompts.templateId, data.templateId))
    return promptsList
  })

export const getAllPrompts = createServerFn({ method: "GET" })
  .inputValidator(z.void())
  .handler(async () => {
    const promptsList = await db.select().from(prompts)
    return promptsList
  })
