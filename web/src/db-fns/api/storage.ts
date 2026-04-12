import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { env } from "@/env.server"
import { apiRequest, requireProjectOwnership, requireUserId } from "./_helpers"

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

export const uploadPdf = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      projectId: z.string().uuid(),
      bucketId: z.string().uuid(),
      fileName: z.string(),
      fileBase64: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await requireProjectOwnership(data.projectId, userId)

    const fileBytes = Buffer.from(data.fileBase64, "base64")
    const blob = new Blob([fileBytes], { type: "application/pdf" })

    const formData = new FormData()
    formData.append("file", blob, data.fileName)
    formData.append("project_id", data.projectId)
    formData.append("bucket_id", data.bucketId)

    return apiRequest("/api/v1/pdf-storage/pdfs", {
      method: "POST",
      body: formData,
    })
  })
