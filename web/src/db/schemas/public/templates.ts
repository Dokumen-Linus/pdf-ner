import { bigserial, boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const templates = pgTable("templates", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  txt: text("txt").notNull(),
  includesProjectDescription: boolean("includes_project_description").notNull(),
  includesEntityTypeDefinitions: boolean("includes_entity_type_definitions").notNull(),
  includesEntityTypeExampleValues: boolean("includes_entity_type_example_values").notNull(),
  includesEntityTypeExampleFinds: boolean("includes_entity_type_example_finds").notNull(),
  includesEntityTypeRegex: boolean("includes_entity_type_regex").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
