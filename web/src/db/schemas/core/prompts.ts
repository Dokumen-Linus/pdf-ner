import { relations } from "drizzle-orm"
import { bigint, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { templates } from "../public/templates"
import { projects } from "../web/projects"

import { coreSchema } from "./schema"

import type { JsonbRecord } from "../../types"

export const prompts = coreSchema.table("prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  templateId: bigint("template_id", { mode: "number" })
    .notNull()
    .references(() => templates.id, { onDelete: "set null" }),
  projectDescription: text("project_description"),
  entityTypesOrder: uuid("entity_types_order").array(),
  entityTypeDefinitions: jsonb("entity_type_definitions").$type<JsonbRecord | null>(),
  entityTypeExampleValues: jsonb("entity_type_example_values").$type<JsonbRecord | null>(),
  entityTypeExampleFinds: jsonb("entity_type_example_finds").$type<JsonbRecord | null>(),
  fullText: text("full_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const promptsRelations = relations(prompts, ({ one }) => ({
  project: one(projects, {
    fields: [prompts.projectId],
    references: [projects.id],
  }),
  template: one(templates, {
    fields: [prompts.templateId],
    references: [templates.id],
  }),
}))
