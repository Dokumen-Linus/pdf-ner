import { index, timestamp, uuid } from "drizzle-orm/pg-core"

import { projects } from "../web/projects"

import { contextEngineeringIterations } from "./context-engineering"
import { chatModelEvalIterations } from "./model-evals"
import { nerWorkflows } from "./ner-workflows"
import { pdfTxts } from "./pdf-txts"
import { workersSchema } from "./schema"

export const nerRuns = workersSchema.table(
  "ner_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Cross-schema FK: prompt_id UUID REFERENCES core.prompts (id)
    promptId: uuid("prompt_id").notNull(),
    nerWorkflowId: uuid("ner_workflow_id").references(() => nerWorkflows.id, {
      onDelete: "cascade",
    }),
    contextEngIterId: uuid("context_eng_iter_id").references(
      () => contextEngineeringIterations.id,
      { onDelete: "cascade" },
    ),
    modelEvalIterId: uuid("model_eval_iter_id").references(() => chatModelEvalIterations.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("ner_runs_project_id_idx").on(t.projectId),
    index("ner_runs_ner_workflow_id_idx").on(t.nerWorkflowId),
  ],
)

export const nerRunPdfs = workersSchema.table(
  "ner_run_pdfs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Cross-schema FK: pdf_id UUID REFERENCES core.pdfs (id)
    pdfId: uuid("pdf_id").notNull(),
    nerRunId: uuid("ner_run_id")
      .notNull()
      .references(() => nerRuns.id, { onDelete: "cascade" }),
    pdfTxtId: uuid("pdf_txt_id").references(() => pdfTxts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("ner_run_pdfs_pdf_id_idx").on(t.pdfId),
    index("ner_run_pdfs_ner_run_id_idx").on(t.nerRunId),
  ],
)
