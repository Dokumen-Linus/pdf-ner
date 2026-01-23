import { relations } from "drizzle-orm"
import { boolean, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { projects } from "./projects"

export const entityTypes = pgTable("web.entity_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  page1Definition: text("page1_definition"),
  page1Examples: text("page1_examples").array(),
  page1Datatype: text("page1_datatype"),
  unique: boolean("unique").notNull().default(true),
  required: boolean("required").notNull().default(true),
  subtype: text("subtype"), // CHECK constraint handled in DB
  color: text("color"), // CHECK constraint handled in DB
  opacity: real("opacity"), // CHECK constraint handled in DB
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const entityTypesRelations = relations(entityTypes, ({ one }) => ({
  project: one(projects, {
    fields: [entityTypes.projectId],
    references: [projects.id],
  }),
}))
