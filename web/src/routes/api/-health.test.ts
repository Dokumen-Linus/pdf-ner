import { beforeEach, describe, expect, it, mock } from "bun:test"

import { setApiError, setApiSuccess } from "~/tests/bun-test-setup/mocks"

mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
}))

const dbChecks: Record<string, string> = {
  "table:auth.user": "ready",
  "table:web.users": "ready",
  "table:web.projects": "ready",
  "table:web.pdfs": "ready",
}

mock.module("@/env.server", () => ({
  env: {
    API_URL: "http://api.test",
    HEALTHCHECK_TOKEN: "test-health-token",
    WEB_DATABASE_URL: "postgres://unused",
  },
}))

mock.module("@/db-fns/health", () => ({
  checkWebDatabase: async () => ({ ...dbChecks }),
}))

const { healthzHandler } = await import("./healthz")
const { readyzHandler } = await import("./readyz")
const { readyzDetailsHandler } = await import("./readyz/details")

describe("web health routes", () => {
  beforeEach(() => {
    for (const key of Object.keys(dbChecks)) dbChecks[key] = "ready"
  })

  it("returns minimal liveness", async () => {
    const response = await healthzHandler()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "healthy" })
  })

  it("returns minimal readiness when dependencies are ready", async () => {
    setApiSuccess("/readyz", { status: "ready" })

    const response = await readyzHandler()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "ready" })
  })

  it("returns 503 readiness when API readiness fails", async () => {
    setApiError("/readyz", 503)

    const response = await readyzHandler()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: "unready" })
  })

  it("rejects missing or invalid details tokens", async () => {
    expect(
      (await readyzDetailsHandler({ request: new Request("http://test/api/readyz/details") }))
        .status,
    ).toBe(401)
    expect(
      (
        await readyzDetailsHandler({
          request: new Request("http://test/api/readyz/details", {
            headers: { "X-Health-Check-Token": "wrong" },
          }),
        })
      ).status,
    ).toBe(401)
  })

  it("returns protected detailed checks without sensitive values", async () => {
    setApiSuccess("/readyz/details", {
      status: "ready",
      checks: { redis: "ready" },
    })

    const response = await readyzDetailsHandler({
      request: new Request("http://test/api/readyz/details", {
        headers: { "X-Health-Check-Token": "test-health-token" },
      }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe("ready")
    expect(body.checks["table:web.pdfs"]).toBe("ready")
    expect(body.checks["api:redis"]).toBe("ready")
    expect(JSON.stringify(body)).not.toContain("postgres://")
  })
})
