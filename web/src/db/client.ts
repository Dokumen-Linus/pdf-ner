import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { env } from "../env.server"

import { pgPoolConfig } from "./pg-pool"
import * as schema from "./schemas"

const pool = new Pool(pgPoolConfig(env.WEB_DATABASE_URL))

export const db = drizzle(pool, { schema })
