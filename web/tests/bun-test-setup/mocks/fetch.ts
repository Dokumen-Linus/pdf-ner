// Configurable fetch mock. Tests register (method, path) → response pairs;
// any fetch call that matches returns a real Response so existing code
// (e.g. apiRequest() in db-fns/api/_helpers.ts) keeps working unchanged:
// response.ok, response.json(), response.statusText all behave correctly.
//
// Matching is by URL.pathname — not the full URL — because tests shouldn't
// need to know the value of env.API_URL. Method matching is optional
// ("*" matches any verb).
//
// Unmatched calls throw by default so tests can't silently hit the real
// network. Switch fallback to a MockFetchResponse via setFetchFallback() if
// you want a catch-all (rarely useful).

import { fetchState, type MockFetchResponse } from "./state"

// ─── Installer ────────────────────────────────────────────────────────────────

/**
 * Install the global fetch mock. Call once at preload time. Safe to call
 * multiple times — subsequent calls are no-ops (state.routes persist).
 */
let installed = false
export function installFetchMock(): void {
  if (installed) return
  installed = true

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const { method, url } = extractMethodAndUrl(input, init)
    const pathname = safePathname(url)
    const upperMethod = method.toUpperCase()

    const match = findRoute(upperMethod, pathname)
    if (match) {
      return buildResponse(match.response)
    }

    if (fetchState.fallback === "throw") {
      throw new Error(
        `[fetch mock] No mock registered for ${upperMethod} ${pathname} ` +
          `(full URL: ${url}). Register one with setApiResponse / setApiSuccess ` +
          `/ setApiUnauthorized from "@/tests/bun-test-setup/mocks".`,
      )
    }
    return buildResponse(fetchState.fallback)
  }) as typeof fetch
}

// ─── Internals ────────────────────────────────────────────────────────────────

function extractMethodAndUrl(
  input: RequestInfo | URL,
  init?: RequestInit,
): { method: string; url: string } {
  if (typeof input === "string") {
    return { method: init?.method ?? "GET", url: input }
  }
  if (input instanceof URL) {
    return { method: init?.method ?? "GET", url: input.href }
  }
  // Request object — init.method takes precedence if the caller supplied one,
  // matching the real fetch spec.
  return { method: init?.method ?? input.method ?? "GET", url: input.url }
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    // Relative URL or malformed — fall back to the raw string so tests can
    // still register against it.
    return url
  }
}

function findRoute(method: string, pathname: string) {
  // Most-recently-registered wins (reverse iteration) so tests can override a
  // globally-registered route inside a specific `it` without unregistering.
  for (let i = fetchState.routes.length - 1; i >= 0; i--) {
    const route = fetchState.routes[i]
    if (route.pathname !== pathname) continue
    if (route.method !== "*" && route.method !== method) continue
    return route
  }
  return null
}

function buildResponse(config: MockFetchResponse): Response {
  const status = config.status ?? 200

  const headers = new Headers(config.headers)
  let body: BodyInit | null = null

  if (config.json !== undefined) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json")
    body = JSON.stringify(config.json)
  } else if (config.text !== undefined) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "text/plain")
    body = config.text
  }

  // 204/205/304 must not have a body per spec; Response ctor throws otherwise.
  const mustBeEmpty = status === 204 || status === 205 || status === 304
  return new Response(mustBeEmpty ? null : body, { status, headers })
}
