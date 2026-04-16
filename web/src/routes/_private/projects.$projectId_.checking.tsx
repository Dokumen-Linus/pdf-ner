import { createFileRoute, Link } from "@tanstack/react-router"
import { ShieldCheckIcon } from "lucide-react"
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

function CheckingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

export const Route = createFileRoute("/_private/projects/$projectId_/checking")({
  loader: async ({ params, context }) => {
    try {
      const userId = context.session?.user?.id
      if (!userId) {
        return { project: null, loadError: "Not authenticated" }
      }
      const project = await getProjectById({ data: { id: params.projectId } })
      return { project, loadError: null as string | null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { project: null, loadError: message }
    }
  },
  pendingComponent: CheckingSkeleton,
  component: CheckingPage,
})

function CheckingPage() {
  const { project, loadError } = Route.useLoaderData()
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
            <p className="text-sm text-muted-foreground">{loadError || "Project not found."}</p>
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
        <p className="text-sm text-muted-foreground">
          {project.description || "No description provided."}
        </p>
      </div>

      <ProjectTabs projectId={projectId} currentStep="checking" />

      <Card className="border-dashed">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <ShieldCheckIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <div>
            <CardTitle>Checking</CardTitle>
            <CardDescription>
              Verify extracted entities and reconcile disagreements across annotators.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">This step is not yet implemented.</p>
        </CardContent>
      </Card>
    </div>
  )
}
