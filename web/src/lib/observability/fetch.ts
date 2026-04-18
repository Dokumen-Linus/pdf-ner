const REQUEST_ID_HEADER = "X-Request-ID"
const TRACEPARENT_HEADER = "traceparent"
const TRACE_ID_HEADER = "X-Trace-ID"

export function buildObservedHeaders(
  initHeaders?: HeadersInit,
  sourceHeaders?: HeadersInit,
): Headers {
  const headers = new Headers(initHeaders)
  const upstream = new Headers(sourceHeaders)

  const requestId =
    headers.get(REQUEST_ID_HEADER) ?? upstream.get(REQUEST_ID_HEADER) ?? crypto.randomUUID()
  headers.set(REQUEST_ID_HEADER, requestId)

  const traceparent = headers.get(TRACEPARENT_HEADER) ?? upstream.get(TRACEPARENT_HEADER)
  if (traceparent) headers.set(TRACEPARENT_HEADER, traceparent)

  const traceId = headers.get(TRACE_ID_HEADER) ?? upstream.get(TRACE_ID_HEADER)
  if (traceId) headers.set(TRACE_ID_HEADER, traceId)

  return headers
}

export async function observedApiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  sourceHeaders?: HeadersInit,
): Promise<Response> {
  const headers = buildObservedHeaders(init.headers, sourceHeaders)
  return fetch(input, {
    ...init,
    headers,
  })
}
