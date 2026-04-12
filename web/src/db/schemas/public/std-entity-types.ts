import { bigserial, boolean, integer, text, timestamp } from "drizzle-orm/pg-core"
import { publicSchema } from "./schema"

export const stdEntityTypes = publicSchema.table("std_entity_types", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  shortName: text("short_name").notNull(),
  longName: text("long_name"),
  definition: text("definition"),
  examples: text("examples").array(),
  formatDescription: text("format_description"),
  datatype: text("datatype"),
  regex: text("regex"),
  exactLength: integer("exact_length"),
  singleWord: boolean("single_word"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})
