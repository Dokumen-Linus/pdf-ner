import { text, timestamp, uuid } from "drizzle-orm/pg-core"

import { organizations } from "../web/organizations"
import { users } from "../web/users"

import { apiSchema } from "./schema"

export const awsBuckets = apiSchema.table("aws_buckets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  ownerOrgId: text("owner_org_id").references(() => organizations.id, { onDelete: "set null" }),
  name: text("name").notNull().unique(),
  region: text("region").notNull().default("us-east-1"),
  endpointUrl: text("endpoint_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
