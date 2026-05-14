import { afterEach, beforeEach, describe, expect, it } from "bun:test"

import {
  setRequireProjectOwnership,
  setRequireProjectOwnershipDenied,
} from "~/tests/bun-test-setup/mocks"

type FetchCall = {
  url: string
  init?: RequestInit
  body?: unknown
}

const authorizedProjectIds: string[] = []
const fetchCalls: FetchCall[] = []
let fetchResponse: Response
let originalFetch: typeof fetch

const {
  getOcrEvaluationStatus,
  getOptimizationStatus,
  startOcrEvaluation,
  startPromptOptimization,
} = await import("./engineering")

const PROJECT_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479"

beforeEach(() => {
  authorizedProjectIds.length = 0
  fetchCalls.length = 0
  originalFetch = globalThis.fetch
  fetchResponse = Response.json({ task_id: "task-1" })
  setRequireProjectOwnership(async (projectId) => {
    authorizedProjectIds.push(projectId)
  })

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const body =
      init?.body != null && typeof init.body === "string" ? JSON.parse(init.body) : init?.body
    fetchCalls.push({ url, init, body })
    return fetchResponse.clone()
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("engineering API functions", () => {
  it("authorizes and starts prompt optimization with the worker-dispatch payload shape", async () => {
    const result = await startPromptOptimization({
      data: {
        projectId: PROJECT_ID,
        templateId: 12,
        maxCostUsd: 2.5,
        model: "gpt-5.4-mini",
      },
    })

    expect(result).toEqual({ task_id: "task-1" })
    expect(authorizedProjectIds).toEqual([PROJECT_ID])
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].url).toBe("http://api.test/api/v1/worker-dispatch/optimize-prompt")
    expect(fetchCalls[0].init?.method).toBe("POST")
    expect(new Headers(fetchCalls[0].init?.headers).get("X-API-Key")).toBe("test-api-key")
    expect(fetchCalls[0].body).toEqual({
      project_id: PROJECT_ID,
      template_id: 12,
      max_cost_usd: 2.5,
      model: "gpt-5.4-mini",
    })
  })

  it("authorizes and starts OCR evaluation with the worker-dispatch payload shape", async () => {
    const result = await startOcrEvaluation({
      data: {
        projectId: PROJECT_ID,
        judgeModel: "gemini-2.5-pro",
        maxPdfs: 7,
        maxPagesPerPdf: 4,
        maxCostUsd: 0.75,
      },
    })

    expect(result).toEqual({ task_id: "task-1" })
    expect(authorizedProjectIds).toEqual([PROJECT_ID])
    expect(fetchCalls[0].url).toBe("http://api.test/api/v1/worker-dispatch/ocr-evaluation")
    expect(fetchCalls[0].init?.method).toBe("POST")
    expect(fetchCalls[0].body).toEqual({
      project_id: PROJECT_ID,
      judge_model: "gemini-2.5-pro",
      max_pdfs: 7,
      max_pages_per_pdf: 4,
      max_cost_usd: 0.75,
    })
  })

  it("authorizes optimization status using the project id returned by the worker API", async () => {
    fetchResponse = Response.json({
      task_id: "task-1",
      status: "SUCCESS",
      project_id: PROJECT_ID,
      result: {
        best_prompt_id: "prompt-1",
        best_f1: 0.91,
        iterations_run: 3,
        cost_usd: "0.42",
        max_cost_usd: "1.00",
        stop_reason: "complete",
      },
    })

    const result = await getOptimizationStatus({ data: { taskId: "task-1" } })

    expect(result.status).toBe("SUCCESS")
    expect(authorizedProjectIds).toEqual([PROJECT_ID])
    expect(fetchCalls[0].url).toBe(
      "http://api.test/api/v1/worker-dispatch/optimize-prompt/task-1/status",
    )
  })

  it("rejects optimization status responses without a project id", async () => {
    fetchResponse = Response.json({
      task_id: "task-1",
      status: "PENDING",
      project_id: null,
    })

    await expect(getOptimizationStatus({ data: { taskId: "task-1" } })).rejects.toThrow(
      "Task not found or expired",
    )
    expect(authorizedProjectIds).toEqual([])
  })

  it("authorizes OCR evaluation status using the project id returned by the worker API", async () => {
    fetchResponse = Response.json({
      task_id: "task-2",
      status: "SUCCESS",
      project_id: PROJECT_ID,
      result: {
        run_id: "run-1",
        project_id: PROJECT_ID,
        recommendation: "olm_ocr",
        confidence: 0.82,
        sampled_pdf_count: 2,
        sampled_page_count: 6,
        judge_model: "gemini-2.5-pro",
        input_tokens: 100,
        output_tokens: 20,
        cost_usd: "0.15",
      },
    })

    const result = await getOcrEvaluationStatus({ data: { taskId: "task-2" } })

    expect(result.status).toBe("SUCCESS")
    expect(authorizedProjectIds).toEqual([PROJECT_ID])
    expect(fetchCalls[0].url).toBe(
      "http://api.test/api/v1/worker-dispatch/ocr-evaluation/task-2/status",
    )
  })

  it("does not call the worker API when engineering permission is denied", async () => {
    setRequireProjectOwnershipDenied()

    await expect(
      startPromptOptimization({
        data: {
          projectId: PROJECT_ID,
          templateId: 12,
          maxCostUsd: 2.5,
          model: "gpt-5.4-mini",
        },
      }),
    ).rejects.toThrow("You do not have access to this project")
    expect(fetchCalls).toEqual([])
  })

  it("propagates worker API error details", async () => {
    fetchResponse = Response.json({ detail: "worker unavailable" }, { status: 503 })

    await expect(
      startOcrEvaluation({
        data: {
          projectId: PROJECT_ID,
          judgeModel: "gemini-2.5-pro",
          maxPdfs: 7,
          maxPagesPerPdf: 4,
          maxCostUsd: 0.75,
        },
      }),
    ).rejects.toThrow("worker unavailable")
  })
})
