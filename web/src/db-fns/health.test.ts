import { describe, expect, it, mock } from "bun:test"

type QueryResult = { rows: Array<{ exists: boolean }> }

mock.module("@/env.server", () => ({
  env: {
    WEB_DATABASE_URL: "postgres://unused",
  },
}))

const { checkWebDatabase } = await import("./health")

describe("checkWebDatabase", () => {
  it("marks missing tables as missing", async () => {
    const pool = {
      query: mock(async (_sql: string, params: string[]): Promise<QueryResult> => ({
        rows: [{ exists: params[0] !== "web.pdfs" }],
      })),
    }

    const checks = await checkWebDatabase(pool)
    expect(checks["table:web.pdfs"]).toBe("missing")
  })

  it("marks query failures as unready", async () => {
    const pool = {
      query: mock(async () => {
        throw new Error("boom")
      }),
    }

    const checks = await checkWebDatabase(pool)
    expect(checks["table:auth.user"]).toBe("unready")
    expect(checks["table:web.users"]).toBe("unready")
  })
})
