import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"

import {
  getOcrEvaluationStatus,
  getOptimizationStatus,
  startOcrEvaluation,
  startPromptOptimization,
} from "@/api-fns/engineering"
import {
  CheckCircle2Icon,
  Loader2Icon,
  PlayIcon,
  RotateCcwIcon,
  XCircleIcon,
} from "@/components/icons"
import { ProjectTabs } from "@/components/project-tabs"
import { Button } from "@/components/shadcn-ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn-ui/card"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import { Progress } from "@/components/shadcn-ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn-ui/select"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { getAvailableGoogleChatModels } from "@/db-fns/public/models"
import { getAllTemplates } from "@/db-fns/public/templates"
import { getCurrentProjectAccess, getProjectById } from "@/db-fns/web/projects"

function EngineeringSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="flex gap-4 border-b pb-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-28" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

export const Route = createFileRoute("/_private/projects/$projectId_/engineering")({
  loader: async ({ params, context }) => {
    try {
      const userId = context.session?.user?.id
      if (!userId) {
        return { project: null, templates: [], googleModels: [], loadError: "Not authenticated" }
      }

      const [project, access, templates, googleModels] = await Promise.all([
        getProjectById({ data: { id: params.projectId } }),
        getCurrentProjectAccess({ data: { projectId: params.projectId } }),
        getAllTemplates(),
        getAvailableGoogleChatModels(),
      ])
      if (access.accountRole === "analyst" || !access.canManage) {
        return {
          project: null,
          templates: [],
          googleModels: [],
          loadError: "Only developers can run prompt engineering.",
        }
      }
      return { project, templates, googleModels, loadError: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { project: null, templates: [], googleModels: [], loadError: message }
    }
  },
  pendingComponent: EngineeringSkeleton,
  component: EngineeringPage,
})

const PHASE_LABELS: Record<string, string> = {
  data_fetched: "Data Loaded",
  prompts_prepared: "Prompts Generated",
  evaluating_variant: "Evaluating Variants",
  evaluating_current: "Evaluating Current Best",
  generating_refinement: "Generating Refinement",
  iteration_evaluated: "Iteration Evaluated",
  storing_results: "Saving Results",
  sampling: "Sampling PDFs",
  ocr: "Evaluating OCR",
  complete: "Complete",
}

function EngineeringPage() {
  const router = useRouter()
  const { project, templates, googleModels, loadError } = Route.useLoaderData()
  const { projectId } = Route.useParams()

  const [taskId, setTaskId] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [ocrTaskId, setOcrTaskId] = useState<string | null>(null)
  const [isStartingOcr, setIsStartingOcr] = useState(false)
  const [ocrStartError, setOcrStartError] = useState<string | null>(null)
  const [judgeModel, setJudgeModel] = useState(googleModels[0]?.id ?? "")
  const [maxPdfs, setMaxPdfs] = useState(5)
  const [maxPagesPerPdf, setMaxPagesPerPdf] = useState(3)
  const [ocrMaxCostUsd, setOcrMaxCostUsd] = useState(0.5)
  const fallbackJudgeModel = googleModels[0]?.id ?? ""
  const selectedJudgeModel = googleModels.some((model) => model.id === judgeModel)
    ? judgeModel
    : fallbackJudgeModel

  const { data: status } = useQuery({
    queryKey: ["worker-dispatch", "optimization-status", taskId],
    queryFn: () => getOptimizationStatus({ data: { taskId: taskId! } }),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const s = query.state.data?.status
      if (s === "SUCCESS" || s === "FAILURE") return false
      return 2000
    },
  })

  const isRunning = !!taskId && status?.status !== "SUCCESS" && status?.status !== "FAILURE"

  const { data: ocrStatus } = useQuery({
    queryKey: ["worker-dispatch", "ocr-evaluation-status", ocrTaskId],
    queryFn: () => getOcrEvaluationStatus({ data: { taskId: ocrTaskId! } }),
    enabled: !!ocrTaskId,
    refetchInterval: (query) => {
      const s = query.state.data?.status
      if (s === "SUCCESS" || s === "FAILURE") return false
      return 2000
    },
  })

  const isOcrRunning =
    !!ocrTaskId && ocrStatus?.status !== "SUCCESS" && ocrStatus?.status !== "FAILURE"

  async function handleStart() {
    const templateId = templates?.[0]?.id
    if (!templateId) {
      setStartError("No prompt templates are available.")
      return
    }

    setIsStarting(true)
    setStartError(null)
    try {
      const result = await startPromptOptimization({
        data: { projectId, templateId, maxCostUsd: 1, model: "gpt-5.4-mini" },
      })
      setTaskId(result.task_id)
    } catch (error) {
      setStartError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsStarting(false)
    }
  }

  async function handleStartOcrEvaluation() {
    if (!selectedJudgeModel) {
      setOcrStartError("Choose a Gemini judge model.")
      return
    }

    setIsStartingOcr(true)
    setOcrStartError(null)
    try {
      const result = await startOcrEvaluation({
        data: {
          projectId,
          judgeModel: selectedJudgeModel,
          maxPdfs,
          maxPagesPerPdf,
          maxCostUsd: ocrMaxCostUsd,
        },
      })
      setOcrTaskId(result.task_id)
    } catch (error) {
      setOcrStartError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsStartingOcr(false)
    }
  }

  if (loadError || !project) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Prompt Engineering</h1>
        </div>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">{loadError || "Project not found."}</p>
            <Button onClick={() => void router.invalidate()}>Try again</Button>
            <Button variant="outline" asChild className="ml-2">
              <Link to="/projects">Back to Projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-muted-foreground text-sm">
          {project.description || "No description provided."}
        </p>
      </div>

      <ProjectTabs projectId={projectId} currentStep="engineering" />

      {/* Start optimization card */}
      {!taskId && (
        <Card>
          <CardHeader>
            <CardTitle>Prompt Optimization</CardTitle>
            <CardDescription>
              Automatically evaluate and refine NER extraction prompts using labeled documents as
              ground truth. The optimizer generates prompt variants, tests them against your
              annotations, and iteratively improves accuracy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {startError && (
              <div className="border-destructive/35 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
                {startError}
              </div>
            )}
            <Button onClick={handleStart} disabled={isStarting}>
              {isStarting ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <PlayIcon className="mr-2 h-4 w-4" />
                  Start Optimization
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Progress card */}
      {taskId && isRunning && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2Icon className="text-primary h-5 w-5 animate-spin" />
              Optimization In Progress
            </CardTitle>
            <CardDescription>
              Task ID: <span className="font-mono text-xs">{taskId}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {status?.progress
                    ? PHASE_LABELS[status.progress.phase] || status.progress.phase
                    : status?.status === "STARTED"
                      ? "Starting..."
                      : "Waiting..."}
                </span>
                <span className="text-muted-foreground">{status?.progress?.percent ?? 0}%</span>
              </div>
              <Progress value={status?.progress?.percent ?? 0} />
            </div>

            {status?.progress?.message && (
              <p className="text-muted-foreground text-sm">{status.progress.message}</p>
            )}

            {status?.progress?.details && (
              <ProgressDetails details={status.progress.details} phase={status.progress.phase} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Success card */}
      {taskId && status?.status === "SUCCESS" && status.result && (
        <Card className="border-emerald-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2Icon className="h-5 w-5" />
              Optimization Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">Best F1 Score</p>
                <p className="text-2xl font-bold">{(status.result.best_f1 * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">Cost Used</p>
                <p className="text-2xl font-bold">${Number(status.result.cost_usd).toFixed(2)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">Refinements Run</p>
                <p className="text-2xl font-bold">{status.result.iterations_run}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">Prompt ID</p>
                <p className="truncate font-mono text-sm">{status.result.best_prompt_id}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setTaskId(null)
                setStartError(null)
              }}
            >
              <RotateCcwIcon className="mr-2 h-4 w-4" />
              Run Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Failure card */}
      {taskId && status?.status === "FAILURE" && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <XCircleIcon className="h-5 w-5" />
              Optimization Failed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-destructive/35 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
              {status.error || "An unknown error occurred."}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setTaskId(null)
                setStartError(null)
              }}
            >
              <RotateCcwIcon className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {!ocrTaskId && (
        <Card>
          <CardHeader>
            <CardTitle>OCR Evaluation</CardTitle>
            <CardDescription>
              Compare OCR methods across a sample of project PDFs and store the worker evaluation
              run for review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ocrStartError && (
              <div className="border-destructive/35 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
                {ocrStartError}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ocr-judge-model">Judge model</Label>
                <Select value={selectedJudgeModel} onValueChange={setJudgeModel}>
                  <SelectTrigger id="ocr-judge-model" className="w-full">
                    <SelectValue placeholder="Choose a Gemini model" />
                  </SelectTrigger>
                  <SelectContent>
                    {googleModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {googleModels.length === 0 && (
                  <p className="text-muted-foreground text-xs">No available Google models found.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ocr-max-pdfs">Max PDFs</Label>
                <Input
                  id="ocr-max-pdfs"
                  min={1}
                  step={1}
                  type="number"
                  value={maxPdfs}
                  onChange={(event) => setMaxPdfs(Number(event.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ocr-max-pages">Pages per PDF</Label>
                <Input
                  id="ocr-max-pages"
                  min={1}
                  step={1}
                  type="number"
                  value={maxPagesPerPdf}
                  onChange={(event) => setMaxPagesPerPdf(Number(event.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ocr-max-cost">Max cost</Label>
                <Input
                  id="ocr-max-cost"
                  min={0.01}
                  step={0.01}
                  type="number"
                  value={ocrMaxCostUsd}
                  onChange={(event) => setOcrMaxCostUsd(Number(event.target.value))}
                />
              </div>
            </div>
            <Button
              onClick={handleStartOcrEvaluation}
              disabled={
                isStartingOcr ||
                !selectedJudgeModel ||
                maxPdfs <= 0 ||
                maxPagesPerPdf <= 0 ||
                ocrMaxCostUsd <= 0
              }
            >
              {isStartingOcr ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <PlayIcon className="mr-2 h-4 w-4" />
                  Start OCR Evaluation
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {ocrTaskId && isOcrRunning && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2Icon className="text-primary h-5 w-5 animate-spin" />
              OCR Evaluation In Progress
            </CardTitle>
            <CardDescription>
              Task ID: <span className="font-mono text-xs">{ocrTaskId}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {ocrStatus?.progress
                    ? PHASE_LABELS[ocrStatus.progress.phase] || ocrStatus.progress.phase
                    : ocrStatus?.status === "STARTED"
                      ? "Starting..."
                      : "Waiting..."}
                </span>
                <span className="text-muted-foreground">{ocrStatus?.progress?.percent ?? 0}%</span>
              </div>
              <Progress value={ocrStatus?.progress?.percent ?? 0} />
            </div>

            {ocrStatus?.progress?.message && (
              <p className="text-muted-foreground text-sm">{ocrStatus.progress.message}</p>
            )}

            {ocrStatus?.progress?.details && (
              <ProgressDetails
                details={ocrStatus.progress.details}
                phase={ocrStatus.progress.phase}
              />
            )}
          </CardContent>
        </Card>
      )}

      {ocrTaskId && ocrStatus?.status === "SUCCESS" && ocrStatus.result && (
        <Card className="border-emerald-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2Icon className="h-5 w-5" />
              OCR Evaluation Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">Recommendation</p>
                <p className="text-2xl font-bold capitalize">
                  {ocrStatus.result.recommendation.replaceAll("_", " ")}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">Confidence</p>
                <p className="text-2xl font-bold">
                  {(ocrStatus.result.confidence * 100).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">Pages Sampled</p>
                <p className="text-2xl font-bold">{ocrStatus.result.sampled_page_count}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">Cost Used</p>
                <p className="text-2xl font-bold">
                  ${Number(ocrStatus.result.cost_usd).toFixed(2)}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setOcrTaskId(null)
                setOcrStartError(null)
              }}
            >
              <RotateCcwIcon className="mr-2 h-4 w-4" />
              Run Again
            </Button>
          </CardContent>
        </Card>
      )}

      {ocrTaskId && ocrStatus?.status === "FAILURE" && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <XCircleIcon className="h-5 w-5" />
              OCR Evaluation Failed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-destructive/35 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
              {ocrStatus.error || "An unknown error occurred."}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setOcrTaskId(null)
                setOcrStartError(null)
              }}
            >
              <RotateCcwIcon className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ProgressDetails({
  details,
  phase,
}: {
  details: Record<string, string | number | boolean>
  phase: string
}) {
  if (phase === "evaluating_variant" || phase === "iteration_evaluated") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {details.variant != null && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">
              {phase === "evaluating_variant" ? "Variant" : "Iteration"}
            </p>
            <p className="text-lg font-semibold">
              {String(details.variant ?? details.iteration)}/{String(details.total_variants ?? "?")}
            </p>
          </div>
        )}
        {details.iteration != null && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Iteration</p>
            <p className="text-lg font-semibold">{String(details.iteration)}</p>
          </div>
        )}
        {details.cost_usd != null && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Cost</p>
            <p className="text-lg font-semibold">
              ${Number(details.cost_usd).toFixed(2)} / ${Number(details.max_cost_usd).toFixed(2)}
            </p>
          </div>
        )}
        {(details.f1 != null || details.refined_f1 != null) && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">F1 Score</p>
            <p className="text-lg font-semibold">
              {(Number(details.f1 ?? details.refined_f1) * 100).toFixed(1)}%
            </p>
          </div>
        )}
        {details.best_f1 != null && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Best F1</p>
            <p className="text-lg font-semibold">{(Number(details.best_f1) * 100).toFixed(1)}%</p>
          </div>
        )}
      </div>
    )
  }

  if (phase === "data_fetched") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">PDFs Loaded</p>
          <p className="text-lg font-semibold">{String(details.pdfs_loaded)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">Entity Types</p>
          <p className="text-lg font-semibold">{String(details.entity_types_count)}</p>
        </div>
      </div>
    )
  }

  if (phase === "sampling" || phase === "ocr" || phase === "complete") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {details.pdfs != null && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">PDFs</p>
            <p className="text-lg font-semibold">{String(details.pdfs)}</p>
          </div>
        )}
        {details.pages != null && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Pages</p>
            <p className="text-lg font-semibold">{String(details.pages)}</p>
          </div>
        )}
        {details.recommendation != null && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Recommendation</p>
            <p className="text-lg font-semibold capitalize">
              {String(details.recommendation).replaceAll("_", " ")}
            </p>
          </div>
        )}
        {details.confidence != null && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Confidence</p>
            <p className="text-lg font-semibold">
              {(Number(details.confidence) * 100).toFixed(1)}%
            </p>
          </div>
        )}
      </div>
    )
  }

  if (phase === "evaluating_current" || phase === "generating_refinement") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {details.iteration != null && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Iteration</p>
            <p className="text-lg font-semibold">{String(details.iteration)}</p>
          </div>
        )}
        {details.cost_usd != null && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Cost</p>
            <p className="text-lg font-semibold">
              ${Number(details.cost_usd).toFixed(2)} / ${Number(details.max_cost_usd).toFixed(2)}
            </p>
          </div>
        )}
        {details.best_f1 != null && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Best F1 So Far</p>
            <p className="text-lg font-semibold">{(Number(details.best_f1) * 100).toFixed(1)}%</p>
          </div>
        )}
      </div>
    )
  }

  return null
}
