import { z } from "zod"

import { createMonitoredApiFn } from "@/db-fns/web/monitoring"
import { env } from "@/env.server"
import { requirePdfAccess } from "@/lib/project-authorization.server"

import { jsonCall } from "./api-json-call.server"

// `lifecycle_applied` reflects whether the bucket received the
// AbortIncompleteMultipartUpload lifecycle rule (orphan-parts safety net).
// It can be false on MinIO/custom endpoints that don't implement the API —
// the bucket itself is still usable.
export const createBucket = createMonitoredApiFn({ eventName: "api.storage.create_bucket", method: "POST" })
  .inputValidator(z.object({ name: z.string() }))
  .handler(
    async ({ data }): Promise<{ bucket_id: string; name: string; lifecycle_applied: boolean }> => {
      return jsonCall("/api/v1/pdf-storage/buckets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          region: env.PDF_STORAGE_AWS_REGION,
          endpoint_url: env.PDF_STORAGE_AWS_ENDPOINT_URL ?? undefined,
        }),
      })
    },
  )

// Presigned GET URL for a stored PDF. The API signs with its runtime AWS role
// so the browser never sees AWS credentials.
// TTL is fixed server-side at 1 hour.
export const getPdfPresignedUrl = createMonitoredApiFn({ eventName: "api.storage.get_pdf_presigned_url", method: "GET" })
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
