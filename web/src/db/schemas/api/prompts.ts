import { relations } from "drizzle-orm"
import { bigint, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { templates } from "../public/templates"
import { projects } from "../web/projects"
import { apiSchema } from "./schema"

export const prompts = apiSchema.table("prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  templateId: bigint("template_id", { mode: "number" }).references(() => templates.id, {
    onDelete: "set null",
  }),
  fullText: text("full_text"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const promptsRelations = relations(prompts, ({ one }) => ({
  project: one(projects, {
    fields: [prompts.projectId],
    references: [projects.id],
  }),
  template: one(templates, {
    fields: [prompts.templateId],
    references: [templates.id],
  }),
}))
