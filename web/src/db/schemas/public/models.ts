import { numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const models = pgTable("models", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  usdPer1mInput: numeric("usd_per_1m_input", { precision: 10, scale: 4 }).notNull(),
  usdPer1mOutput: numeric("usd_per_1m_output", { precision: 10, scale: 4 }).notNull(),
  releaseDate: timestamp("release_date", { withTimezone: true }).notNull(),
  availableDate: timestamp("available_date", { withTimezone: true }).defaultNow(),
  endAvailableDate: timestamp("end_available_date", { withTimezone: true }),
})
