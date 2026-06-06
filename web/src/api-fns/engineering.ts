import { z } from "zod"

import { createMonitoredApiFn } from "@/db-fns/web/monitoring"
import { requireProjectPermission } from "@/lib/role-authorization.server"

import { jsonCall } from "./api-json-call.server"

export const startPromptOptimization = createMonitoredApiFn({ eventName: "api.worker_dispatch.optimize_prompt", method: "POST" })
  .inputValidator(
    z.object({
      projectId: z.string().uuid(),
      templateId: z.number().int().positive(),
      maxCostUsd: z.number().positive().default(1),
      model: z.string().min(1).default("gpt-5.4-mini"),
    }),
  )
  .handler(async ({ data }) => {
    await requireProjectPermission(data.projectId, "engineering")

    return jsonCall("/api/v1/worker-dispatch/optimize-prompt", {
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

export const getOptimizationStatus = createMonitoredApiFn({ eventName: "api.worker_dispatch.get_optimization_status", method: "GET" })
  .inputValidator(
    z.object({
      taskId: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const res = (await jsonCall(
      `/api/v1/worker-dispatch/optimize-prompt/${data.taskId}/status`,
    )) as {
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

export const activatePrompt = createMonitoredApiFn({ eventName: "api.worker_dispatch.activate_prompt", method: "POST" })
  .inputValidator(
    z.object({
      projectId: z.string().uuid(),
      promptId: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    await requireProjectPermission(data.projectId, "engineering")

    return jsonCall("/api/v1/worker-dispatch/activate-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: data.projectId,
        prompt_id: data.promptId,
      }),
    }) as Promise<{ task_id: string }>
  })

export const startOcrEvaluation = createMonitoredApiFn({ eventName: "api.worker_dispatch.start_ocr_evaluation", method: "POST" })
  .inputValidator(
    z.object({
      projectId: z.string().uuid(),
      judgeModel: z.string().min(1),
      maxPdfs: z.number().int().positive().default(5),
      maxPagesPerPdf: z.number().int().positive().default(3),
      maxCostUsd: z.number().positive().default(0.5),
    }),
  )
  .handler(async ({ data }) => {
    await requireProjectPermission(data.projectId, "engineering")

    return jsonCall("/api/v1/worker-dispatch/ocr-evaluation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: data.projectId,
        judge_model: data.judgeModel,
        max_pdfs: data.maxPdfs,
        max_pages_per_pdf: data.maxPagesPerPdf,
        max_cost_usd: data.maxCostUsd,
      }),
    }) as Promise<{ task_id: string }>
  })

export const getOcrEvaluationStatus = createMonitoredApiFn({ eventName: "api.worker_dispatch.get_ocr_evaluation_status", method: "GET" })
  .inputValidator(
    z.object({
      taskId: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const res = (await jsonCall(
      `/api/v1/worker-dispatch/ocr-evaluation/${data.taskId}/status`,
    )) as {
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
        run_id: string
        project_id: string
        recommendation: string
        confidence: number
        sampled_pdf_count: number
        sampled_page_count: number
        judge_model: string
        input_tokens: number
        output_tokens: number
        cost_usd: string
      }
      error?: string
    }

    if (!res.project_id) {
      throw new Error("Task not found or expired")
    }
    await requireProjectPermission(res.project_id, "engineering")

    return res
  })
