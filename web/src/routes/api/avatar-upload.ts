// Avatar upload proxy. The browser POSTs the raw image as the request body
// with the original filename as X-Filename. This handler authorizes the
// request, pipes the body to FastAPI, then saves the returned public S3 URL
// to web.users.avatar_url.

import { createFileRoute } from "@tanstack/react-router"

import { streamProxy } from "@/api-fns/api-stream-proxy.server"
import { monitorRouteHandler, requestMetadata } from "@/db-fns/web/monitoring"
import { updateUser } from "@/db-fns/web/users"
import { requireUserId } from "@/lib/project-authorization.server"

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

function errorStatus(message: string): number {
  if (message === "Unauthorized") return 401
  return 500
}

async function avatarUploadHandlerImpl({ request }: { request: Request }): Promise<Response> {
  try {
    const contentType = (request.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase()
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return Response.json(
        { detail: "Content-Type must be image/jpeg, image/png, image/webp, or image/gif" },
        { status: 415 },
      )
    }

    const contentLengthHeader = request.headers.get("content-length")
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader)
      if (!Number.isFinite(contentLength) || contentLength <= 0) {
        return Response.json({ detail: "Invalid Content-Length" }, { status: 400 })
      }
      if (contentLength > MAX_BYTES) {
        return Response.json({ detail: "Image exceeds 2 MB limit" }, { status: 413 })
      }
    }

    const userId = await requireUserId()

    if (!request.body) {
      return Response.json({ detail: "Request body is required" }, { status: 400 })
    }

    const forwardHeaders: Record<string, string> = { "Content-Type": contentType }
    if (contentLengthHeader) forwardHeaders["Content-Length"] = contentLengthHeader
    const filenameHeader = request.headers.get("x-filename")
    if (filenameHeader) forwardHeaders["X-Filename"] = filenameHeader

    const forwarded = await streamProxy({
      path: "/api/v1/avatar-storage/avatars",
      request,
      headers: forwardHeaders,
    })

    if (!forwarded.ok) {
      const text = await forwarded.text()
      return new Response(text, {
        status: forwarded.status,
        headers: { "Content-Type": forwarded.headers.get("content-type") ?? "application/json" },
      })
    }

    const { avatar_url } = (await forwarded.json()) as { avatar_url: string }

    await updateUser({ data: { id: userId, avatarUrl: avatar_url } })

    return Response.json({ avatarUrl: avatar_url })
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Upload failed"
    return Response.json({ detail }, { status: errorStatus(detail) })
  }
}

export const avatarUploadHandler = monitorRouteHandler<{ request: Request }, Response>(
  {
    eventName: "web.user.avatar_upload",
    getMetadata: ({ request }) => requestMetadata(request),
    getRawErrorPayload: ({ request }) => requestMetadata(request),
    operationType: "mutation",
    routeOrPath: "/api/avatar-upload",
  },
  avatarUploadHandlerImpl,
)

export const Route = createFileRoute("/api/avatar-upload")({
  server: {
    handlers: {
      POST: avatarUploadHandler,
    },
  },
})
