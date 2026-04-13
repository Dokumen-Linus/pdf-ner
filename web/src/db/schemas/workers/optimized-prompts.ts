import { jsonb, real, text, timestamp, uuid } from "drizzle-orm/pg-core"
import type { JsonbRecord } from "../../types"
import { projects } from "../web/projects"
import { workersSchema } from "./schema"

export const optimizedPrompts = workersSchema.table("optimized_prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  fullText: text("full_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const promptEvaluations = workersSchema.table("prompt_evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  promptId: uuid("prompt_id")
    .notNull()
    .references(() => optimizedPrompts.id, { onDelete: "cascade" }),
  overallF1: real("overall_f1").notNull(),
  perEntityScores: jsonb("per_entity_scores").$type<JsonbRecord>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
