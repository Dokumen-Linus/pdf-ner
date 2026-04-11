import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import {
  CalendarIcon,
  CodeIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  TagIcon,
} from "lucide-react"
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
import { getPromptsByProjectId } from "@/db-fns/api/prompts"
import { getAllTemplates } from "@/db-fns/public/templates"
import { getEntityTypesByProjectId } from "@/db-fns/web/entity-types"
import { getProjectById } from "@/db-fns/web/projects"
import type { FoundDbEntityType, FoundPrompt, FoundTemplate } from "@/db/types"

// Use a skeleton for loaders
function ProjectDetailsPageSkeleton() {
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
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}

export const Route = createFileRoute("/_private/projects/$projectId")({
  loader: async ({ params, context }) => {
    try {
      const userId = context.session?.user?.id
      if (!userId) {
        return {
          project: null,
          entityTypes: [] as FoundDbEntityType[],
          prompts: [] as FoundPrompt[],
          templates: [] as FoundTemplate[],
          loadError: "Not authenticated",
        }
      }

      const project = await getProjectById({ data: { id: params.projectId } })

      const [entityTypes, prompts, templates] = (await Promise.all([
        getEntityTypesByProjectId({ data: { projectId: params.projectId } }),
        getPromptsByProjectId({ data: { projectId: params.projectId } }),
        getAllTemplates(),
      ])) as [FoundDbEntityType[], FoundPrompt[], FoundTemplate[]]

      return { project, entityTypes, prompts, templates, loadError: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        project: null,
        entityTypes: [] as FoundDbEntityType[],
        prompts: [] as FoundPrompt[],
        templates: [] as FoundTemplate[],
        loadError: message,
      }
    }
  },
  pendingComponent: ProjectDetailsPageSkeleton,
  component: ProjectDetailsPage,
})

function ProjectDetailsPage() {
  const router = useRouter()
  const { project, entityTypes, prompts, templates, loadError } = Route.useLoaderData()

  if (loadError || !project) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Project Details</h1>
        </div>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{loadError || "Project not found."}</p>
            <Button onClick={() => void router.invalidate()}>Try again</Button>
            <Button variant="outline" asChild className="ml-2">
              <Link to="/projects">Back to Projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Find matching templates for the prompts
  const activeTemplates = prompts
    .map((prompt: FoundPrompt) => templates.find((t: FoundTemplate) => t.id === prompt.templateId))
    .filter((t): t is FoundTemplate => Boolean(t))

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          {project.description || "No description provided."}
        </p>
      </div>

      <div className="flex space-x-1 border-b pb-px overflow-x-auto">
        <div className="inline-flex items-center justify-center whitespace-nowrap rounded-t-lg border-b-2 border-primary bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground transition-all">
          <SettingsIcon className="mr-2 h-4 w-4 text-primary" />
          Overview
        </div>
        <Link
          to="/projects/$projectId/dashboard"
          params={{ projectId: project.id }}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-all"
        >
          <LayoutDashboardIcon className="mr-2 h-4 w-4" />
          Dashboard
        </Link>
        <Link
          to="/projects/$projectId/documents"
          params={{ projectId: project.id }}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-all"
        >
          <FileTextIcon className="mr-2 h-4 w-4" />
          Documents
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-primary" />
              Project Settings
            </CardTitle>
            <CardDescription>Basic configuration and properties</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
              <div>
                <span className="text-muted-foreground block mb-1">Orientation</span>
                <span className="font-medium capitalize">{project.orientation}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Color Presets</span>
                <span className="font-medium">{project.colorPresets?.length || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1 mb-1">
                  <CalendarIcon className="h-3 w-3" />
                  Created
                </span>
                <span className="font-medium">
                  {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : "Unknown"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1 mb-1">
                  <CalendarIcon className="h-3 w-3" />
                  Updated
                </span>
                <span className="font-medium">
                  {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : "Unknown"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <TagIcon className="h-5 w-5 text-primary" />
                  Entity Types
                </CardTitle>
                <CardDescription>Entities being extracted</CardDescription>
              </div>
              <Badge variant="secondary">{entityTypes.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {entityTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entity types defined yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {entityTypes.map((et: FoundDbEntityType) => (
                  <div
                    key={et.id}
                    className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm"
                  >
                    <span className="font-medium">{et.name}</span>
                    <div className="flex gap-2">
                      {et.required && (
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                          Required
                        </Badge>
                      )}
                      {et.unique && (
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                          Unique
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <CodeIcon className="h-5 w-5 text-primary" />
                  Templates
                </CardTitle>
                <CardDescription>Extraction templates applied to this project</CardDescription>
              </div>
              <Badge variant="secondary">{activeTemplates.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {activeTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates linked to this project.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeTemplates.map((template: FoundTemplate) => (
                  <div
                    key={template!.id}
                    className="space-y-2 rounded-lg border border-border bg-muted/20 p-4"
                  >
                    <div className="text-sm font-medium">Template #{template!.id}</div>
                    <div className="line-clamp-3 text-xs text-muted-foreground">
                      {template!.txt}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {template!.inserts?.slice(0, 3).map((insert: string, i: number) => (
                        <Badge key={i} variant="secondary" className="px-1.5 py-0 text-[10px]">
                          {insert}
                        </Badge>
                      ))}
                      {template!.inserts && template!.inserts.length > 3 && (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                          +{template!.inserts.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
