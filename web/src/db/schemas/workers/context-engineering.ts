import { bigint, bigserial, index, integer, jsonb, real, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { entityTypes } from "../web/entity-types"
import { projects } from "../web/projects"

import { workersSchema } from "./schema"

export const contextEngineeringRuns = workersSchema.table(
  "context_engineering_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    beta: real("beta").notNull().default(1),
    maxUsd: real("max_usd").notNull(),
    accumulatedUsd: real("accumulated_usd").notNull().default(0),
    bestOverallF: real("best_overall_f"),
    stopReason: text("stop_reason"),
    labeledPdfs: uuid("labeled_pdfs").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("context_engineering_runs_project_id_idx").on(t.projectId)],
)

export const contextEngineeringIterations = workersSchema.table(
  "context_engineering_iterations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    contextEngRunId: uuid("context_eng_run_id")
      .notNull()
      .references(() => contextEngineeringRuns.id, { onDelete: "cascade" }),
    // Cross-schema FK: prompt_id UUID REFERENCES core.prompts (id)
    promptId: uuid("prompt_id").notNull(),
    overallF: real("overall_f").notNull(),
    perEntityScores: jsonb("per_entity_scores"),
    numExamplePdfs: integer("num_example_pdfs"),
    numCorrectPdfs: integer("num_correct_pdfs"),
    numCorrectEntityTypes: integer("num_correct_entity_types"),
    pdfAccuracy: real("pdf_accuracy"),
    entityTypeMetrics: jsonb("entity_type_metrics"),
    incorrectlyPredictedEntityValueIds: bigint("incorrectly_predicted_entity_value_ids", { mode: "number" })
      .array()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("context_engineering_iterations_run_id_idx").on(t.contextEngRunId)],
)

export const promptExamples = workersSchema.table(
  "prompt_examples",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    // Cross-schema FK: prompt_id UUID REFERENCES core.prompts (id)
    promptId: uuid("prompt_id").notNull(),
    // Cross-schema FK: pdf_id UUID REFERENCES core.pdfs (id)
    pdfId: uuid("pdf_id").notNull(),
    entityTypeId: uuid("entity_type_id")
      .notNull()
      .references(() => entityTypes.id, { onDelete: "cascade" }),
    exampleIdx: integer("example_idx").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("prompt_examples_prompt_id_idx").on(t.promptId),
    index("prompt_examples_pdf_id_idx").on(t.pdfId),
    index("prompt_examples_entity_type_id_idx").on(t.entityTypeId),
  ],
)
