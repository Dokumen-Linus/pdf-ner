import { jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { prompts } from "../api/prompts"
import { projects } from "../web/projects"
import { workersSchema } from "./schema"

export const workersPdfs = workersSchema.table("pdfs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  // bucketId references public.aws_buckets — no .references() since public schema has no Drizzle definition
  bucketId: uuid("bucket_id").notNull(),
  filepath: text("filepath").notNull(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  fullText: text("full_text"),
  extractMethod: text("extract_method"),
  textByPage: jsonb("text_by_page"),
  textByBookmarks: jsonb("text_by_bookmarks"),
  predictedEntities: jsonb("predicted_entities"),
  modelType: text("model_type"),
  model: text("model"),
  promptId: uuid("prompt_id").references(() => prompts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
