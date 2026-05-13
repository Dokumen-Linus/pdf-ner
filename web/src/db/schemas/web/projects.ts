import { relations } from "drizzle-orm"
import { text, timestamp, uuid } from "drizzle-orm/pg-core"

import { chatModels } from "../public/chat-models"
import { extractMethods } from "../public/extract-methods"

import { entityTypes } from "./entity-types"
import { webSchema } from "./schema"
import { webTeams } from "./teams"
import { users } from "./users"

export const projects = webSchema.table("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  ownerTeamId: text("owner_team_id").references(() => webTeams.id, { onDelete: "set null" }),
  bucketId: uuid("bucket_id"),
  name: text("name").notNull(),
  description: text("description"),
  colorPresets: text("color_presets").array(),
  orientation: text("orientation").notNull().default("any"),
  activeExtractMethod: text("active_extract_method")
    .notNull()
    .default("olm-ocr2")
    .references(() => extractMethods.id, { onDelete: "set default" }),
  activeChatModel: text("active_chat_model")
    .notNull()
    .default("gpt-5.4-mini")
    .references(() => chatModels.id, { onDelete: "set default" }),
  // Cross-schema FK: active_prompt_id UUID REFERENCES core.prompts (id)
  activePromptId: uuid("active_prompt_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerUserId],
    references: [users.id],
  }),
  entityTypes: many(entityTypes),
}))
