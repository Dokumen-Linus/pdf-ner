import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { prompts } from "../core/prompts"
import { chatModels } from "../public/chat-models"
import { projects } from "../web/projects"

import { workersSchema } from "./schema"

export const chatModelEvalRuns = workersSchema.table(
  "chat_model_eval_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    bestModelId: text("best_model_id").references(() => chatModels.id, { onDelete: "set null" }),
    beta: real("beta").notNull().default(1),
    accumulatedUsd: real("accumulated_usd").notNull().default(0),
    bestOverallF: real("best_overall_f"),
    bestAccuracyScore: real("best_accuracy_score"),
    labeledPdfs: uuid("labeled_pdfs").array().notNull(),
    chatModels: text("chat_models").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("chat_model_eval_runs_project_id_idx").on(t.projectId)],
)

export const chatModelEvalIterations = workersSchema.table(
  "chat_model_eval_iterations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    chatModelEvalRunId: uuid("chat_model_eval_run_id")
      .notNull()
      .references(() => chatModelEvalRuns.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull(),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    accumulatedUsd: real("accumulated_usd").notNull().default(0),
    overallF: real("overall_f").notNull(),
    perEntityScores: jsonb("per_entity_scores"),
    numExamplePdfs: integer("num_example_pdfs"),
    numCorrectPdfs: integer("num_correct_pdfs"),
    numCorrectEntityTypes: integer("num_correct_entity_types"),
    pdfAccuracy: real("pdf_accuracy"),
    entityTypeMetrics: jsonb("entity_type_metrics"),
    incorrectlyPredictedEntityValueIds: bigint("incorrectly_predicted_entity_value_ids", {
      mode: "number",
    })
      .array()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("chat_model_eval_iterations_run_id_idx").on(t.chatModelEvalRunId)],
)
