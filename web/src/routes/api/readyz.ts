import { createFileRoute } from "@tanstack/react-router"

import { buildWebReadinessChecks, overallStatus } from "./-health"

export async function readyzHandler(): Promise<Response> {
  const checks = await buildWebReadinessChecks(false)
  const status = overallStatus(checks)
  return Response.json({ status }, { status: status === "ready" ? 200 : 503 })
}

export const Route = createFileRoute("/api/readyz")({
  server: {
    handlers: {
      GET: readyzHandler,
    },
  },
})
