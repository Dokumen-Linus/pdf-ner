import { index, integer, jsonb, numeric, real, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { projects } from "../web/projects"

import { workersSchema } from "./schema"

export const ocrEvaluationRuns = workersSchema.table(
  "ocr_evaluation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    judgeModel: text("judge_model").notNull(),
    maxPdfs: integer("max_pdfs").notNull(),
    maxPagesPerPdf: integer("max_pages_per_pdf").notNull(),
    sampledPdfCount: integer("sampled_pdf_count").notNull().default(0),
    sampledPageCount: integer("sampled_page_count").notNull().default(0),
    recommendation: text("recommendation"),
    confidence: real("confidence"),
    summary: jsonb("summary"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 8 }).notNull().default("0"),
    errorType: text("error_type"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("ocr_evaluation_runs_project_started_idx").on(t.projectId, t.startedAt),
  ],
)

export const ocrEvaluationPages = workersSchema.table(
  "ocr_evaluation_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => ocrEvaluationRuns.id, { onDelete: "cascade" }),
    // Cross-schema FK: pdf_id UUID REFERENCES core.pdfs (id)
    pdfId: uuid("pdf_id").notNull(),
    pageIndex: integer("page_index").notNull(),
    pdfiumExcerpt: text("pdfium_excerpt"),
    tesseractExcerpt: text("tesseract_excerpt"),
    olmExcerpt: text("olm_excerpt"),
    deterministicMetrics: jsonb("deterministic_metrics").notNull().default("{}"),
    judgeResult: jsonb("judge_result"),
    recommendedMethod: text("recommended_method"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ocr_evaluation_pages_run_idx").on(t.runId, t.pdfId, t.pageIndex)],
)
