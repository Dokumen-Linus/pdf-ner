import { relations } from "drizzle-orm"
import { bigint, boolean, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { projects } from "../web/projects"
import { users } from "../web/users"

import { coreSchema } from "./schema"

export const corePdfs = coreSchema.table("pdfs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  filepath: text("filepath").notNull(),
  hasLabels: boolean("has_labels").notNull().default(false),
  sourceType: text("source_type").notNull(),
  uploadedByUserId: text("uploaded_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  // Cross-schema FK references (no .references() to avoid circular deps):
  // ner_workflow_id UUID REFERENCES workers.ner_workflows (id)
  // listener_id UUID REFERENCES workers.listeners (id)
  // watcher_id UUID REFERENCES workers.watchers (id)
  // watcher_run_id UUID REFERENCES workers.watcher_runs (id)
  nerWorkflowId: uuid("ner_workflow_id"),
  listenerId: uuid("listener_id"),
  watcherId: uuid("watcher_id"),
  watcherRunId: bigint("watcher_run_id", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const corePdfsRelations = relations(corePdfs, ({ one }) => ({
  project: one(projects, {
    fields: [corePdfs.projectId],
    references: [projects.id],
  }),
}))
