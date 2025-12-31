import { relations } from "drizzle-orm"
import { integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { pdfs } from "./pdfs"

export const annotations = pgTable("annotations", {
  id: uuid("id").primaryKey().defaultRandom(), // created by consumer
  pdfId: uuid("pdf_id")
    .notNull()
    .references(() => pdfs.id, { onDelete: "cascade" }),
  subtype: text("subtype").notNull(), // CHECK constraint
  rect: jsonb("rect").notNull(),
  segmentRects: jsonb("segment_rects").notNull(),
  pageIndex: integer("page_index").notNull(),
  color: text("color"),
  opacity: real("opacity"),
  contents: text("contents"),
  customEntityType: text("custom_entity_type"),
  author: text("author"),
  created: timestamp("created"),
  modified: timestamp("modified"),
  blendMode: text("blend_mode"), // CHECK constraint
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const annotationsRelations = relations(annotations, ({ one }) => ({
  pdf: one(pdfs, {
    fields: [annotations.pdfId],
    references: [pdfs.id],
  }),
}))
