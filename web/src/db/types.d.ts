import { InferInsertModel, InferModel, InferSelectModel } from "drizzle-orm"

import * as schema from "./schemas"
import {
  billingChargeAttempts,
  contextEngPreds,
  llmUsage,
  optimizedPrompts,
  promptEvaluations,
  workersPdfs,
} from "./schemas/workers"

// ─────────────────────────────────────────────────────────
// JSONB column types
// ─────────────────────────────────────────────────────────
//
// JSONB columns default to `unknown` under Drizzle's type inference, which
// breaks TanStack Start's createServerFn return-type constraint (it rejects
// `unknown` as not-JSON-serializable-enough). Every JSONB column should opt
// into a concrete shape here via `.$type<T>()`.
//
// `JsonbValue` is the recursive-JSON fallback — use for columns whose
// runtime shape is set by an external writer (the Python workers service)
// and so isn't owned by this codebase.

export type JsonbValue =
  | string
  | number
  | boolean
  | null
  | JsonbValue[]
  | { [key: string]: JsonbValue }

export type JsonbRecord = { [key: string]: JsonbValue }
export type JsonbArray = JsonbValue[]

// web.annotations.rect / .segment_rects — PDF page coordinates as persisted
// in JSONB. This is the *storage* shape, not the runtime shape the EmbedPDF
// plugin operates on (that's `Rect` from @embedpdf/models, where both
// `origin` and `size` are required).
//
// Kept as a union of nested and flat forms because historical rows were
// written in both — all keys optional so either serialization round-trips
// without a migration. Normalize to the library `Rect` at the read
// boundary via `toEmbedRect` in `./rect`.
export interface StoredRect {
  origin?: { x: number; y: number }
  size?: { width: number; height: number }
  x?: number
  y?: number
  width?: number
  height?: number
}

// web.pdfs.labeled_entities — entity-type name → labeled strings, written by
// the labelling save path.
export type LabeledEntitiesMap = { [entityTypeName: string]: string[] }

// ─────────────────────────────────────────────────────────
// Drizzle row types
// ─────────────────────────────────────────────────────────

// web - CRUD
export type User = InferModel<typeof schema.users>
export type FoundUser = InferSelectModel<typeof schema.users>
export type NewUser = InferInsertModel<typeof schema.users>
export type UserUpdate = Partial<Omit<FoundUser, "id" | "createdAt" | "updatedAt">>

export type Project = InferModel<typeof schema.projects>
export type FoundProject = InferSelectModel<typeof schema.projects>
export type NewProject = InferInsertModel<typeof schema.projects>
export type ProjectUpdate = Partial<Omit<FoundProject, "id" | "createdAt" | "updatedAt">>

export type DbEntityType = InferModel<typeof schema.entityTypes>
export type FoundDbEntityType = InferSelectModel<typeof schema.entityTypes>
export type NewDbEntityType = InferInsertModel<typeof schema.entityTypes>
export type DbEntityTypeUpdate = Partial<Omit<FoundDbEntityType, "id" | "createdAt" | "updatedAt">>

export type DbWebPdf = InferModel<typeof schema.pdfs>
export type FoundDbWebPdf = InferSelectModel<typeof schema.pdfs>
export type NewDbWebPdf = InferInsertModel<typeof schema.pdfs>
export type DbWebPdfUpdate = Partial<Omit<FoundDbWebPdf, "id">>

export type DbAnnotation = InferModel<typeof schema.annotations>
export type FoundDbAnnotation = InferSelectModel<typeof schema.annotations>
export type NewDbAnnotation = InferInsertModel<typeof schema.annotations>
export type DbAnnotationUpdate = Partial<Omit<FoundDbAnnotation, "id" | "createdAt" | "updatedAt">>

// public - read only
export type FoundStandardEntityType = InferSelectModel<typeof schema.stdEntityTypes>
export type FoundTemplate = InferSelectModel<typeof schema.templates>
export type FoundModel = InferSelectModel<typeof schema.models>

// api - read only
export type FoundPrompt = InferSelectModel<typeof schema.prompts>
export type FoundDbApiPdf = InferSelectModel<typeof schema.apiPdfs>

// workers - read only
export type LlmUsage = InferSelectModel<typeof llmUsage>
export type BillingChargeAttempt = InferSelectModel<typeof billingChargeAttempts>
export type FoundWorkersPdf = InferSelectModel<typeof workersPdfs>
export type FoundOptimizedPrompt = InferSelectModel<typeof optimizedPrompts>
export type FoundPromptEvaluation = InferSelectModel<typeof promptEvaluations>
export type FoundContextEngPred = InferSelectModel<typeof contextEngPreds>
