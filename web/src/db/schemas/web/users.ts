import { relations, sql } from "drizzle-orm"
import { integer, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { projects } from "./projects"
import { webSchema } from "./schema"

export const users = webSchema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: text("auth_user_id"),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  employer: text("employer"),
  jobTitle: text("job_title"),
  avatarUrl: text("avatar_url"),
  organizationId: text("organization_id"),
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
