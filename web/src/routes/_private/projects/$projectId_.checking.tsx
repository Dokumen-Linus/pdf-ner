import { createFileRoute, Link } from "@tanstack/react-router"

import { ShieldCheckIcon } from "@/components/icons"
import { ProjectTabs } from "@/components/project-tabs"
import { Button } from "@/components/shadcn-ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn-ui/card"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { getProjectById } from "@/db-fns/web/projects"
import { getAccuracyDataByProjectId } from "@/db-fns/core"
import { AccuracyTable } from "@/components/accuracy-table/accuracy-table"

function CheckingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}

export const Route = createFileRoute("/_private/projects/$projectId_/checking")({
  loader: async ({ params, context }) => {
    try {
      const userId = context.session?.user?.id
      if (!userId) {
        return { project: null, accuracyData: null, loadError: "Not authenticated" }
      }
      const project = await getProjectById({ data: { id: params.projectId } })
      const accuracyData = await getAccuracyDataByProjectId({
        data: { projectId: params.projectId },
      })
      return { project, accuracyData, loadError: null as string | null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { project: null, accuracyData: null, loadError: message }
    }
  },
  pendingComponent: CheckingSkeleton,
  component: CheckingPage,
})

function CheckingPage() {
  const { project, accuracyData, loadError } = Route.useLoaderData()
  const { projectId } = Route.useParams()

  if (loadError || !project) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-pretty">Checking</h1>
        </div>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">{loadError || "Project not found."}</p>
            <Button variant="outline" asChild>
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
        <h1 className="text-3xl font-semibold tracking-tight text-pretty" translate="no">
          {project.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          {project.description || "No description provided."}
        </p>
      </div>

      <ProjectTabs projectId={projectId} currentStep="checking" />

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <ShieldCheckIcon className="text-indigo-600 h-6 w-6 dark:text-indigo-400 shrink-0" aria-hidden="true" />
          <div>
            <CardTitle>Model Accuracy Dashboard</CardTitle>
            <CardDescription>
              Verify model prediction accuracy and reconcile disagreements against labeled ground truth.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {accuracyData && accuracyData.pdfs.length > 0 ? (
            <AccuracyTable
              pdfs={accuracyData.pdfs}
              entityValues={accuracyData.entityValues}
              entityTypes={accuracyData.entityTypes}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-xl bg-muted/10">
              <ShieldCheckIcon className="h-12 w-12 text-muted-foreground mb-4 opacity-75" />
              <h3 className="font-semibold text-lg text-foreground">No Accuracy Data Available</h3>
              <p className="text-sm text-muted-foreground max-w-md mt-2">
                This project has no labelled PDFs with predictions yet. Make sure you fully label some PDFs and run a model extraction first.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

