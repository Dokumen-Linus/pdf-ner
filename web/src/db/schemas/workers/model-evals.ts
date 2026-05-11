import { index, integer, jsonb, real, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { projects } from "../web/projects"

import { workersSchema } from "./schema"

export const chatModelEvalRuns = workersSchema.table(
  "chat_model_eval_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    beta: real("beta").notNull().default(1),
    labeledPdfs: uuid("labeled_pdfs").array().notNull(),
    chatModels: text("chat_models").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("chat_model_eval_runs_project_id_idx").on(t.projectId)],
)

export const chatModelEvalIterations = workersSchema.table(
  "chat_model_eval_iterations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatModelEvalRunId: uuid("chat_model_eval_run_id")
      .notNull()
      .references(() => chatModelEvalRuns.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull(),
    accumulatedUsd: real("accumulated_usd").notNull().default(0),
    overallF: real("overall_f").notNull(),
    perEntityScores: jsonb("per_entity_scores"),
    numExamplePdfs: integer("num_example_pdfs"),
    numCorrectPdfs: integer("num_correct_pdfs"),
    numCorrectEntityTypes: integer("num_correct_entity_types"),
    pdfAccuracy: real("pdf_accuracy"),
    entityTypeMetrics: jsonb("entity_type_metrics"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("chat_model_eval_iterations_run_id_idx").on(t.chatModelEvalRunId)],
)
