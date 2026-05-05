import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { env } from "@/env.server"
import { requirePdfAccess } from "@/lib/authorization.server"

import { jsonCall } from "./api-json-call.server"

// `lifecycle_applied` reflects whether the bucket received the
// AbortIncompleteMultipartUpload lifecycle rule (orphan-parts safety net).
// It can be false on MinIO/custom endpoints that don't implement the API —
// the bucket itself is still usable.
export const createBucket = createServerFn({ method: "POST" })
  .inputValidator(z.object({ name: z.string() }))
  .handler(
    async ({ data }): Promise<{ bucket_id: string; name: string; lifecycle_applied: boolean }> => {
      return jsonCall("/api/v1/pdf-storage/buckets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          region: env.PDF_STORAGE_AWS_REGION,
          access_key_id: env.PDF_STORAGE_AWS_ACCESS_KEY_ID,
          secret_access_key: env.PDF_STORAGE_AWS_SECRET_ACCESS_KEY,
          endpoint_url: env.PDF_STORAGE_AWS_ENDPOINT_URL ?? undefined,
        }),
      })
    },
  )

// Presigned GET URL for a stored PDF. The API signs against the bucket's
// per-row credentials so the browser never sees AWS secrets.
// TTL is fixed server-side at 1 hour.
export const getPdfPresignedUrl = createServerFn({ method: "GET" })
  .inputValidator(z.object({ pdfId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const access = await requirePdfAccess(data.pdfId, "label")

    const res: { url: string; expires_in: number; pdf_id: string } = await jsonCall(
      `/api/v1/pdf-storage/pdfs/${data.pdfId}/url`,
      {
        method: "GET",
        headers: { "X-User-Id": access.ownerId ?? access.userId },
      },
    )
    return { url: res.url, expiresIn: res.expires_in, pdfId: res.pdf_id }
  })
