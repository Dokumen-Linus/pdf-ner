import { describe, expect, it } from "bun:test"

import { pgPoolConfig } from "./pg-pool"

describe("pgPoolConfig", () => {
  it("uses libpq-compatible SSL for sslmode=require URLs", () => {
    const config = pgPoolConfig(
      "postgres://web_user:secret@example.com:5432/dokumen?sslmode=require",
    )

    expect(config.connectionString).toBe("postgres://web_user:secret@example.com:5432/dokumen")
    expect(config.ssl).toEqual({ rejectUnauthorized: false })
  })

  it("removes pg-connection-string compatibility flags after translating SSL", () => {
    const config = pgPoolConfig(
      "postgres://web_user:secret@example.com:5432/dokumen?uselibpqcompat=true&sslmode=require",
    )

    expect(config.connectionString).toBe("postgres://web_user:secret@example.com:5432/dokumen")
    expect(config.ssl).toEqual({ rejectUnauthorized: false })
  })

  it("disables SSL for sslmode=disable URLs", () => {
    const config = pgPoolConfig(
      "postgres://web_user:secret@example.com:5432/dokumen?sslmode=disable",
    )

    expect(config.connectionString).toBe("postgres://web_user:secret@example.com:5432/dokumen")
    expect(config.ssl).toBe(false)
  })

  it("leaves verify-full URLs for pg to validate", () => {
    const connectionString =
      "postgres://web_user:secret@example.com:5432/dokumen?sslmode=verify-full"

    expect(pgPoolConfig(connectionString)).toEqual({ connectionString })
  })
})
