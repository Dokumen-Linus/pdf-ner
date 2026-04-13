// Unit tests for the streaming PDF upload proxy. We test the handler
// function directly (not through a router) — the Route wrapper is a thin
// createFileRoute() shell. Tests use the shared mocks for auth/ownership
// and fetch, so no real DB or network is hit.

import { describe, expect, it } from "bun:test"
import {
  setApiError,
  setApiSuccess,
  setProjectNotFound,
  setRequireProjectOwnershipDenied,
  setRequireUserIdUnauthorized,
} from "~/tests/bun-test-setup/mocks"
import { uploadHandler } from "./pdf-upload"

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PROJECT_ID = "11111111-1111-1111-1111-111111111111"
const BUCKET_ID = "22222222-2222-2222-2222-222222222222"
const BACKEND_PATH = "/api/v1/pdf-storage/pdfs"

function buildRequest(
  init: {
    projectId?: string | null
    bucketId?: string | null
    contentType?: string | null
    contentLength?: string | null
    filename?: string | null
    body?: BodyInit | null
  } = {},
): Request {
  const {
    projectId = PROJECT_ID,
    bucketId = BUCKET_ID,
    contentType = "application/pdf",
    contentLength,
    filename = "hello.pdf",
    body = new Uint8Array([0x25, 0x50, 0x44, 0x46]), // "%PDF"
  } = init

  const params = new URLSearchParams()
  if (projectId != null) params.set("project_id", projectId)
  if (bucketId != null) params.set("bucket_id", bucketId)
  const url = `http://test.local/api/pdf-upload?${params.toString()}`

  const headers = new Headers()
  if (contentType != null) headers.set("Content-Type", contentType)
  if (contentLength != null) headers.set("Content-Length", contentLength)
  if (filename != null) headers.set("X-Filename", filename)

  return new Request(url, { method: "POST", headers, body })
}

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("uploadHandler — success", () => {
  it("proxies a valid upload and returns the backend response body", async () => {
    setApiSuccess(`POST ${BACKEND_PATH}`, {
      pdf_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      filepath: `${PROJECT_ID}/xyz/hello.pdf`,
      bucket_name: "test-bucket",
    })

    const res = await uploadHandler({ request: buildRequest() })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.pdf_id).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    expect(json.filepath).toBe(`${PROJECT_ID}/xyz/hello.pdf`)
  })
})

// ─── Input validation ─────────────────────────────────────────────────────────

describe("uploadHandler — input validation", () => {
  it("returns 400 when project_id is missing", async () => {
    const res = await uploadHandler({ request: buildRequest({ projectId: null }) })
    expect(res.status).toBe(400)
    expect((await res.json()).detail).toMatch(/project_id/)
  })

  it("returns 400 when bucket_id is missing", async () => {
    const res = await uploadHandler({ request: buildRequest({ bucketId: null }) })
    expect(res.status).toBe(400)
  })

  it("returns 400 when project_id is not a UUID", async () => {
    const res = await uploadHandler({ request: buildRequest({ projectId: "not-a-uuid" }) })
    expect(res.status).toBe(400)
    expect((await res.json()).detail).toMatch(/UUID/)
  })

  it("returns 400 when Content-Type is not application/pdf", async () => {
    const res = await uploadHandler({
      request: buildRequest({ contentType: "application/json" }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).detail).toMatch(/Content-Type/)
  })

  it("returns 413 when Content-Length exceeds 50 MB", async () => {
    const res = await uploadHandler({
      request: buildRequest({ contentLength: String(60 * 1024 * 1024) }),
    })
    expect(res.status).toBe(413)
    expect((await res.json()).detail).toMatch(/50 MB/)
  })

  it("returns 400 when Content-Length is not a positive number", async () => {
    const res = await uploadHandler({ request: buildRequest({ contentLength: "-1" }) })
    expect(res.status).toBe(400)
    expect((await res.json()).detail).toMatch(/Content-Length/)
  })
})

// ─── Auth + ownership ────────────────────────────────────────────────────────

describe("uploadHandler — auth + ownership", () => {
  it("returns 401 when requireUserId throws Unauthorized", async () => {
    setRequireUserIdUnauthorized()
    const res = await uploadHandler({ request: buildRequest() })
    expect(res.status).toBe(401)
    expect((await res.json()).detail).toBe("Unauthorized")
  })

  it("returns 403 when the project is owned by someone else", async () => {
    setRequireProjectOwnershipDenied()
    const res = await uploadHandler({ request: buildRequest() })
    expect(res.status).toBe(403)
    expect((await res.json()).detail).toMatch(/do not have access/)
  })

  it("returns 404 when the project does not exist", async () => {
    setProjectNotFound()
    const res = await uploadHandler({ request: buildRequest() })
    expect(res.status).toBe(404)
    expect((await res.json()).detail).toBe("Project not found")
  })
})

// ─── Backend failure propagation ─────────────────────────────────────────────

describe("uploadHandler — backend failures", () => {
  it("propagates a 502 from the FastAPI backend", async () => {
    setApiError(`POST ${BACKEND_PATH}`, 502, "S3 unavailable")
    const res = await uploadHandler({ request: buildRequest() })
    expect(res.status).toBe(502)
    expect((await res.json()).detail).toBe("S3 unavailable")
  })

  it("propagates a 413 from the FastAPI backend when stream exceeds limit", async () => {
    // FastAPI enforces size via byte-counter during stream; we simulate that
    // path here since the Tanstack layer only pre-checks Content-Length.
    setApiError(`POST ${BACKEND_PATH}`, 413, "File exceeds 50 MB limit")
    const res = await uploadHandler({ request: buildRequest() })
    expect(res.status).toBe(413)
    expect((await res.json()).detail).toMatch(/50 MB/)
  })
})
