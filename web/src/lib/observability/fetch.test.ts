import { describe, expect, it, mock } from "bun:test"

import { buildObservedHeaders, observedApiFetch } from "./fetch"
import { withObservedRequest, withObservedResponse } from "./fetch.server"

describe("buildObservedHeaders", () => {
  it("reuses upstream request ids and trace headers", () => {
    const headers = buildObservedHeaders(
      { Authorization: "Bearer token" },
      {
        "X-Request-ID": "req-123",
        traceparent: "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
      },
    )

    expect(headers.get("Authorization")).toBe("Bearer token")
    expect(headers.get("X-Request-ID")).toBe("req-123")
    expect(headers.get("traceparent")).toBe(
      "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
    )
  })

  it("creates a request id when none exists", () => {
    const headers = buildObservedHeaders()
    expect(headers.get("X-Request-ID")).toBeTruthy()
  })

  it("generates a unique request id on each call", () => {
    const ids = new Set([
      buildObservedHeaders().get("X-Request-ID"),
      buildObservedHeaders().get("X-Request-ID"),
      buildObservedHeaders().get("X-Request-ID"),
    ])
    expect(ids.size).toBe(3)
  })

  it("prefers init headers over source headers for ids and traces", () => {
    const headers = buildObservedHeaders(
      {
        "X-Request-ID": "init-req",
        traceparent: "00-initinitinitinitinitinitinitini-1111111111111111-01",
        "X-Trace-ID": "init-trace",
      },
      {
        "X-Request-ID": "source-req",
        traceparent: "00-sourcesourcesourcesourcesourceso-2222222222222222-01",
        "X-Trace-ID": "source-trace",
      },
    )

    expect(headers.get("X-Request-ID")).toBe("init-req")
    expect(headers.get("traceparent")).toBe(
      "00-initinitinitinitinitinitinitini-1111111111111111-01",
    )
    expect(headers.get("X-Trace-ID")).toBe("init-trace")
  })

  it("propagates X-Trace-ID from the upstream source", () => {
    const headers = buildObservedHeaders(undefined, { "X-Trace-ID": "trace-abc" })
    expect(headers.get("X-Trace-ID")).toBe("trace-abc")
  })

  it("omits trace headers entirely when neither init nor source provide them", () => {
    const headers = buildObservedHeaders()
    expect(headers.get("traceparent")).toBeNull()
    expect(headers.get("X-Trace-ID")).toBeNull()
  })
})

describe("observedApiFetch", () => {
  it("forwards the input and merges observed headers into the outgoing request", async () => {
    const fetchMock = mock(async () => new Response("ok", { status: 200 }))

    await observedApiFetch(
      "http://test.local/foo",
      {
        method: "POST",
        headers: { Authorization: "Bearer t" },
        body: JSON.stringify({ a: 1 }),
      },
      undefined,
      fetchMock as unknown as typeof fetch,
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [input, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(input).toBe("http://test.local/foo")
    expect(init.method).toBe("POST")
    expect(init.body).toBe(JSON.stringify({ a: 1 }))

    const outgoing = new Headers(init.headers)
    expect(outgoing.get("Authorization")).toBe("Bearer t")
    expect(outgoing.get("X-Request-ID")).toBeTruthy()
  })

  it("propagates an upstream request id to the outgoing fetch", async () => {
    const fetchMock = mock(async () => new Response("ok", { status: 200 }))

    await observedApiFetch(
      "http://test.local/foo",
      {},
      { "X-Request-ID": "req-upstream" },
      fetchMock as unknown as typeof fetch,
    )

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(new Headers(init.headers).get("X-Request-ID")).toBe("req-upstream")
  })
})

describe("request/response wrappers", () => {
  it("reuses an incoming request id", () => {
    const observed = withObservedRequest(
      new Request("http://test.local/foo", {
        headers: { "X-Request-ID": "req-123" },
      }),
    )

    expect(observed.requestId).toBe("req-123")
    expect(observed.request.headers.get("X-Request-ID")).toBe("req-123")
  })

  it("creates a request id and injects it into a cloned Request", () => {
    const request = new Request("http://test.local/foo")
    const observed = withObservedRequest(request)

    expect(observed.request).not.toBe(request)
    expect(observed.requestId).toBeTruthy()
    expect(observed.request.headers.get("X-Request-ID")).toBe(observed.requestId)
  })

  it("preserves method and body when rebuilding a request with observed headers", async () => {
    const request = new Request("http://test.local/foo", {
      method: "POST",
      body: JSON.stringify({ hello: "world" }),
      headers: { "Content-Type": "application/json" },
    })

    const observed = withObservedRequest(request)

    expect(observed.request.method).toBe("POST")
    expect(observed.request.headers.get("Content-Type")).toBe("application/json")
    expect(await observed.request.text()).toBe(JSON.stringify({ hello: "world" }))
  })

  it("does not copy navigate mode into RequestInit when rebuilding a request", () => {
    const request = new Request("http://test.local/foo")
    Object.defineProperty(request, "mode", {
      configurable: true,
      value: "navigate",
    })

    const observed = withObservedRequest(request)

    expect(observed.request.headers.get("X-Request-ID")).toBe(observed.requestId)
    expect(observed.request.url).toBe("http://test.local/foo")
  })

  it("generates a unique request id per call when none is provided", () => {
    const a = withObservedRequest(new Request("http://test.local/foo"))
    const b = withObservedRequest(new Request("http://test.local/foo"))
    expect(a.requestId).not.toBe(b.requestId)
  })

  it("adds the request id to a Response", async () => {
    const response = withObservedResponse(new Response("ok"), "req-789")
    expect(response.headers.get("X-Request-ID")).toBe("req-789")
    expect(await response.text()).toBe("ok")
  })

  it("preserves status, statusText, and existing headers on the response", () => {
    const source = new Response("created", {
      status: 201,
      statusText: "Created",
      headers: {
        "Content-Type": "text/plain",
        "X-Custom": "keep-me",
      },
    })

    const response = withObservedResponse(source, "req-preserve")

    expect(response.status).toBe(201)
    expect(response.statusText).toBe("Created")
    expect(response.headers.get("Content-Type")).toBe("text/plain")
    expect(response.headers.get("X-Custom")).toBe("keep-me")
    expect(response.headers.get("X-Request-ID")).toBe("req-preserve")
  })

  it("overwrites any existing X-Request-ID on the response", () => {
    const source = new Response("ok", { headers: { "X-Request-ID": "old" } })
    const response = withObservedResponse(source, "new")
    expect(response.headers.get("X-Request-ID")).toBe("new")
  })
})
