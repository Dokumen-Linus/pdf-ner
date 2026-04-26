// Streaming PDF upload proxy. The browser POSTs the raw PDF as the request
// body (not multipart), with project_id and bucket_id as query params and
// the original filename as the X-Filename header. This handler authorizes
// the request and pipes request.body straight through to FastAPI — no
// buffering in this layer, no base64, no multipart parsing.
//
// Size limit (50 MB) is enforced:
//   1. Cheap pre-check against Content-Length here.
//   2. Byte-counting during the FastAPI stream (source of truth).

import { createFileRoute } from "@tanstack/react-router"

import { streamProxy } from "@/api-fns/api-stream-proxy.server"
import { requireProjectPermission } from "@/lib/role-authorization.server"

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB, matches FastAPI and client cap.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function errorStatus(message: string): number {
  if (message === "Unauthorized") return 401
  if (message === "Project not found") return 404
  if (message === "You do not have access to this project") return 403
  return 500
}

/**
 * Exported for unit tests. The Route below wires it into the TanStack Start
 * server handler; tests invoke this directly with a synthetic Request.
 */
export async function uploadHandler({ request }: { request: Request }): Promise<Response> {
  try {
    const url = new URL(request.url)
    const projectId = url.searchParams.get("project_id")
    const bucketId = url.searchParams.get("bucket_id")

    if (!projectId || !bucketId) {
      return Response.json(
        { detail: "project_id and bucket_id query params are required" },
        { status: 400 },
      )
    }
    if (!UUID_RE.test(projectId) || !UUID_RE.test(bucketId)) {
      return Response.json({ detail: "project_id and bucket_id must be UUIDs" }, { status: 400 })
    }

    if (request.headers.get("content-type")?.toLowerCase() !== "application/pdf") {
      return Response.json({ detail: "Content-Type must be application/pdf" }, { status: 400 })
    }

    const contentLengthHeader = request.headers.get("content-length")
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader)
      if (!Number.isFinite(contentLength) || contentLength <= 0) {
        return Response.json({ detail: "Invalid Content-Length" }, { status: 400 })
      }
      if (contentLength > MAX_BYTES) {
        return Response.json({ detail: "file exceeds 50 MB" }, { status: 413 })
      }
    }

    await requireProjectPermission(projectId, "upload_documents")

    if (!request.body) {
      return Response.json({ detail: "request body is required" }, { status: 400 })
    }

    const filenameHeader = request.headers.get("x-filename") ?? ""
    const forwardHeaders: Record<string, string> = { "Content-Type": "application/pdf" }
    if (contentLengthHeader) forwardHeaders["Content-Length"] = contentLengthHeader
    if (filenameHeader) forwardHeaders["X-Filename"] = filenameHeader

    const forwarded = await streamProxy({
      path: "/api/v1/pdf-storage/pdfs",
      request,
      headers: forwardHeaders,
      query: { project_id: projectId, bucket_id: bucketId },
    })

    const bodyText = await forwarded.text()
    const contentType = forwarded.headers.get("content-type") ?? "application/json"
    return new Response(bodyText, {
      status: forwarded.status,
      headers: { "Content-Type": contentType },
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Upload failed"
    return Response.json({ detail }, { status: errorStatus(detail) })
  }
}

export const Route = createFileRoute("/api/pdf-upload")({
  server: {
    handlers: {
      POST: uploadHandler,
    },
  },
})
