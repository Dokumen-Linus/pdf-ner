import { InferInsertModel, InferModel, InferSelectModel } from "drizzle-orm"
import * as schema from "./schemas"
import {
  llmUsage,
  optimizedPrompts,
  promptEvaluations,
  stripeCustomers,
  workersPdfs,
} from "./schemas/workers"

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
export type StripeCustomer = InferSelectModel<typeof stripeCustomers>
export type FoundWorkersPdf = InferSelectModel<typeof workersPdfs>
export type FoundOptimizedPrompt = InferSelectModel<typeof optimizedPrompts>
export type FoundPromptEvaluation = InferSelectModel<typeof promptEvaluations>
