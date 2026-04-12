// Smoke tests for the shared mocks. main.ts preload installs the mocks;
// these tests verify the infrastructure works and serve as usage examples.

import { describe, expect, it } from "bun:test"
import { auth } from "@/lib/auth"
import { authClient } from "@/lib/auth-client"
import {
  resetMocks,
  setApiError,
  setApiResponse,
  setApiSuccess,
  setApiUnauthorized,
  setAuthenticated,
  setSignInResult,
  setSignUpResult,
  setUnauthenticated,
} from "."

// ─── @/lib/auth (server) ──────────────────────────────────────────────────────

describe("auth mock (server)", () => {
  it("returns null session by default (unauthenticated)", async () => {
    const session = await auth.api.getSession({ headers: new Headers() })
    expect(session).toBeNull()
  })

  it("returns the user set by setAuthenticated()", async () => {
    setAuthenticated({ id: "user-42", email: "alice@example.com", name: "Alice" })
    const session = await auth.api.getSession({ headers: new Headers() })
    expect(session?.user.id).toBe("user-42")
    expect(session?.user.email).toBe("alice@example.com")
    expect(session?.user.name).toBe("Alice")
  })

  it("returns null again after setUnauthenticated()", async () => {
    setAuthenticated()
    setUnauthenticated()
    const session = await auth.api.getSession({ headers: new Headers() })
    expect(session).toBeNull()
  })
})

// ─── @/lib/auth-client (client) ───────────────────────────────────────────────

describe("authClient mock (client)", () => {
  it("getSession returns { data: null } by default", async () => {
    const result = await authClient.getSession()
    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })

  it("getSession reflects setAuthenticated()", async () => {
    setAuthenticated({ email: "bob@example.com" })
    const { data } = await authClient.getSession()
    expect(data?.user.email).toBe("bob@example.com")
  })

  it("useSession returns the same snapshot as getSession", () => {
    setAuthenticated({ id: "user-7" })
    const { data, isPending } = authClient.useSession()
    expect(data?.user.id).toBe("user-7")
    expect(isPending).toBe(false)
  })

  it("signIn.email returns the result set by setSignInResult()", async () => {
    setSignInResult({ data: null, error: { message: "Invalid credentials" } })
    const result = await authClient.signIn.email({ email: "x@y.com", password: "wrong" })
    expect(result.error?.message).toBe("Invalid credentials")
  })

  it("signUp.email returns the result set by setSignUpResult()", async () => {
    setSignUpResult({ data: null, error: { message: "Email already in use" } })
    const result = await authClient.signUp.email({
      email: "x@y.com",
      password: "Passw0rd!",
      name: "X Y",
    })
    expect(result.error?.message).toBe("Email already in use")
  })
})

// ─── Fetch mock ───────────────────────────────────────────────────────────────

describe("fetch mock", () => {
  it("throws a diagnostic error when no route is registered", async () => {
    await expect(fetch("http://api.test/api/v1/unknown")).rejects.toThrow(
      /No mock registered for GET \/api\/v1\/unknown/,
    )
  })

  it("returns a 200 JSON response for setApiSuccess", async () => {
    setApiSuccess("/api/v1/pdfs", [{ id: "pdf-1" }, { id: "pdf-2" }])
    const res = await fetch("http://api.test/api/v1/pdfs")
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: "pdf-1" }, { id: "pdf-2" }])
  })

  it("returns a 401 JSON response for setApiUnauthorized", async () => {
    setApiUnauthorized("/api/v1/pdfs")
    const res = await fetch("http://api.test/api/v1/pdfs")
    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ detail: "Unauthorized" })
  })

  it("honors method prefixes in the key (e.g. 'POST /api/v1/foo')", async () => {
    setApiSuccess("POST /api/v1/foo", { created: true })
    setApiSuccess("GET /api/v1/foo", { cached: true })

    const post = await fetch("http://api.test/api/v1/foo", { method: "POST" })
    expect(await post.json()).toEqual({ created: true })

    const get = await fetch("http://api.test/api/v1/foo")
    expect(await get.json()).toEqual({ cached: true })
  })

  it("does not match a GET-registered route to a POST call", async () => {
    setApiSuccess("GET /api/v1/only-get", { ok: true })
    await expect(fetch("http://api.test/api/v1/only-get", { method: "POST" })).rejects.toThrow(
      /No mock registered for POST/,
    )
  })

  it("lets a later registration override an earlier one (last-wins)", async () => {
    setApiSuccess("/api/v1/override", { first: true })
    setApiSuccess("/api/v1/override", { second: true })
    const res = await fetch("http://api.test/api/v1/override")
    expect(await res.json()).toEqual({ second: true })
  })

  it("setApiError returns a custom status + detail", async () => {
    setApiError("/api/v1/boom", 503, "Service unavailable")
    const res = await fetch("http://api.test/api/v1/boom")
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ detail: "Service unavailable" })
  })

  it("setApiResponse accepts raw text + custom headers", async () => {
    setApiResponse("/api/v1/raw", {
      status: 200,
      text: "hello world",
      headers: { "X-Custom": "1" },
    })
    const res = await fetch("http://api.test/api/v1/raw")
    expect(res.headers.get("X-Custom")).toBe("1")
    expect(await res.text()).toBe("hello world")
  })
})

// ─── Global reset ─────────────────────────────────────────────────────────────

describe("reset behavior", () => {
  it("main.ts afterEach clears auth state between tests", async () => {
    const serverSession = await auth.api.getSession({ headers: new Headers() })
    const { data: clientSession } = await authClient.getSession()
    expect(serverSession).toBeNull()
    expect(clientSession).toBeNull()
  })

  it("main.ts afterEach clears fetch routes between tests", async () => {
    await expect(fetch("http://api.test/api/v1/pdfs")).rejects.toThrow(/No mock registered/)
  })

  it("resetMocks() explicitly also clears everything", async () => {
    setAuthenticated({ email: "leak@example.com" })
    setApiSuccess("/api/v1/leak", { leaked: true })

    resetMocks()

    expect(await auth.api.getSession({ headers: new Headers() })).toBeNull()
    await expect(fetch("http://api.test/api/v1/leak")).rejects.toThrow(/No mock registered/)
  })
})
