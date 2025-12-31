import { InferInsertModel, InferModel, InferSelectModel } from "drizzle-orm"
import * as schema from "./schema"

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

export type DbPdf = InferModel<typeof schema.pdfs>
export type FoundDbPdf = InferSelectModel<typeof schema.pdfs>
export type NewDbPdf = InferInsertModel<typeof schema.pdfs>
export type DbPdfUpdate = Partial<Omit<FoundDbPdf, "id" | "createdAt" | "updatedAt">>

export type DbAnnotation = InferModel<typeof schema.annotations>
export type FoundDbAnnotation = InferSelectModel<typeof schema.annotations>
export type NewDbAnnotation = InferInsertModel<typeof schema.annotations>
export type DbAnnotationUpdate = Partial<Omit<FoundDbAnnotation, "id" | "createdAt" | "updatedAt">>
