import { relations } from "drizzle-orm"
import { text, timestamp, uuid } from "drizzle-orm/pg-core"

import { models } from "../public/models"

import { entityTypes } from "./entity-types"
import { webSchema } from "./schema"
import { webTeams } from "./teams"
import { users } from "./users"

export const projects = webSchema.table("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  teamId: text("team_id").references(() => webTeams.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  bucketId: uuid("bucket_id"),
  colorPresets: text("color_presets").array(),
  orientation: text("orientation").notNull().default("any"),
  ocrMethod: text("ocr_method").notNull().default("tesseract"),
  entityExtractionModel: text("entity_extraction_model")
    .notNull()
    .default("gpt-4o")
    .references(() => models.id),
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
