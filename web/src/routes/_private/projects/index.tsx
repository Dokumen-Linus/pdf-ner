import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/shadcn-ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/shadcn-ui/card"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { getAccessibleProjects } from "@/db-fns/web/projects"
import { m } from "@/integrations/paraglide/messages.js"

import type { FoundProject } from "@/db/types"

function ProjectsPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  )
}

export const Route = createFileRoute("/_private/projects/")({
  loader: async ({ context }) => {
    try {
      if (!context.session?.user?.id) {
        return {
          projects: [] as FoundProject[],
          loadError: "No authenticated session was found.",
        }
      }
      const projects = (await getAccessibleProjects()) as FoundProject[]
      return { projects, loadError: null as string | null }
    } catch (error) {
      void error
      return {
        projects: [] as FoundProject[],
        loadError: "We couldn't load your projects right now. Please try again.",
      }
    }
  },
  pendingComponent: ProjectsPageSkeleton,
  component: ProjectsPage,
})

function ProjectsPage() {
  const router = useRouter()
  const { projects, loadError } = Route.useLoaderData()

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{m.projects_list_title()}</h1>
          <p className="text-muted-foreground text-sm">{m.projects_list_no_description()}</p>
        </div>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">{m.projects_list_error_title()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">{loadError}</p>
            <Button onClick={() => void router.invalidate()}>
              {m.projects_list_error_retry()}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{m.projects_list_title()}</h1>
        <p className="text-muted-foreground text-sm">{m.projects_list_description()}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:bg-muted/50 flex h-full min-h-50 flex-col items-center justify-center border-dashed text-center transition-colors">
          <CardContent className="pt-6">
            <Button variant="ghost" className="h-auto flex-col gap-2 p-4" disabled>
              <div className="bg-primary/10 mb-2 rounded-full p-3">
                <PlusIcon className="text-primary h-6 w-6" />
              </div>
              <div className="text-lg font-semibold">{m.projects_list_create_button()}</div>
              <div className="text-muted-foreground text-sm font-normal">
                {m.projects_list_coming_soon()}
              </div>
            </Button>
          </CardContent>
        </Card>

        {projects.map((project: FoundProject) => (
          <Card key={project.id} className="flex h-full min-h-50 flex-col">
            <CardHeader>
              <CardTitle className="line-clamp-1" title={project.name}>
                {project.name}
              </CardTitle>
              <CardDescription className="line-clamp-2" title={project.description ?? ""}>
                {project.description || m.projects_list_no_description()}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="text-muted-foreground text-sm">
                <p>{m.projects_list_owner_you()}</p>
                {project.colorPresets && project.colorPresets.length > 0 && (
                  <p className="mt-1">
                    {m.projects_list_color_presets_count({ count: project.colorPresets.length })}
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/projects/$projectId" params={{ projectId: project.id }}>
                  {m.projects_list_open_button()}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
