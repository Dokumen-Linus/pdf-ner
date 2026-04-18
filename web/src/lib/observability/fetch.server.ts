const REQUEST_ID_HEADER = "X-Request-ID"

function cloneRequestWithHeaders(request: Request, headers: Headers): Request {
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    cache: request.cache,
    credentials: request.credentials,
    integrity: request.integrity,
    keepalive: request.keepalive,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    signal: request.signal,
  }

  if (request.mode !== "navigate") {
    init.mode = request.mode
  }

  if (request.body !== null) {
    init.body = request.body
    init.duplex = "half"
  }

  return new Request(request.url, init)
}

export function withObservedRequest(request: Request): { request: Request; requestId: string } {
  const requestId = request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID()
  if (request.headers.has(REQUEST_ID_HEADER)) {
    return { request, requestId }
  }

  const headers = new Headers(request.headers)
  headers.set(REQUEST_ID_HEADER, requestId)

  return {
    request: cloneRequestWithHeaders(request, headers),
    requestId,
  }
}

export function withObservedResponse(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers)
  headers.set(REQUEST_ID_HEADER, requestId)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
