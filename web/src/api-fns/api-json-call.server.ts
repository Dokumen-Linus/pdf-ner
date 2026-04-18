import { getRequestHeaders } from "@tanstack/react-start/server";
import { env } from "@/env.server"
import { observedApiFetch } from "@/lib/observability/fetch"


export async function jsonCall(path: string, options: RequestInit = {}) {
  const response = await observedApiFetch(
    `${env.API_URL}${path}`,
    {
      ...options,
      headers: {
        "X-API-Key": env.API_KEY,
        ...options.headers,
      },
    },
    getRequestHeaders(),
  )

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(body.detail ?? `API request failed: ${response.status}`)
  }

  return response.json()
}