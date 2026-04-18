import { env } from "@/env.server";
import { observedApiFetch } from "@/lib/observability/fetch"


// Streaming passthrough to FastAPI. Unlike jsonCall (JSON RPC-style), this
// pipes the inbound request body straight through with `duplex: "half"` so
// large uploads never buffer in memory. Returns the raw Response so callers
// can decide whether to proxy it verbatim, parse JSON, or read as stream.
export interface StreamProxyOptions {
  path: string
  request: Request
  method?: string
  headers?: Record<string, string>
  query?: Record<string, string>
}

export async function streamProxy({
  path,
  request,
  method = "POST",
  headers = {},
  query,
}: StreamProxyOptions): Promise<Response> {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : ""
  const url = `${env.API_URL}${path}${qs}`

  const forwardHeaders: Record<string, string> = {
    "X-API-Key": env.API_KEY,
    ...headers,
  }

  // `duplex: "half"` is required by the fetch spec when the request body is
  // a stream. The runtime (Node/undici) supports it, but it is not yet in
  // the lib.dom fetch init type — cast via an extension type rather than
  // suppressing the error.
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers: forwardHeaders,
    body: request.body,
    duplex: "half",
  }

  return observedApiFetch(url, init, request.headers)
}