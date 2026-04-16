import { boolean, index, integer, numeric, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { projects } from "../web/projects"
import { users } from "../web/users"
import { workersSchema } from "./schema"

export const llmUsage = workersSchema.table(
  "llm_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    source: text("source").notNull(),
    taskName: text("task_name"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 8 }).notNull().default("0"),
    stripeReported: boolean("stripe_reported").notNull().default(false),
    stripeUsageEventId: text("stripe_usage_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("llm_usage_user_id_idx").on(t.userId),
    index("llm_usage_created_at_idx").on(t.createdAt),
  ],
)

export const stripeCustomers = workersSchema.table("stripe_customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeSubscriptionItemId: text("stripe_subscription_item_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
