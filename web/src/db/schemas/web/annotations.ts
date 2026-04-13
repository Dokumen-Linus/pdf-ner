import { relations } from "drizzle-orm"
import { integer, jsonb, real, text, timestamp, uuid } from "drizzle-orm/pg-core"
import type { StoredRect } from "../../types"
import { pdfs } from "./pdfs"
import { webSchema } from "./schema"

export const annotations = webSchema.table("annotations", {
  id: uuid("id").primaryKey(), // set in web app PDFContainer
  pdfId: uuid("pdf_id")
    .notNull()
    .references(() => pdfs.id, { onDelete: "cascade" }),
  subtype: text("subtype").notNull(), // CHECK constraint
  rect: jsonb("rect").$type<StoredRect>().notNull(),
  segmentRects: jsonb("segment_rects").$type<StoredRect[]>().notNull(),
  pageIndex: integer("page_index").notNull(),
  color: text("color"),
  opacity: real("opacity"),
  contents: text("contents"),
  customEntityType: text("custom_entity_type"),
  author: text("author"),
  created: timestamp("created"), // set in web app PDFContainer
  modified: timestamp("modified"), // set in web app PDFContainer
  blendMode: text("blend_mode"), // CHECK constraint
})

export const annotationsRelations = relations(annotations, ({ one }) => ({
  pdf: one(pdfs, {
    fields: [annotations.pdfId],
    references: [pdfs.id],
  }),
}))
