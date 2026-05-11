import { relations } from "drizzle-orm"
import { boolean, integer, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { entityTypes } from "../web/entity-types"

import { corePdfs } from "./pdfs"
import { coreSchema } from "./schema"

import type { StoredRect } from "../../types"

export const entityValues = coreSchema.table("entity_values", {
  id: uuid("id").primaryKey().defaultRandom(),
  pdfId: uuid("pdf_id")
    .notNull()
    .references(() => corePdfs.id, { onDelete: "cascade" }),
  entityTypeId: uuid("entity_type_id")
    .notNull()
    .references(() => entityTypes.id, { onDelete: "cascade" }),
  textValue: text("text_value").notNull(),
  isLabel: boolean("is_label").notNull(),
  // Cross-schema FK: ner_run_id UUID REFERENCES workers.ner_runs (id)
  nerRunId: uuid("ner_run_id"),
  rect: jsonb("rect").$type<StoredRect | null>(),
  segmentRects: jsonb("segment_rects").$type<StoredRect[] | null>(),
  pageIndex: integer("page_index"),
  contents: text("contents"),
  author: text("author"),
  blendMode: text("blend_mode"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const entityValuesRelations = relations(entityValues, ({ one }) => ({
  pdf: one(corePdfs, {
    fields: [entityValues.pdfId],
    references: [corePdfs.id],
  }),
  entityType: one(entityTypes, {
    fields: [entityValues.entityTypeId],
    references: [entityTypes.id],
  }),
}))
