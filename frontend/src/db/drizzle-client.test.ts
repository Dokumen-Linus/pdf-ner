import { describe, expect, test } from "bun:test"
import { sql } from "drizzle-orm"
import { db } from "./client"

// only run if TEST_DB is true
// despite this, the test errors instead of skipping when the db is off, so ignore this
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