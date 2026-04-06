import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { env } from "../env.server"
import * as schema from "./schemas"

const pool = new Pool({
  connectionString: env.WEB_DATABASE_URL,
})

export const db = drizzle(pool, { schema })
