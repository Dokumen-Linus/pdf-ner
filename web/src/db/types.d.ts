import { InferInsertModel, InferSelectModel } from "drizzle-orm"

import * as schema from "./schemas"

// ─────────────────────────────────────────────────────────
// JSONB column types
// ─────────────────────────────────────────────────────────

export type JsonbValue =
  | string
  | number
  | boolean
  | null
  | JsonbValue[]
  | { [key: string]: JsonbValue }

export type JsonbRecord = { [key: string]: JsonbValue }
export type JsonbArray = JsonbValue[]

export interface StoredRect {
  origin?: { x: number; y: number }
  size?: { width: number; height: number }
  x?: number
  y?: number
  width?: number
  height?: number
}

// ─────────────────────────────────────────────────────────
// Drizzle row types
// ─────────────────────────────────────────────────────────

// web - CRUD
export type User = InferSelectModel<typeof schema.users>
export type NewUser = InferInsertModel<typeof schema.users>
export type UserUpdate = Partial<Omit<User, "id" | "createdAt" | "updatedAt">>

export type Application = InferSelectModel<typeof schema.applications>
export type NewApplication = InferInsertModel<typeof schema.applications>
export type ApplicationUpdate = Partial<Omit<Application, "id" | "createdAt">>

export type Project = InferSelectModel<typeof schema.projects>
export type NewProject = InferInsertModel<typeof schema.projects>
export type ProjectUpdate = Partial<Omit<Project, "id" | "createdAt" | "updatedAt">>

export type DbEntityType = InferSelectModel<typeof schema.entityTypes>
export type NewDbEntityType = InferInsertModel<typeof schema.entityTypes>
export type DbEntityTypeUpdate = Partial<Omit<DbEntityType, "id" | "createdAt" | "updatedAt">>

export type DbWebPdf = InferSelectModel<typeof schema.pdfs>
export type NewDbWebPdf = InferInsertModel<typeof schema.pdfs>
export type DbWebPdfUpdate = Partial<Omit<DbWebPdf, "id">>

export type DbAnnotation = InferSelectModel<typeof schema.annotations>
export type NewDbAnnotation = InferInsertModel<typeof schema.annotations>
export type DbAnnotationUpdate = Partial<Omit<DbAnnotation, "id" | "createdAt" | "updatedAt">>

export type MonitoringEvent = InferSelectModel<typeof schema.monitoringEvents>
export type NewMonitoringEvent = InferInsertModel<typeof schema.monitoringEvents>

// public - read only
export type StdEntityType = InferSelectModel<typeof schema.stdEntityTypes>
export type Template = InferSelectModel<typeof schema.templates>
export type ChatModel = InferSelectModel<typeof schema.chatModels>
export type ExtractMethod = InferSelectModel<typeof schema.extractMethods>

// core - read only (written by workers/api)
export type CorePdf = InferSelectModel<typeof schema.corePdfs>
export type Prompt = InferSelectModel<typeof schema.prompts>
export type EntityValue = InferSelectModel<typeof schema.entityValues>

// api - read only
export type AwsBucket = InferSelectModel<typeof schema.awsBuckets>

// Convenience alias used by labeling page
export type LabeledEntitiesMap = Record<string, string[]>

// workers - read only
export type PdfTxt = InferSelectModel<typeof schema.pdfTxts>
export type Watcher = InferSelectModel<typeof schema.watchers>
export type WatcherRun = InferSelectModel<typeof schema.watcherRuns>
export type Listener = InferSelectModel<typeof schema.listeners>
export type NerWorkflow = InferSelectModel<typeof schema.nerWorkflows>
export type ContextEngineeringRun = InferSelectModel<typeof schema.contextEngineeringRuns>
export type ContextEngineeringIteration = InferSelectModel<
  typeof schema.contextEngineeringIterations
>
export type PromptExample = InferSelectModel<typeof schema.promptExamples>
export type ChatModelEvalRun = InferSelectModel<typeof schema.chatModelEvalRuns>
export type ChatModelEvalIteration = InferSelectModel<typeof schema.chatModelEvalIterations>
export type NerRun = InferSelectModel<typeof schema.nerRuns>
export type NerRunPdf = InferSelectModel<typeof schema.nerRunPdfs>
export type OcrEvaluationRun = InferSelectModel<typeof schema.ocrEvaluationRuns>
export type OcrEvaluationPage = InferSelectModel<typeof schema.ocrEvaluationPages>
export type OcrEvaluationPdfTxt = InferSelectModel<typeof schema.ocrEvaluationPdfTxts>
export type LlmUsage = InferSelectModel<typeof schema.llmUsage>
export type BillingChargeAttempt = InferSelectModel<typeof schema.billingChargeAttempts>
