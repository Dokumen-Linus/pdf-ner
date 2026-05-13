import { bigserial, index, integer, numeric, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { projects } from "../web/projects"
import { users } from "../web/users"

import { workersSchema } from "./schema"

export const llmUsage = workersSchema.table(
  "llm_usage",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    modelId: text("model_id").notNull(),
    source: text("source").notNull(),
    taskName: text("task_name"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    inputCostUsd: numeric("input_cost_usd", { precision: 12, scale: 8 }).notNull().default("0"),
    outputCostUsd: numeric("output_cost_usd", { precision: 12, scale: 8 }).notNull().default("0"),
    costUsd: numeric("cost_usd", { precision: 12, scale: 8 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("llm_usage_project_id_idx").on(t.projectId),
    index("llm_usage_actor_user_id_idx").on(t.actorUserId),
    index("llm_usage_created_at_idx").on(t.createdAt),
  ],
)

export const billingChargeAttempts = workersSchema.table(
  "billing_charge_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    accountType: text("account_type").notNull(),
    userId: text("user_id").references(() => users.id),
    organizationId: text("organization_id"),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    baseAmountCents: integer("base_amount_cents").notNull().default(0),
    usageAmountCents: integer("usage_amount_cents").notNull().default(0),
    totalAmountCents: integer("total_amount_cents").notNull().default(0),
    usageCostUsd: numeric("usage_cost_usd", { precision: 12, scale: 8 }).notNull().default("0"),
    llmUsageCount: integer("llm_usage_count").notNull().default(0),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripePaymentMethodId: text("stripe_payment_method_id").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: text("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    retryAfter: timestamp("retry_after", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    chargedAt: timestamp("charged_at", { withTimezone: true }),
  },
  (t) => [
    index("billing_charge_attempts_user_id_idx").on(t.userId),
    index("billing_charge_attempts_organization_id_idx").on(t.organizationId),
    index("billing_charge_attempts_status_idx").on(t.status),
  ],
)
