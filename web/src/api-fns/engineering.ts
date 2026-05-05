import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { requireProjectPermission } from "@/lib/role-authorization.server"

import { jsonCall } from "./api-json-call.server"

export const startPromptOptimization = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      projectId: z.string().uuid(),
      templateId: z.number().int().positive(),
      maxCostUsd: z.number().positive().default(1),
      model: z.string().min(1).default("gpt-4o"),
    }),
  )
  .handler(async ({ data }) => {
    await requireProjectPermission(data.projectId, "engineering")

    return jsonCall("/api/v1/llm-ner/optimize-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: data.projectId,
        template_id: data.templateId,
        max_cost_usd: data.maxCostUsd,
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
        cost_usd: string
        max_cost_usd: string
        stop_reason: string
      }
      error?: string
    }

    if (!res.project_id) {
      throw new Error("Task not found or expired")
    }
    await requireProjectPermission(res.project_id, "engineering")

    return res
  })
