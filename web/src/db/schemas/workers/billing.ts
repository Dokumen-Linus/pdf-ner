import { bigint, index, integer, numeric, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { models } from "../public/models"
import { organizations } from "../web/organizations"
import { projects } from "../web/projects"
import { users } from "../web/users"

import { workersSchema } from "./schema"

export const llmUsageReportBatches = workersSchema.table(
  "llm_usage_report_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingUserId: uuid("billing_user_id").references(() => users.id),
    billingOrganizationId: text("billing_organization_id").references(() => organizations.id),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    usageCount: integer("usage_count").notNull().default(0),
    inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
    outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 8 }).notNull().default("0"),
    stripeMeterEventIdentifier: text("stripe_meter_event_identifier"),
    status: text("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reportedAt: timestamp("reported_at", { withTimezone: true }),
  },
  (t) => [index("llm_usage_report_batches_status_idx").on(t.status)],
)

export const llmUsage = workersSchema.table(
  "llm_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    billingUserId: uuid("billing_user_id").references(() => users.id),
    billingOrganizationId: text("billing_organization_id").references(() => organizations.id),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id),
    source: text("source").notNull(),
    taskName: text("task_name"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    inputCostUsd: numeric("input_cost_usd", { precision: 12, scale: 8 }).notNull().default("0"),
    outputCostUsd: numeric("output_cost_usd", { precision: 12, scale: 8 }).notNull().default("0"),
    costUsd: numeric("cost_usd", { precision: 12, scale: 8 }).notNull().default("0"),
    reportBatchId: uuid("report_batch_id").references(() => llmUsageReportBatches.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("llm_usage_project_id_idx").on(t.projectId),
    index("llm_usage_actor_user_id_idx").on(t.actorUserId),
    index("llm_usage_billing_user_id_idx").on(t.billingUserId),
    index("llm_usage_billing_organization_id_idx").on(t.billingOrganizationId),
    index("llm_usage_created_at_idx").on(t.createdAt),
  ],
)
