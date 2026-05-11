import { index, integer, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { workersSchema } from "./schema"

export const watchers = workersSchema.table(
  "watchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Cross-schema FK: pdf_source_id UUID REFERENCES core.sources (id)
    pdfSourceId: uuid("pdf_source_id").notNull(),
    pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(300),
    cursor: jsonb("cursor"),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    nextPollAt: timestamp("next_poll_at", { withTimezone: true }),
    failureCount: integer("failure_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("watchers_pdf_source_id_idx").on(t.pdfSourceId)],
)

export const watcherRuns = workersSchema.table(
  "watcher_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watcherId: uuid("watcher_id")
      .notNull()
      .references(() => watchers.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    cursorBefore: jsonb("cursor_before"),
    cursorAfter: jsonb("cursor_after"),
    discoveredCount: integer("discovered_count").notNull().default(0),
    enqueuedCount: integer("enqueued_count").notNull().default(0),
    errorType: text("error_type"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("watcher_runs_watcher_id_idx").on(t.watcherId)],
)
