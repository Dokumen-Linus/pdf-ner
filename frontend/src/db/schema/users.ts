import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { projects } from "./projects"

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  employer: text("employer"),
  jobTitle: text("job_title"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}))
