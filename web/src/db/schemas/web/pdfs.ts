import { relations } from "drizzle-orm"
import { timestamp, uuid } from "drizzle-orm/pg-core"
import { annotations } from "./annotations"
import { webSchema } from "./schema"

export const pdfs = webSchema.table("pdfs", {
  id: uuid("id").primaryKey(),
  firstViewedAt: timestamp("first_viewed_at").defaultNow(),
})

export const pdfsRelations = relations(pdfs, ({ many }) => ({
  annotations: many(annotations),
}))
