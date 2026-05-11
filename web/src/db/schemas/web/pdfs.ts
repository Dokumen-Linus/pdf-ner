import { relations } from "drizzle-orm"
import { text, timestamp, uuid } from "drizzle-orm/pg-core"

import { annotations } from "./annotations"
import { webSchema } from "./schema"
import { users } from "./users"

export const pdfs = webSchema.table("pdfs", {
  // FK to core.pdfs — web.pdfs is a child row
  id: uuid("id").primaryKey(),
  // Soft lock fields — managed by the labeling page via acquire/heartbeat/release.
  lockedBy: text("locked_by").references(() => users.id, { onDelete: "set null" }),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const pdfsRelations = relations(pdfs, ({ many, one }) => ({
  annotations: many(annotations),
  locker: one(users, {
    fields: [pdfs.lockedBy],
    references: [users.id],
  }),
}))
