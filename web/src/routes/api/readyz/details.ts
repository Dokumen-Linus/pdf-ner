import { createFileRoute } from "@tanstack/react-router"

import { buildWebReadinessChecks, overallStatus, tokenAuthorized } from "../-health"

export async function readyzDetailsHandler({ request }: { request: Request }): Promise<Response> {
  if (!tokenAuthorized(request)) {
    return Response.json({ detail: "Unauthorized" }, { status: 401 })
  }

  const checks = await buildWebReadinessChecks(true)
  const status = overallStatus(checks)
  return Response.json({ status, checks }, { status: status === "ready" ? 200 : 503 })
}

export const Route = createFileRoute("/api/readyz/details")({
  server: {
    handlers: {
      GET: readyzDetailsHandler,
    },
  },
})
