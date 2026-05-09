// Unit tests for the streaming avatar upload proxy. Mirrors -pdf-upload.test.ts:
// test the handler function directly with the shared auth / fetch mocks.
//
// Avatar-upload additionally writes the returned URL to web.users via
// updateUser. We stub @/db-fns/web/users inline so tests don't need a DB —
// the stub captures the last call so the happy-path test can assert the
// DB write was triggered with the right args.

import { beforeEach, describe, expect, it, mock } from "bun:test"

import {
  setApiError,
  setApiSuccess,
  setRequireUserIdUnauthorized,
} from "~/tests/bun-test-setup/mocks"

// ─── Inline mock for @/db-fns/web/users ──────────────────────────────────────
// Must be installed BEFORE ./avatar-upload is imported so the handler picks
// up the stub. The stub records the last call for assertions.

type UpdateUserArgs = { data: { id: string; avatarUrl: string } }
const updateUserCalls: UpdateUserArgs[] = []

mock.module("@/db-fns/web/users", () => ({
  createUser: async () => ({ id: crypto.randomUUID() }),
  deleteUser: async () => ({ success: true }),
  getUserByEmail: async () => {
    throw new Error("User not found")
  },
  getUserById: async () => {
    throw new Error("User not found")
  },
  updateUser: async (args: UpdateUserArgs) => {
    updateUserCalls.push(args)
    return { success: true }
  },
}))

const { avatarUploadHandler } = await import("./avatar-upload")

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BACKEND_PATH = "/api/v1/avatar-storage/avatars"
const USER_ID = "00000000-0000-0000-0000-000000000001"
const PUBLIC_URL = "https://cdn.example.com/avatars/avatar.png"

function buildRequest(
  init: {
    contentType?: string | null
    contentLength?: string | null
    filename?: string | null
    body?: BodyInit | null
  } = {},
): Request {
  const {
    contentType = "image/png",
    contentLength,
    filename = "avatar.png",
    body = new Uint8Array([0x89, 0x50, 0x4e, 0x47]), // "‰PNG" signature
  } = init

  const headers = new Headers()
  if (contentType != null) headers.set("Content-Type", contentType)
  if (contentLength != null) headers.set("Content-Length", contentLength)
  if (filename != null) headers.set("X-Filename", filename)

  return new Request("http://test.local/api/avatar-upload", {
    method: "POST",
    headers,
    body,
  })
}

beforeEach(() => {
  updateUserCalls.length = 0
})

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("avatarUploadHandler — success", () => {
  it("proxies a valid image and persists the returned URL", async () => {
    setApiSuccess(`POST ${BACKEND_PATH}`, { avatar_url: PUBLIC_URL })

    const res = await avatarUploadHandler({ request: buildRequest() })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.avatarUrl).toBe(PUBLIC_URL)

    expect(updateUserCalls).toHaveLength(1)
    expect(updateUserCalls[0].data.id).toBe(USER_ID)
    expect(updateUserCalls[0].data.avatarUrl).toBe(PUBLIC_URL)
  })

  it.each([
    ["image/jpeg", "avatar.jpg"],
    ["image/webp", "avatar.webp"],
    ["image/gif", "avatar.gif"],
  ])("accepts %s", async (contentType, filename) => {
    setApiSuccess(`POST ${BACKEND_PATH}`, { avatar_url: PUBLIC_URL })
    const res = await avatarUploadHandler({
      request: buildRequest({ contentType, filename }),
    })
    expect(res.status).toBe(200)
  })
})

// ─── Input validation ─────────────────────────────────────────────────────────

describe("avatarUploadHandler — input validation", () => {
  it("returns 415 when Content-Type is not an allowed image type", async () => {
    const res = await avatarUploadHandler({
      request: buildRequest({ contentType: "application/pdf" }),
    })
    expect(res.status).toBe(415)
    expect((await res.json()).detail).toMatch(/Content-Type/)
  })

  it("returns 415 when Content-Type is missing", async () => {
    const res = await avatarUploadHandler({ request: buildRequest({ contentType: null }) })
    expect(res.status).toBe(415)
  })

  it("accepts image content types with charset parameters", async () => {
    setApiSuccess(`POST ${BACKEND_PATH}`, { avatar_url: PUBLIC_URL })
    const res = await avatarUploadHandler({
      request: buildRequest({ contentType: "image/png; charset=binary" }),
    })
    expect(res.status).toBe(200)
  })

  it("returns 413 when Content-Length exceeds 2 MB", async () => {
    const res = await avatarUploadHandler({
      request: buildRequest({ contentLength: String(3 * 1024 * 1024) }),
    })
    expect(res.status).toBe(413)
    expect((await res.json()).detail).toMatch(/2 MB/)
  })

  it("returns 400 when Content-Length is not a positive number", async () => {
    const res = await avatarUploadHandler({
      request: buildRequest({ contentLength: "-1" }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).detail).toMatch(/Content-Length/)
  })
})

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("avatarUploadHandler — auth", () => {
  it("returns 401 when requireUserId throws Unauthorized", async () => {
    setRequireUserIdUnauthorized()
    const res = await avatarUploadHandler({ request: buildRequest() })
    expect(res.status).toBe(401)
    expect((await res.json()).detail).toBe("Unauthorized")
  })

  it("does not write to the DB when auth fails", async () => {
    setRequireUserIdUnauthorized()
    await avatarUploadHandler({ request: buildRequest() })
    expect(updateUserCalls).toHaveLength(0)
  })
})

// ─── Backend failure propagation ─────────────────────────────────────────────

describe("avatarUploadHandler — backend failures", () => {
  it("propagates a 502 from the FastAPI backend", async () => {
    setApiError(`POST ${BACKEND_PATH}`, 502, "S3 unavailable")
    const res = await avatarUploadHandler({ request: buildRequest() })
    expect(res.status).toBe(502)
    expect((await res.json()).detail).toBe("S3 unavailable")
  })

  it("propagates a 415 from the FastAPI backend when content is rejected", async () => {
    setApiError(`POST ${BACKEND_PATH}`, 415, "Image content is not valid")
    const res = await avatarUploadHandler({ request: buildRequest() })
    expect(res.status).toBe(415)
    expect((await res.json()).detail).toMatch(/not valid/)
  })

  it("does not persist an avatar URL when the backend fails", async () => {
    setApiError(`POST ${BACKEND_PATH}`, 500, "Internal error")
    await avatarUploadHandler({ request: buildRequest() })
    expect(updateUserCalls).toHaveLength(0)
  })
})
