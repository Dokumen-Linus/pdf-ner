// Release-lock beacon endpoint. The labelling page uses `navigator.sendBeacon`
// on tab-close to release its editing lock — a regular server-function call
// would be cancelled by navigation. sendBeacon fires-and-forgets a POST, so
// we accept it here and forward to the same releaseLabellingLock db-fn the
// rest of the app uses.
//
// Best-effort: the server-side 2-minute stale expiry is the real backstop.

import { createFileRoute } from "@tanstack/react-router"
import { requireUserId } from "@/db-fns/api/_helpers"
import { releaseLabellingLock } from "@/db-fns/web/pdfs"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function releaseLockHandler({ request }: { request: Request }): Promise<Response> {
  try {
    const body = (await request.json()) as { pdfId?: unknown; userId?: unknown }
    if (typeof body.pdfId !== "string" || !UUID_RE.test(body.pdfId)) {
      return Response.json({ detail: "pdfId must be a UUID" }, { status: 400 })
    }

    // Trust the session, not the body — a beacon could claim any userId.
    // Confirm the caller is releasing their OWN lock.
    const callerId = await requireUserId()
    if (typeof body.userId === "string" && body.userId !== callerId) {
      return Response.json({ detail: "Cannot release another user's lock" }, { status: 403 })
    }

    const result = await releaseLabellingLock({
      data: { pdfId: body.pdfId, userId: callerId },
    })
    return Response.json(result, { status: 200 })
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Release failed"
    const status = detail === "Unauthorized" ? 401 : 500
    return Response.json({ detail }, { status })
  }
}

export const Route = createFileRoute("/api/release-lock")({
  server: {
    handlers: {
      POST: releaseLockHandler,
    },
  },
})
