import { jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { sourceProviders } from "../public/source-providers"

import { coreSchema } from "./schema"

export const sourceConnections = coreSchema.table("source_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider")
    .notNull()
    .references(() => sourceProviders.id, { onDelete: "cascade" }),
  config: jsonb("config"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const sources = coreSchema.table("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceConnectionId: uuid("source_connection_id")
    .notNull()
    .references(() => sourceConnections.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull(),
  externalVersion: text("external_version").notNull().default(""),
  uri: text("uri"),
  fingerprint: text("fingerprint"),
  name: text("name"),
  status: text("status").notNull().default("pending"),
  metadata: jsonb("metadata").notNull().default("{}"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow(),
  lastQueuedAt: timestamp("last_queued_at", { withTimezone: true }),
  lastProcessedAt: timestamp("last_processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
