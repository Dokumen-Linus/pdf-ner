import { bigserial, text, timestamp } from "drizzle-orm/pg-core"
import { webSchema } from "./schema"

export const applications = webSchema.table("applications", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})
