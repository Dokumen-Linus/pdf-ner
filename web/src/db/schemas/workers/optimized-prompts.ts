import {
  bigint,
  index,
  integer,
  jsonb,
  numeric,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

import { models } from "../public/models"
import { templates } from "../public/templates"
import { entityTypes } from "../web/entity-types"
import { projects } from "../web/projects"

import { workersPdfs } from "./pdfs"
import { workersSchema } from "./schema"

import type { JsonbRecord } from "../../types"

export const optimizedPrompts = workersSchema.table("optimized_prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  templateId: bigint("template_id", { mode: "number" })
    .notNull()
    .references(() => templates.id, { onDelete: "restrict" }),
  fullText: text("full_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const optimizedPromptExamples = workersSchema.table(
  "optimized_prompt_examples",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    optimizedPromptId: uuid("optimized_prompt_id")
      .notNull()
      .references(() => optimizedPrompts.id, { onDelete: "cascade" }),
    pdfId: uuid("pdf_id")
      .notNull()
      .references(() => workersPdfs.id, { onDelete: "cascade" }),
    exampleOrder: integer("example_order").notNull(),
    textExcerpt: text("text_excerpt").notNull(),
    labelledEntities: jsonb("labelled_entities").$type<JsonbRecord>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique("optimized_prompt_examples_optimized_prompt_id_pdf_id_key").on(
      t.optimizedPromptId,
      t.pdfId,
    ),
    unique("optimized_prompt_examples_optimized_prompt_id_example_order_key").on(
      t.optimizedPromptId,
      t.exampleOrder,
    ),
    index("optimized_prompt_examples_prompt_id_idx").on(t.optimizedPromptId),
    index("optimized_prompt_examples_pdf_id_idx").on(t.pdfId),
  ],
)

export const promptEvaluations = workersSchema.table("prompt_evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  promptId: uuid("prompt_id")
    .notNull()
    .references(() => optimizedPrompts.id, { onDelete: "cascade" }),
  overallF1: real("overall_f1").notNull(),
  perEntityScores: jsonb("per_entity_scores").$type<JsonbRecord>().notNull(),
  modelId: text("model_id").references(() => models.id),
  labeledPdfCount: integer("labeled_pdf_count"),
  evaluatedPdfCount: integer("evaluated_pdf_count"),
  skippedPdfCount: integer("skipped_pdf_count"),
  pdfsFullyCorrect: integer("pdfs_fully_correct"),
  pdfAccuracy: real("pdf_accuracy"),
  entityTypeMetrics: jsonb("entity_type_metrics").$type<JsonbRecord>(),
  llmCallCount: integer("llm_call_count"),
  costUsd: numeric("cost_usd", { precision: 12, scale: 8 }),
  iterationsRun: integer("iterations_run"),
  stopReason: text("stop_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const contextEngPreds = workersSchema.table(
  "context_eng_preds",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    promptEvaluationId: uuid("prompt_evaluation_id")
      .notNull()
      .references(() => promptEvaluations.id, { onDelete: "cascade" }),
    pdfId: uuid("pdf_id")
      .notNull()
      .references(() => workersPdfs.id, { onDelete: "cascade" }),
    entityTypeId: uuid("entity_type_id")
      .notNull()
      .references(() => entityTypes.id, { onDelete: "restrict" }),
    labelledValue: text("labelled_value"),
    predictedValue: text("predicted_value"),
  },
  (t) => [
    index("context_eng_preds_prompt_evaluation_id_idx").on(t.promptEvaluationId),
    index("context_eng_preds_pdf_id_idx").on(t.pdfId),
    index("context_eng_preds_entity_type_id_idx").on(t.entityTypeId),
  ],
)
