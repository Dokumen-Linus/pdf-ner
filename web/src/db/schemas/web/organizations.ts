import { text, timestamp } from "drizzle-orm/pg-core"

import { webSchema } from "./schema"

export const organizations = webSchema.table("organizations", {
  id: text("id").primaryKey(),
  plan: text("plan").notNull().default("base"),
  planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeSubscriptionStatus: text("stripe_subscription_status"),
  stripeCurrentPeriodStart: timestamp("stripe_current_period_start", { withTimezone: true }),
  stripeCurrentPeriodEnd: timestamp("stripe_current_period_end", { withTimezone: true }),
  description: text("description"),
  websiteUrl: text("website_url"),
  defaultColorPresets: text("default_color_presets").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})
