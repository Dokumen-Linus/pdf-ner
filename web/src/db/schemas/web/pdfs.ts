import { relations } from "drizzle-orm"
import { boolean, jsonb, timestamp, uuid } from "drizzle-orm/pg-core"
import type { LabeledEntitiesMap } from "../../types"
import { annotations } from "./annotations"
import { webSchema } from "./schema"
import { users } from "./users"

export const pdfs = webSchema.table("pdfs", {
  id: uuid("id").primaryKey(),
  labeledEntities: jsonb("labeled_entities").$type<LabeledEntitiesMap | null>(),
  // Fast-path flag: true iff web.annotations has >=1 row for this pdf.
  // Maintained by the labelling save path (saveAnnotationsByPdfId). Lets the
  // client skip the annotations fetch entirely for pdfs that have never been
  // labelled, which is the common case on fresh uploads.
  annotated: boolean("annotated").notNull().default(false),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }).defaultNow(),
  // Soft lock fields — managed by the labelling page via acquire/heartbeat/release.
  lockedBy: uuid("locked_by").references(() => users.id, { onDelete: "set null" }),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
})

export const pdfsRelations = relations(pdfs, ({ many, one }) => ({
  annotations: many(annotations),
  uploader: one(users, {
    fields: [pdfs.uploadedBy],
    references: [users.id],
  }),
  locker: one(users, {
    fields: [pdfs.lockedBy],
    references: [users.id],
  }),
}))
