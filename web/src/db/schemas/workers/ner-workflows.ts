import { timestamp, uuid } from "drizzle-orm/pg-core"

import { projects } from "../web/projects"

import { listeners } from "./listeners"
import { workersSchema } from "./schema"
import { watchers } from "./watchers"

export const nerWorkflows = workersSchema.table("ner_workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  watcherId: uuid("watcher_id").references(() => watchers.id, { onDelete: "set null" }),
  listenerId: uuid("listener_id").references(() => listeners.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
