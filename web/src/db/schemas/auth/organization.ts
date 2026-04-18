import { boolean, text, timestamp } from "drizzle-orm/pg-core"

import { authSchema } from "./schema"

export const authUsers = authSchema.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  image: text("image"),
  emailVerified: boolean("emailVerified").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
})

export const authOrganizations = authSchema.table("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  logo: text("logo"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  metadata: text("metadata"),
})

export const authTeams = authSchema.table("team", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => authOrganizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }),
})

export const authMembers = authSchema.table("member", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => authOrganizations.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
})

export const authTeamMembers = authSchema.table("teamMember", {
  id: text("id").primaryKey(),
  teamId: text("teamId")
    .notNull()
    .references(() => authTeams.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt", { withTimezone: true }),
})
