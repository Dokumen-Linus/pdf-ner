import { bigserial, index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { extractMethods } from "../public/extract-methods"

import { workersSchema } from "./schema"

import type { JsonbRecord } from "@/db/types"

export const pdfTxts = workersSchema.table(
  "pdf_txts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    // Cross-schema FK: pdf_id UUID REFERENCES core.pdfs (id)
    pdfId: uuid("pdf_id").notNull(),
    extractMethod: text("extract_method")
      .notNull()
      .references(() => extractMethods.id, { onDelete: "cascade" }),
    createdByDomain: text("created_by_domain").notNull(),
    txt: text("txt").notNull(),
    textByPage: jsonb("text_by_page").$type<JsonbRecord | null>(),
    textByBookmarks: jsonb("text_by_bookmarks").$type<JsonbRecord | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("pdf_txts_pdf_id_idx").on(t.pdfId)],
)
