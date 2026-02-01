import { relations } from "drizzle-orm"
import { bigint, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { projects } from "../web/projects"
import { apiSchema } from "./schema"
import { templates } from "./templates"

export const prompts = apiSchema.table("prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  templateId: bigint("template_id", { mode: "number" }).references(() => templates.id, {
    onDelete: "cascade",
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
