import { relations } from "drizzle-orm"
import { text, timestamp, uuid } from "drizzle-orm/pg-core"
import { entityTypes } from "./entity-types"
import { webSchema } from "./schema"
import { users } from "./users"

export const projects = webSchema.table("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teamId: text("team_id"),
  name: text("name").notNull(),
  description: text("description"),
  bucketId: uuid("bucket_id"),
  colorPresets: text("color_presets").array(),
  orientation: text("orientation").notNull().default("any"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  entityTypes: many(entityTypes),
}))
