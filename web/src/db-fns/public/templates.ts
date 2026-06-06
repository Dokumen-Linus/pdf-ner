import { eq } from "drizzle-orm/sql"
import { z } from "zod"

import { db } from "@/db/client"
import { templates } from "@/db/schemas/public/templates"
import { createMonitoredDbFn } from "@/db-fns/web/monitoring"

export const getTemplateById = createMonitoredDbFn({ eventName: "web.public.template.get_by_id", method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const [template] = await db.select().from(templates).where(eq(templates.id, data.id)).limit(1)
    if (!template) {
      throw new Error("Template not found")
    }
    return template
  })

export const getAllTemplates = createMonitoredDbFn({ eventName: "web.public.template.get_all_templates", method: "GET" })
  .inputValidator(z.void())
  .handler(async () => {
    const templatesList = await db.select().from(templates)
    return templatesList
  })
