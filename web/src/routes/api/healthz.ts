import { createFileRoute } from "@tanstack/react-router"
import type { FileRoutesByPath } from "@tanstack/router-core"

export async function healthzHandler(): Promise<Response> {
  return Response.json({ status: "healthy" })
}

export const Route = createFileRoute("/api/healthz" as keyof FileRoutesByPath)({
  server: {
    handlers: {
      GET: healthzHandler,
    },
  },
})
