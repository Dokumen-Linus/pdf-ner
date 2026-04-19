import { text, timestamp } from "drizzle-orm/pg-core"

import { webSchema } from "./schema"

export const webTeams = webSchema.table("teams", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})
