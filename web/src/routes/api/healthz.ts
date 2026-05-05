import { createFileRoute } from "@tanstack/react-router"

export async function healthzHandler(): Promise<Response> {
  return Response.json({ status: "healthy" })
}

export const Route = createFileRoute("/api/healthz")({
  server: {
    handlers: {
      GET: healthzHandler,
    },
  },
})
