import type { PoolConfig } from "pg"

export function pgPoolConfig(connectionString: string): PoolConfig {
  const url = new URL(connectionString)
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase()

  url.searchParams.delete("uselibpqcompat")

  if (sslMode === "disable") {
    url.searchParams.delete("sslmode")
    return { connectionString: url.toString(), ssl: false }
  }

  if (sslMode === "prefer" || sslMode === "require") {
    url.searchParams.delete("sslmode")
    return { connectionString: url.toString(), ssl: { rejectUnauthorized: false } }
  }

  return { connectionString }
}
