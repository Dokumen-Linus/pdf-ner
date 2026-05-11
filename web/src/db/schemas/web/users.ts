import { relations, sql } from "drizzle-orm"
import { integer, text, timestamp } from "drizzle-orm/pg-core"

import { projects } from "./projects"
import { webSchema } from "./schema"

export const users = webSchema.table("users", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  displayName: text("display_name"),
  employer: text("employer"),
  jobTitle: text("job_title"),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("individual"),
  billingStartedAt: timestamp("billing_started_at", { withTimezone: true }).defaultNow(),
  nextPaymentAt: timestamp("next_payment_at", { withTimezone: true }).default(
    sql`NOW() + INTERVAL '1 month'`,
  ),
  lastPaymentAt: timestamp("last_payment_at", { withTimezone: true }),
  billingStatus: text("billing_status").notNull().default("stripe_info_missing"),
  billingFailureCount: integer("billing_failure_count").notNull().default(0),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}))
