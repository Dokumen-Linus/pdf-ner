import { index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { workersSchema } from "./schema"

export const listeners = workersSchema.table(
  "listeners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Cross-schema FK: pdf_source_id UUID REFERENCES core.sources (id)
    pdfSourceId: uuid("pdf_source_id").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("active"),
    providerSubscriptionId: text("provider_subscription_id"),
    callbackUrl: text("callback_url"),
    secretRef: text("secret_ref"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    renewAfter: timestamp("renew_after", { withTimezone: true }),
    providerPayload: jsonb("provider_payload").notNull().default("{}"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("listeners_pdf_source_id_idx").on(t.pdfSourceId)],
)
