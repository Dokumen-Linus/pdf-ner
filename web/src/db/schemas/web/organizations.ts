import { text, timestamp } from "drizzle-orm/pg-core"

import { webSchema } from "./schema"

export const organizations = webSchema.table("organizations", {
  id: text("id").primaryKey(),
  plan: text("plan").notNull().default("base"),
  planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
  description: text("description"),
  websiteUrl: text("website_url"),
  defaultColorPresets: text("default_color_presets").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})
