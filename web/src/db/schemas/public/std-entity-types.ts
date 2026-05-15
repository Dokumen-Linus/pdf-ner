import { bigserial, boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const stdEntityTypes = pgTable("std_entity_types", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  shortName: text("short_name").notNull(),
  longName: text("long_name").notNull(),
  category: text("category").notNull(),
  definition: text("definition").notNull(),
  examples: text("examples").array(),
  datatype: text("datatype"),
  regex: text("regex"),
  exactLength: integer("exact_length"),
  singleWord: boolean("single_word").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
