// Integration examples for the shared test mocks. These walk through the
// patterns you'll want to copy when writing new tests:
//
//   1. Testing a route guard that branches on session presence.
//   2. Testing a client-side signin/signup/signout flow.
//   3. Testing a FastAPI-facing call (200 / 401 / 5xx / success-after-auth).
//
// All of them use ONLY the public helper API from "./" (the mocks/index.ts
// entry point). The global afterEach in main.ts resets state between tests,
// so each `it` starts from unauthenticated + empty fetch registry.
//
// NOTE: we deliberately don't import @/db-fns/api/_helpers here because it
// pulls in @/db/client, which currently fails to load under bun:test due to
// an unrelated `pgSchema("public")` issue in @/db/schemas/public/schema.ts.
// Instead, we demonstrate the same flow using the same primitives that
// _helpers uses internally: auth.api.getSession + global fetch.

import { describe, expect, it } from "bun:test"
import { auth } from "@/lib/auth"
import { authClient } from "@/lib/auth-client"
import {
  setApiError,
  setApiSuccess,
  setApiUnauthorized,
  setAuthenticated,
  setSignInResult,
  setSignOutResult,
  setSignUpResult,
  setUnauthenticated,
} from "."

// ─── A stand-in for the route guard's beforeLoad ──────────────────────────────
//
// _private.tsx's beforeLoad calls authClient.getSession() (client) or
// auth.api.getSession({ headers }) (server) and throws a redirect if no user.
// We model both branches below with a tiny helper that does the same thing.

async function guardClient(): Promise<"allowed" | "redirect-to-signin"> {
  const { data: session } = await authClient.getSession()
  return session?.user ? "allowed" : "redirect-to-signin"
}

async function guardServer(): Promise<"allowed" | "redirect-to-signin"> {
  const session = await auth.api.getSession({ headers: new Headers() })
  return session?.user ? "allowed" : "redirect-to-signin"
}

describe("route guard (isomorphic)", () => {
  it("unauthenticated → both client and server branches redirect", async () => {
    // Default state is unauthenticated. No setup needed.
    expect(await guardClient()).toBe("redirect-to-signin")
    expect(await guardServer()).toBe("redirect-to-signin")
  })

  it("authenticated → both client and server branches allow", async () => {
    // One call to setAuthenticated() covers BOTH isomorphic branches, because
    // @/lib/auth and @/lib/auth-client read from the same shared session state.
    setAuthenticated({ id: "user-9" })
    expect(await guardClient()).toBe("allowed")
    expect(await guardServer()).toBe("allowed")
  })

  it("authenticated → setUnauthenticated() revokes access mid-test", async () => {
    setAuthenticated({ id: "user-9" })
    expect(await guardClient()).toBe("allowed")

    setUnauthenticated()
    expect(await guardClient()).toBe("redirect-to-signin")
  })
})

// ─── Signin / signup / signout flows ──────────────────────────────────────────

describe("auth forms (client)", () => {
  it("signIn success path returns no error", async () => {
    // Default signInResult is success. A form's onSubmit path checks `error`,
    // so null means "keep going and navigate".
    const { error } = await authClient.signIn.email({
      email: "u@example.com",
      password: "Passw0rd!",
    })
    expect(error).toBeNull()
  })

  it("signIn failure path surfaces the error message to the form", async () => {
    setSignInResult({ data: null, error: { message: "Invalid credentials" } })
    const { error } = await authClient.signIn.email({
      email: "u@example.com",
      password: "nope",
    })
    expect(error?.message).toBe("Invalid credentials")
  })

  it("signUp failure path surfaces the error message (e.g. email already taken)", async () => {
    setSignUpResult({
      data: null,
      error: { message: "An account already exists with this email" },
    })
    const { error } = await authClient.signUp.email({
      email: "taken@example.com",
      password: "Passw0rd!",
      name: "X Y",
    })
    expect(error?.message).toBe("An account already exists with this email")
  })

  it("signOut can be configured to succeed or fail", async () => {
    setSignOutResult({ data: null, error: { message: "Network error" } })
    const result = await authClient.signOut()
    expect(result.error?.message).toBe("Network error")
  })
})

// ─── FastAPI-facing call (mirrors apiRequest in _helpers.ts) ─────────────────
//
// apiRequest(path, opts) does three things:
//   - fetch(env.API_URL + path, { headers: { 'X-API-Key': ... }, ...opts })
//   - if !response.ok → throw new Error(body.detail ?? statusText)
//   - otherwise → return response.json()
//
// We inline the same logic here so we can demonstrate the fetch mock without
// importing the (currently unloadable) _helpers module.

async function miniApiRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`http://api.test${path}`, {
    ...init,
    headers: { "X-API-Key": "fake-key", ...init?.headers },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ detail: response.statusText }))) as {
      detail?: string
    }
    throw new Error(body.detail ?? `API request failed: ${response.status}`)
  }
  return response.json()
}

describe("api call (integration: auth gate + fetch mock)", () => {
  it("200 OK → miniApiRequest resolves with the parsed body", async () => {
    setApiSuccess("GET /api/v1/pdf-storage/pdfs", [{ id: "pdf-1" }])
    const result = await miniApiRequest("/api/v1/pdf-storage/pdfs")
    expect(result).toEqual([{ id: "pdf-1" }])
  })

  it("401 Unauthorized → miniApiRequest rejects with the detail message", async () => {
    setApiUnauthorized("/api/v1/pdf-storage/pdfs", "Missing or invalid API key")
    await expect(miniApiRequest("/api/v1/pdf-storage/pdfs")).rejects.toThrow(
      "Missing or invalid API key",
    )
  })

  it("503 Service Unavailable → miniApiRequest rejects with the detail message", async () => {
    setApiError("POST /api/v1/pdf-storage/buckets", 503, "Storage provider down")
    await expect(miniApiRequest("/api/v1/pdf-storage/buckets", { method: "POST" })).rejects.toThrow(
      "Storage provider down",
    )
  })

  it("full flow: authenticated user + API success", async () => {
    setAuthenticated({ id: "user-1", email: "owner@example.com" })
    setApiSuccess("GET /api/v1/llm-ner/optimize-prompt/task-42/status", {
      task_id: "task-42",
      status: "running",
      project_id: "project-1",
    })

    // 1. Gate: would requireUserId() let us through?
    const session = await auth.api.getSession({ headers: new Headers() })
    expect(session?.user.id).toBe("user-1")

    // 2. Network: is the mocked API returning what we expect?
    const body = await miniApiRequest("/api/v1/llm-ner/optimize-prompt/task-42/status")
    expect(body).toMatchObject({ status: "running", project_id: "project-1" })
  })

  it("full flow: unauthenticated → gate blocks before any fetch happens", async () => {
    // No setAuthenticated(). No fetch mock either — if the code correctly
    // bails at the auth gate, we shouldn't need one.
    const session = await auth.api.getSession({ headers: new Headers() })
    expect(session).toBeNull()

    // If the code under test were broken and still called fetch, this mock's
    // default fallback (throw) would catch it loudly.
  })
})
