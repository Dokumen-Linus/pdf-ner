import { relations } from "drizzle-orm"
import { bigint, boolean, integer, real, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { stdEntityTypes } from "../public/std-entity-types"

import { projects } from "./projects"
import { webSchema } from "./schema"

export const entityTypes = webSchema.table("entity_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  standardEntityTypeId: bigint("standard_entity_type_id", { mode: "number" }).references(
    () => stdEntityTypes.id,
    { onDelete: "set null" },
  ),
  userDefinition: text("user_definition"),
  userExampleValues: text("user_example_values").array(),
  userFormatDescription: text("user_format_description"),
  datatype: text("datatype"),
  regex: text("regex"),
  exactLength: integer("exact_length"),
  unique: boolean("unique").notNull(),
  required: boolean("required").notNull(),
  subtype: text("subtype").notNull().default("highlight"), // CHECK constraint handled in DB
  color: text("color").notNull(), // CHECK constraint handled in DB
  opacity: real("opacity").notNull().default(0.6), // CHECK constraint handled in DB
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const entityTypesRelations = relations(entityTypes, ({ one }) => ({
  project: one(projects, {
    fields: [entityTypes.projectId],
    references: [projects.id],
  }),
  stdEntityType: one(stdEntityTypes, {
    fields: [entityTypes.standardEntityTypeId],
    references: [stdEntityTypes.id],
  }),
}))
