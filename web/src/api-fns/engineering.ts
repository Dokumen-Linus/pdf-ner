import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { requireProjectOwnership, requireUserId } from "@/db-fns/api/authorization.server"

import { jsonCall } from "./api-json-call.server"

export const startPromptOptimization = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      projectId: z.string().uuid(),
      maxIterations: z.number().int().min(1).max(20).default(5),
      model: z.string().min(1).default("gpt-4o"),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await requireProjectOwnership(data.projectId, userId)

    return jsonCall("/api/v1/llm-ner/optimize-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: data.projectId,
        max_iterations: data.maxIterations,
        model: data.model,
      }),
    }) as Promise<{ task_id: string }>
  })

export const getOptimizationStatus = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      taskId: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId()

    const res = (await jsonCall(`/api/v1/llm-ner/optimize-prompt/${data.taskId}/status`)) as {
      task_id: string
      status: string
      project_id: string | null
      progress?: {
        phase: string
        message: string
        percent: number
        details: Record<string, string | number | boolean>
      }
      result?: {
        best_prompt_id: string
        best_f1: number
        iterations_run: number
      }
      error?: string
    }

    if (!res.project_id) {
      throw new Error("Task not found or expired")
    }
    await requireProjectOwnership(res.project_id, userId)

    return res
  })
