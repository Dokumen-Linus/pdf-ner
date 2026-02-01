import { relations } from "drizzle-orm"
import { bigint, boolean, integer, real, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { projects } from "./projects"
import { webSchema } from "./schema"

export const entityTypes = webSchema.table("entity_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  standardEntityTypeId: bigint("standard_entity_type_id", { mode: "number" }),
  userDefinition: text("user_definition"),
  userExamples: text("user_examples").array(),
  userFormatDescription: text("user_format_description"),
  datatype: text("datatype"),
  singleWord: boolean("single_word"),
  exactLength: integer("exact_length"),
  unique: boolean("unique").notNull(),
  required: boolean("required").notNull(),
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
