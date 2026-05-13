import { describe, expect, it } from "bun:test"

import type {
  BillingChargeAttempt,
  ChatModelEvalIteration,
  ChatModelEvalRun,
  ContextEngineeringIteration,
  ContextEngineeringRun,
  CorePdf,
  LlmUsage,
  NerRun,
  NerWorkflow,
  OcrEvaluationPdfTxt,
  OcrEvaluationRun,
  PdfTxt,
  PromptExample,
  Watcher,
} from "../../db/types"

/**
 * Compile-time shape checks for workers schema Drizzle types.
 */
describe("Workers Drizzle Schema Shape Checks", () => {
  it("LlmUsage should have expected workers.llm_usage fields", () => {
    type Expected = {
      id: number
      projectId: string
      actorUserId: string | null
      modelId: string
      source: string
      taskName: string | null
      inputTokens: number
      outputTokens: number
    }
    const _: Expected = {} as LlmUsage
    expect(true).toBe(true)
  })

  it("BillingChargeAttempt should have expected workers.billing_charge_attempts fields", () => {
    type Expected = {
      id: number
      accountType: string
      userId: string | null
      organizationId: string | null
      periodStart: Date
      periodEnd: Date
      baseAmountCents: number
      usageAmountCents: number
      totalAmountCents: number
      stripePaymentIntentId: string | null
      status: string
    }
    const _: Expected = {} as BillingChargeAttempt
    expect(true).toBe(true)
  })

  it("CorePdf should have expected core.pdfs fields", () => {
    type Expected = {
      id: string
      projectId: string
      filepath: string
      hasLabels: boolean
      sourceType: string
      uploadedByUserId: string | null
    }
    const _: Expected = {} as CorePdf
    expect(true).toBe(true)
  })

  it("PdfTxt should have expected workers.pdf_txts fields", () => {
    type Expected = {
      id: number
      pdfId: string
      extractMethod: string
      createdByDomain: string
      txt: string
    }
    const _: Expected = {} as PdfTxt
    expect(true).toBe(true)
  })

  it("Watcher should have expected workers.watchers fields", () => {
    type Expected = {
      id: string
      pdfSourceId: string
      pollIntervalSeconds: number
      failureCount: number
    }
    const _: Expected = {} as Watcher
    expect(true).toBe(true)
  })

  it("NerWorkflow should have expected workers.ner_workflows fields", () => {
    type Expected = {
      id: string
      projectId: string
      watcherId: string | null
      listenerId: string | null
    }
    const _: Expected = {} as NerWorkflow
    expect(true).toBe(true)
  })

  it("ContextEngineeringRun should have expected workers.context_engineering_runs fields", () => {
    type Expected = {
      id: string
      projectId: string
      beta: number
      maxUsd: number
      accumulatedUsd: number
      bestOverallF: number | null
      stopReason: string | null
      labeledPdfs: string[]
    }
    const _: Expected = {} as ContextEngineeringRun
    expect(true).toBe(true)
  })

  it("ContextEngineeringIteration should have expected context_engineering_iterations fields", () => {
    type Expected = {
      id: number
      contextEngRunId: string
      promptId: string
      overallF: number
      incorrectlyPredictedEntityValueIds: number[]
    }
    const _: Expected = {} as ContextEngineeringIteration
    expect(true).toBe(true)
  })

  it("PromptExample should have expected workers.prompt_examples fields", () => {
    type Expected = {
      id: number
      promptId: string
      pdfId: string
      entityTypeId: string
      exampleIdx: number
    }
    const _: Expected = {} as PromptExample
    expect(true).toBe(true)
  })

  it("ChatModelEvalRun should have expected workers.chat_model_eval_runs fields", () => {
    type Expected = {
      id: string
      projectId: string
      bestModelId: string | null
      beta: number
      accumulatedUsd: number
      bestOverallF: number | null
      bestAccuracyScore: number | null
      labeledPdfs: string[]
      chatModels: string[]
    }
    const _: Expected = {} as ChatModelEvalRun
    expect(true).toBe(true)
  })

  it("ChatModelEvalIteration should have expected workers.chat_model_eval_iterations fields", () => {
    type Expected = {
      id: number
      chatModelEvalRunId: string
      modelId: string
      promptId: string
      overallF: number
      incorrectlyPredictedEntityValueIds: number[]
    }
    const _: Expected = {} as ChatModelEvalIteration
    expect(true).toBe(true)
  })

  it("NerRun should have expected workers.ner_runs fields", () => {
    type Expected = {
      id: string
      projectId: string
      promptId: string
      nerWorkflowId: string | null
      contextEngIterId: number | null
      modelEvalIterId: number | null
    }
    const _: Expected = {} as NerRun
    expect(true).toBe(true)
  })

  it("OcrEvaluationRun should have expected workers.ocr_evaluation_runs fields", () => {
    type Expected = {
      id: string
      projectId: string
      status: string
      judgeModel: string
      maxPdfs: number
      maxPagesPerPdf: number
      extractMethod: string
      ocrOnly: boolean
    }
    const _: Expected = {} as OcrEvaluationRun
    expect(true).toBe(true)
  })

  it("OcrEvaluationPdfTxt should have expected workers.ocr_evaluation_pdf_txts fields", () => {
    type Expected = {
      id: number
      runId: string
      pdfId: string
      extractMethod: string
      pdfTxtId: number
    }
    const _: Expected = {} as OcrEvaluationPdfTxt
    expect(true).toBe(true)
  })
})
