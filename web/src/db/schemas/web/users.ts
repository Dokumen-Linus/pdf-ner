import { relations } from "drizzle-orm"
import { text, timestamp, uuid } from "drizzle-orm/pg-core"
import { projects } from "./projects"
import { webSchema } from "./schema"

export const users = webSchema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  employer: text("employer"),
  jobTitle: text("job_title"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}))
