import { index , integer, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"


import { authUsers } from "../auth"

import { organizations } from "./organizations"
import { projects } from "./projects"
import { webSchema } from "./schema"
import { users } from "./users"

import type { JsonbRecord } from "../../types"

export const monitoringEvents = webSchema.table(
  "monitoring_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventName: text("event_name").notNull(),
    eventKind: text("event_kind").notNull(),
    operationType: text("operation_type").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull(),
    severity: text("severity").notNull(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorAuthUserId: text("actor_auth_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    requestId: text("request_id"),
    traceId: text("trace_id"),
    routeOrPath: text("route_or_path"),
    method: text("method"),
    durationMs: integer("duration_ms"),
    metadata: jsonb("metadata").$type<JsonbRecord>().notNull().default({}),
    errorType: text("error_type"),
    errorMessage: text("error_message"),
    errorStack: text("error_stack"),
    rawErrorPayload: jsonb("raw_error_payload").$type<JsonbRecord>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("monitoring_events_created_at_idx").on(t.createdAt),
    index("monitoring_events_event_name_idx").on(t.eventName),
    index("monitoring_events_status_idx").on(t.status),
    index("monitoring_events_actor_user_id_idx").on(t.actorUserId),
    index("monitoring_events_project_id_idx").on(t.projectId),
    index("monitoring_events_request_id_idx").on(t.requestId),
  ],
)
