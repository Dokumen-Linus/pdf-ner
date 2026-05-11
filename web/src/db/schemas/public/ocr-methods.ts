import { numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const ocrMethods = pgTable("ocr_methods", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  methodType: text("method_type").notNull(),
  usdPer1mPages: numeric("usd_per_1m_pages", { precision: 8, scale: 2 }),
  usdPerSec: numeric("usd_per_sec", { precision: 8, scale: 6 }),
  releaseDate: timestamp("release_date", { withTimezone: true }),
  availableDate: timestamp("available_date", { withTimezone: true }).defaultNow(),
  endAvailableDate: timestamp("end_available_date", { withTimezone: true }),
})
