import { relations } from "drizzle-orm"
import { text, timestamp, uuid } from "drizzle-orm/pg-core"

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
  subscriptionType: text("subscription_type").notNull().default("developer"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeSubscriptionStatus: text("stripe_subscription_status"),
  stripeCurrentPeriodStart: timestamp("stripe_current_period_start", { withTimezone: true }),
  stripeCurrentPeriodEnd: timestamp("stripe_current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}))
