import { env } from "@/env.server"
import { apiRequest } from "./_helpers"

export async function createBucket(name: string): Promise<{ bucket_id: string; name: string }> {
  return apiRequest("/api/v1/pdf-storage/buckets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      region: env.AWS_REGION,
      access_key_id: env.AWS_ACCESS_KEY_ID,
      secret_access_key: env.AWS_SECRET_ACCESS_KEY,
      endpoint_url: env.AWS_ENDPOINT_URL ?? undefined,
    }),
  })
}
