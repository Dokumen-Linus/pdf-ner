import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const sourceProviders = pgTable("source_providers", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  providerType: text("provider_type").notNull(),
  vendor: text("vendor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
