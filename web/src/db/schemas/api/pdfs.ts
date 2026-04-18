import { boolean, text, uuid } from "drizzle-orm/pg-core"

import { apiSchema } from "./schema"

// api.pdfs is a thin extension of workers.pdfs (same id).
// It holds only the fields that the API layer adds after text extraction.
export const apiPdfs = apiSchema.table("pdfs", {
  id: uuid("id").primaryKey(),
  bookmarks: text("bookmarks").array(),
  originalHasText: boolean("original_has_text"),
})
