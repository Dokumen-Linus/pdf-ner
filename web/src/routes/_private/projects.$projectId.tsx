import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { ChevronRightIcon } from "lucide-react"
import { PROJECT_STEPS, ProjectTabs } from "@/components/project-tabs"
import { Badge } from "@/components/shadcn-ui/badge"
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
import { m } from "@/integrations/paraglide/messages.js"
import { cn } from "@/lib/shadcn-ui/utils"

// One-line blurb per step shown on the wizard hub cards.
const STEP_DESCRIPTIONS: Record<string, string> = {
  documents: "Upload PDFs and manage the document set for this project.",
  entity_types: "Define project settings and the entity types to extract.",
  labelling: "Review each PDF and tag entity spans to build ground truth.",
  engineering: "Optimize prompts and run NER experiments against labelled data.",
  checking: "Verify extracted entities and reconcile disagreements.",
  dashboard: "Review project stats, annotation breakdowns, and progress.",
}

function ProjectHubSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export const Route = createFileRoute("/_private/projects/$projectId")({
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
  pendingComponent: ProjectHubSkeleton,
  component: ProjectHubPage,
})

function ProjectHubPage() {
  const router = useRouter()
  const { project, loadError } = Route.useLoaderData()

  if (loadError || !project) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-pretty">
            {m.projects_details_title()}
          </h1>
        </div>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">{m.projects_details_error_title()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {loadError || m.projects_details_error_not_found()}
            </p>
            <Button onClick={() => void router.invalidate()}>
              {m.projects_details_error_retry()}
            </Button>
            <Button variant="outline" asChild className="ml-2">
              <Link to="/projects">{m.projects_details_back_button()}</Link>
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

      <ProjectTabs projectId={project.id} currentStep={null} />

      <ol className="grid list-none gap-4 sm:grid-cols-2" aria-label="Project workflow steps">
        {PROJECT_STEPS.map((step) => {
          const Icon = step.icon
          const description = STEP_DESCRIPTIONS[step.key] ?? ""
          const isDisabled = step.disabled || step.to === null

          const cardInner = (
            <Card
              className={cn(
                "h-full transition-colors",
                isDisabled
                  ? "border-dashed bg-muted/20"
                  : "hover:border-primary/60 hover:bg-muted/30",
              )}
            >
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                    isDisabled
                      ? "bg-muted text-muted-foreground/70"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {step.n}
                </span>
                <div className="flex-1 space-y-1 min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "h-4 w-4",
                        isDisabled ? "text-muted-foreground" : "text-primary",
                      )}
                    />
                    <span className="truncate">{step.label}</span>
                    {isDisabled && (
                      <Badge
                        variant="secondary"
                        className="ml-auto px-1.5 py-0 text-[10px] font-normal"
                      >
                        Coming soon
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">{description}</CardDescription>
                </div>
                {!isDisabled && (
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="mt-1 h-5 w-5 shrink-0 text-muted-foreground"
                  />
                )}
              </CardHeader>
            </Card>
          )

          return (
            <li key={step.key}>
              {isDisabled || step.to === null ? (
                <div aria-disabled="true">{cardInner}</div>
              ) : (
                <Link
                  to={step.to}
                  params={{ projectId: project.id }}
                  className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {cardInner}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
