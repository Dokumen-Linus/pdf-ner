import { index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { ocrMethods } from "../public/ocr-methods"

import { workersSchema } from "./schema"

import type { JsonbRecord } from "@/db/types"

export const pdfTxts = workersSchema.table(
  "pdf_txts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Cross-schema FK: pdf_id UUID REFERENCES core.pdfs (id)
    pdfId: uuid("pdf_id").notNull(),
    ocrMethod: text("ocr_method")
      .notNull()
      .references(() => ocrMethods.id, { onDelete: "cascade" }),
    createdByDomain: text("created_by_domain").notNull(),
    txt: text("txt").notNull(),
    textByPage: jsonb("text_by_page").$type<JsonbRecord | null>(),
    textByBookmarks: jsonb("text_by_bookmarks").$type<JsonbRecord | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("pdf_txts_pdf_id_idx").on(t.pdfId)],
)
