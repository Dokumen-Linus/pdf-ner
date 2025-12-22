import { describe, expect, test } from "bun:test"
import { sql } from "drizzle-orm"
import { db } from "./client"

// only run if TEST_DB is true
describe.if(process.env.TEST_DB === "true")("Test Drizzle Client", () => {
  test("DB connection test", async () => {
    const result = await db.execute(sql`SELECT NOW()`)
    expect(result.rows.length).toBeGreaterThan(0)
  })

  test("DB schema query test", async () => {
    const users = await db.query.users.findMany({ limit: 1 })
    expect(Array.isArray(users)).toBe(true)
  })
})

// if TEST_DB is false, show this message once (not in other db test files)
describe.if(process.env.TEST_DB !== "true")("Test Database Functions", () => {
  test.skip("DB tests skipped because TEST_DB is not true", () => {})
})
