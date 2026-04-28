import { describe, expect, it } from "bun:test"

import type {
  FoundContextEngPred,
  FoundPromptEvaluation,
  FoundWorkersPdf,
  LlmUsage,
  LlmUsageReportBatch,
} from "../../db/types"

/**
 * Compile-time shape checks for workers schema Drizzle types.
 *
 * Since workers tables are read-only from web, there are no Zod create/update schemas to match.
 * Instead, these tests verify that the Drizzle InferSelectModel types have the expected
 * fields — catching regressions if the Drizzle schema diverges from the SQL.
 *
 * If these tests fail to compile, the Drizzle workers schema does not match the SQL definition.
 */
describe("Workers Drizzle Schema Shape Checks", () => {
  it("LlmUsage should have expected workers.llm_usage fields", () => {
    type Expected = {
      id: string
      projectId: string
      actorUserId: string | null
      billingUserId: string | null
      billingOrganizationId: string | null
      modelId: string
      source: string
      taskName: string | null
      inputTokens: number
      outputTokens: number
      reportBatchId: string | null
    }
    const _: Expected = {} as LlmUsage
    expect(true).toBe(true)
  })

  it("LlmUsageReportBatch should have expected workers.llm_usage_report_batches fields", () => {
    type Expected = {
      id: string
      billingUserId: string | null
      billingOrganizationId: string | null
      periodStart: Date
      periodEnd: Date
      usageCount: number
      stripeUsageRecordId: string | null
      status: string
    }
    const _: Expected = {} as LlmUsageReportBatch
    expect(true).toBe(true)
  })

  it("FoundWorkersPdf should have expected workers.pdfs fields", () => {
    type Expected = {
      id: string
      name: string | null
      bucketId: string
      filepath: string
      projectId: string
      fullText: string | null
      extractMethod: string | null
      modelType: string | null
      model: string | null
      promptId: string | null
      optimizedPromptId: string | null
    }
    const _: Expected = {} as FoundWorkersPdf
    expect(true).toBe(true)
  })

  it("FoundPromptEvaluation should have expected final metric fields", () => {
    type Expected = {
      id: string
      promptId: string
      overallF1: number
      perEntityScores: Record<string, unknown>
      modelId: string | null
      labeledPdfCount: number | null
      evaluatedPdfCount: number | null
      skippedPdfCount: number | null
      pdfsFullyCorrect: number | null
      pdfAccuracy: number | null
      entityTypeMetrics: Record<string, unknown> | null
      llmCallCount: number | null
      costUsd: string | null
      iterationsRun: number | null
      stopReason: string | null
      createdAt: Date | null
    }
    const _: Expected = {} as FoundPromptEvaluation
    expect(true).toBe(true)
  })

  it("FoundContextEngPred should have expected workers.context_eng_preds fields", () => {
    type Expected = {
      id: number
      promptEvaluationId: string
      pdfId: string
      entityTypeId: string
      labelledValue: string | null
      predictedValue: string | null
    }
    const _: Expected = {} as FoundContextEngPred
    expect(true).toBe(true)
  })
})
