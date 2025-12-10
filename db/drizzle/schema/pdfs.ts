import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { annotations } from "./annotations"
import { projects } from "./projects"

export const pdfs = pgTable("pdfs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const pdfsRelations = relations(pdfs, ({ one, many }) => ({
  project: one(projects, {
    fields: [pdfs.projectId],
    references: [projects.id],
  }),
  annotations: many(annotations),
}))
