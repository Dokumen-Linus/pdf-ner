import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { CheckCircle2Icon, Loader2Icon, PlayIcon, RotateCcwIcon, XCircleIcon } from "lucide-react"

import { getOptimizationStatus, startPromptOptimization } from "@/api-fns/engineering"
import { ProjectTabs } from "@/components/project-tabs"
import { Button } from "@/components/shadcn-ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn-ui/card"
import { Progress } from "@/components/shadcn-ui/progress"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { getProjectById } from "@/db-fns/web/projects"

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
        return { project: null, loadError: "Not authenticated" }
      }

      const project = await getProjectById({ data: { id: params.projectId } })
      return { project, loadError: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { project: null, loadError: message }
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
}

function EngineeringPage() {
  const router = useRouter()
  const { project, loadError } = Route.useLoaderData()
  const { projectId } = Route.useParams()

  const [taskId, setTaskId] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const { data: status } = useQuery({
    queryKey: ["optimization-status", taskId],
    queryFn: () => getOptimizationStatus({ data: { taskId: taskId! } }),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const s = query.state.data?.status
      if (s === "SUCCESS" || s === "FAILURE") return false
      return 2000
    },
  })

  const isRunning = !!taskId && status?.status !== "SUCCESS" && status?.status !== "FAILURE"

  async function handleStart() {
    setIsStarting(true)
    setStartError(null)
    try {
      const result = await startPromptOptimization({
        data: { projectId, maxIterations: 5, model: "gpt-4o" },
      })
      setTaskId(result.task_id)
    } catch (error) {
      setStartError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsStarting(false)
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
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">Best F1 Score</p>
                <p className="text-2xl font-bold">{(status.result.best_f1 * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">Iterations Run</p>
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
              {String(details.variant ?? details.iteration)}/
              {String(details.total_variants ?? details.max_iterations)}
            </p>
          </div>
        )}
        {details.iteration != null && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Iteration</p>
            <p className="text-lg font-semibold">
              {String(details.iteration)}/{String(details.max_iterations)}
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

  if (phase === "evaluating_current" || phase === "generating_refinement") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {details.iteration != null && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Iteration</p>
            <p className="text-lg font-semibold">
              {String(details.iteration)}/{String(details.max_iterations)}
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
