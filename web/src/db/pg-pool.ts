import type { PoolConfig } from "pg"

export function pgPoolConfig(connectionString: string): PoolConfig {
  const url = new URL(connectionString)
  const sslMode = url.searchParams.get("sslmode")

  if (sslMode === "disable") {
    return { connectionString, ssl: false }
  }

  if (sslMode === "prefer" || sslMode === "require") {
    return { connectionString, ssl: { rejectUnauthorized: false } }
  }

  return { connectionString }
}
