import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm/sql"
import { db } from "@/db/client"
import { templates } from "@/db/schemas/api/templates"

export const getTemplateById = createServerFn({ method: "GET" })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const [template] = await db.select().from(templates).where(eq(templates.id, data.id)).limit(1)
    if (!template) {
      throw new Error("Template not found")
    }
    return template
  })

export const getAllTemplates = createServerFn({ method: "GET" })
  .inputValidator(() => ({}))
  .handler(async () => {
    const templatesList = await db.select().from(templates)
    return templatesList
  })

export const getTemplatesByDocumentAtEnd = createServerFn({ method: "GET" })
  .inputValidator((data: { documentAtEnd: boolean }) => data)
  .handler(async ({ data }) => {
    const templatesList = await db
      .select()
      .from(templates)
      .where(eq(templates.documentAtEnd, data.documentAtEnd))
    return templatesList
  })
