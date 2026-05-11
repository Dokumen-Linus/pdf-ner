import { numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const chatModels = pgTable("chat_models", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  host: text("host").notNull(),
  usdPer1mInput: numeric("usd_per_1m_input", { precision: 8, scale: 4 }).notNull(),
  usdPer1mOutput: numeric("usd_per_1m_output", { precision: 8, scale: 4 }).notNull(),
  releaseDate: timestamp("release_date", { withTimezone: true }),
  availableDate: timestamp("available_date", { withTimezone: true }).defaultNow(),
  endAvailableDate: timestamp("end_available_date", { withTimezone: true }),
})
