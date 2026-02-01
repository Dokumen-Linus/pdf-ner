import { relations } from "drizzle-orm"
import { jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { projects } from "../web/projects"
import { prompts } from "./prompts"
import { apiSchema } from "./schema"

export const apiPdfs = apiSchema.table("pdfs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  labeledEntities: jsonb("labeled_entities"),
  fullText: text("full_text"),
  extractMethod: text("extract_method"),
  textByPage: jsonb("text_by_page"),
  bookmarks: jsonb("bookmarks"),
  predictedEntities: jsonb("predicted_entities"),
  modelType: text("model_type"),
  model: text("model"),
  promptId: uuid("prompt_id").references(() => prompts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const apiPdfsRelations = relations(apiPdfs, ({ one }) => ({
  project: one(projects, {
    fields: [apiPdfs.projectId],
    references: [projects.id],
  }),
  prompt: one(prompts, {
    fields: [apiPdfs.promptId],
    references: [prompts.id],
  }),
}))
