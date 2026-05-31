import { Pool } from "pg"

import { pgPoolConfig } from "@/db/pg-pool"
import { env } from "@/env.server"

const WEB_TABLES = "auth.user core.pdfs web.users web.projects web.pdfs workers.pdf_txts".split(" ")

let healthPool: Pool | null = null

type HealthPool = {
  query(text: string, values: unknown[]): Promise<{ rows: Array<{ exists?: boolean }> }>
}

function getHealthPool(): Pool {
  healthPool ??= new Pool(pgPoolConfig(env.WEB_DATABASE_URL))
  return healthPool
}

export async function checkWebDatabase(
  pool: HealthPool = getHealthPool(),
): Promise<Record<string, string>> {
  const checks = Object.fromEntries(WEB_TABLES.map((table) => [`table:${table}`, "unknown"]))

  try {
    for (const table of WEB_TABLES) {
      const result = await pool.query("SELECT to_regclass($1) IS NOT NULL AS exists", [table])
      checks[`table:${table}`] = result.rows[0]?.exists ? "ready" : "missing"
    }
  } catch {
    for (const table of WEB_TABLES) {
      checks[`table:${table}`] = "unready"
    }
  }

  return checks
}
