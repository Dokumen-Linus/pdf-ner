import { checkWebDatabase } from "@/db-fns/health"
import { env } from "@/env.server"

type CheckMap = Record<string, string>

export function overallStatus(checks: CheckMap): "ready" | "unready" {
  return Object.values(checks).every((value) => value === "ready") ? "ready" : "unready"
}

export function tokenAuthorized(request: Request): boolean {
  const expected = env.HEALTHCHECK_TOKEN
  return Boolean(expected && request.headers.get("X-Health-Check-Token") === expected)
}

export async function checkApiReady(details: boolean): Promise<CheckMap> {
  const path = details ? "/readyz/details" : "/readyz"
  const headers: Record<string, string> = {}
  if (details && env.HEALTHCHECK_TOKEN) {
    headers["X-Health-Check-Token"] = env.HEALTHCHECK_TOKEN
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2_000)
  try {
    const response = await fetch(`${env.API_URL}${path}`, {
      headers,
      signal: controller.signal,
    })
    if (!response.ok) {
      return { "api:readyz": "unready" }
    }
    if (!details) {
      return { "api:readyz": "ready" }
    }
    const body = (await response.json()) as { checks?: CheckMap }
    return {
      "api:readyz": "ready",
      ...Object.fromEntries(
        Object.entries(body.checks ?? {}).map(([key, value]) => [`api:${key}`, value]),
      ),
    }
  } catch {
    return { "api:readyz": "unready" }
  } finally {
    clearTimeout(timeout)
  }
}

export async function buildWebReadinessChecks(details = false): Promise<CheckMap> {
  return {
    ...(await checkWebDatabase()),
    ...(await checkApiReady(details)),
  }
}
