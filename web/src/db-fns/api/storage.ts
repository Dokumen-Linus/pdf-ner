import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { env } from "@/env.server"
import { apiRequest, requirePdfOwnership, requireUserId } from "./_helpers"

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

// Presigned GET URL for a stored PDF. The API signs against the bucket's
// per-row credentials so the browser never sees AWS secrets.
// TTL is fixed server-side at 1 hour.
export const getPdfPresignedUrl = createServerFn({ method: "GET" })
  .inputValidator(z.object({ pdfId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await requirePdfOwnership(data.pdfId, userId)

    const res: { url: string; expires_in: number; pdf_id: string } = await apiRequest(
      `/api/v1/pdf-storage/pdfs/${data.pdfId}/url`,
      {
        method: "GET",
        headers: { "X-User-Id": userId },
      },
    )
    return { url: res.url, expiresIn: res.expires_in, pdfId: res.pdf_id }
  })
