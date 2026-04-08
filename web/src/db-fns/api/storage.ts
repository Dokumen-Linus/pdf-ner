import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { eq } from "drizzle-orm/sql"
import { z } from "zod"
import { db } from "@/db/client"
import { projects } from "@/db/schemas/web/projects"
import { env } from "@/env.server"
import { auth } from "@/lib/auth"

async function requireUserId(): Promise<string> {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return session.user.id
}

async function requireProjectOwnership(projectId: string, userId: string) {
  const [project] = await db
    .select({ ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)
  if (!project) {
    throw new Error("Project not found")
  }
  if (project.ownerId !== userId) {
    throw new Error("You do not have access to this project")
  }
}

async function apiRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${env.API_URL}${path}`, {
    ...options,
    headers: {
      "X-API-Key": env.API_KEY,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(body.detail ?? `API request failed: ${response.status}`)
  }

  return response.json()
}

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
