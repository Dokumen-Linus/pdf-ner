import { jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { prompts } from "../api/prompts"
import { projects } from "../web/projects"

import { optimizedPrompts } from "./optimized-prompts"
import { workersSchema } from "./schema"

import type { JsonbRecord, JsonbValue } from "../../types"

export const workersPdfs = workersSchema.table("pdfs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  // bucketId references api.aws_buckets — no .references() cross-schema
  bucketId: uuid("bucket_id").notNull(),
  filepath: text("filepath").notNull(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  fullText: text("full_text"),
  extractMethod: text("extract_method"),
  // JSONB shapes owned by the Python workers service — we treat them as
  // opaque-but-typed (JsonbRecord / JsonbValue, not `unknown`) on the web side.
  textByPage: jsonb("text_by_page").$type<JsonbRecord | null>(),
  textByBookmarks: jsonb("text_by_bookmarks").$type<JsonbRecord | null>(),
  predictedEntities: jsonb("predicted_entities").$type<JsonbValue | null>(),
  modelType: text("model_type"),
  model: text("model"),
  promptId: uuid("prompt_id").references(() => prompts.id, { onDelete: "set null" }),
  optimizedPromptId: uuid("optimized_prompt_id").references(() => optimizedPrompts.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
