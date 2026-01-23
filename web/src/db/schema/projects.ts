import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { entityTypes } from "./entity_types"
import { pdfs } from "./pdfs"
import { users } from "./users"

export const projects = pgTable("web.projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
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
  pdfs: many(pdfs),
  entityTypes: many(entityTypes),
}))
