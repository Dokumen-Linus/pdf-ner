import { bigserial, boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const templates = pgTable("templates", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  txt: text("txt").notNull(),
  inserts: text("inserts").array().notNull(),
  documentAtEnd: boolean("document_at_end").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})
