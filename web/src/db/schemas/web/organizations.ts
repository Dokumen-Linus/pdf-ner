import { sql } from "drizzle-orm"
import { integer, text, timestamp } from "drizzle-orm/pg-core"

import { webSchema } from "./schema"

export const organizations = webSchema.table("organizations", {
  id: text("id").primaryKey(),
  billingStartedAt: timestamp("billing_started_at", { withTimezone: true }).defaultNow(),
  nextPaymentAt: timestamp("next_payment_at", { withTimezone: true }).default(
    sql`NOW() + INTERVAL '1 month'`,
  ),
  lastPaymentAt: timestamp("last_payment_at", { withTimezone: true }),
  billingStatus: text("billing_status").notNull().default("stripe_info_missing"),
  billingFailureCount: integer("billing_failure_count").notNull().default(0),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  description: text("description"),
  defaultColorPresets: text("default_color_presets").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})
