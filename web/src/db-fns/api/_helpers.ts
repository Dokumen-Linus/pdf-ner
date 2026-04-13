import { getRequestHeaders } from "@tanstack/react-start/server"
import { eq } from "drizzle-orm/sql"
import { db } from "@/db/client"
import { workersPdfs } from "@/db/schemas/workers/pdfs"
import { projects } from "@/db/schemas/web/projects"
import { env } from "@/env.server"
import { auth } from "@/lib/auth"

export async function requireUserId(): Promise<string> {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return session.user.id
}

export async function requireProjectOwnership(projectId: string, userId: string) {
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

export async function requirePdfOwnership(pdfId: string, userId: string): Promise<string> {
  const [pdf] = await db
    .select({ projectId: workersPdfs.projectId, ownerId: projects.ownerId })
    .from(workersPdfs)
    .innerJoin(projects, eq(projects.id, workersPdfs.projectId))
    .where(eq(workersPdfs.id, pdfId))
    .limit(1)

  if (!pdf) {
    throw new Error("PDF not found")
  }
  if (pdf.ownerId !== userId) {
    throw new Error("You do not have access to this project")
  }

  return pdf.projectId
}

export async function apiRequest(path: string, options: RequestInit = {}) {
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
