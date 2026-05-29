import { useState } from "react"
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router"
import { z } from "zod"

import { LoaderCircleIcon, PlusIcon } from "@/components/icons"
import { Button } from "@/components/shadcn-ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/shadcn-ui/card"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn-ui/select"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { getCurrentUserOrganization } from "@/db-fns/web/organizations"
import { createProject, getProjectsByOwnerId, getProjectsByTeamId } from "@/db-fns/web/projects"
import { getCurrentUserTeamsByOrganizationId } from "@/db-fns/web/teams"
import { getUserByAuthUserId } from "@/db-fns/web/users"
import { m } from "@/integrations/paraglide/messages.js"

import type { Project } from "@/db/types"

type ProjectUser = Awaited<ReturnType<typeof getUserByAuthUserId>>
type ProjectOrganization = Awaited<ReturnType<typeof getCurrentUserOrganization>>
type ProjectTeam = Awaited<ReturnType<typeof getCurrentUserTeamsByOrganizationId>>[number]

const ProjectsSearchSchema = z.object({
  teamId: z.string().optional(),
})

function ProjectsPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-72" />
      </div>
      <Skeleton className="h-56 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  )
}

export const Route = createFileRoute("/_private/projects/")({
  validateSearch: ProjectsSearchSchema,
  loader: async ({ context, location }) => {
    try {
      const authUserId = context.session?.user?.id
      if (!authUserId) {
        return {
          user: null as ProjectUser | null,
          organization: null as ProjectOrganization,
          teams: [] as ProjectTeam[],
          selectedTeamId: null as string | null,
          projects: [] as Project[],
          loadError: "No authenticated session was found.",
        }
      }

      const user = await getUserByAuthUserId({ data: { authUserId } })
      const organization = await getCurrentUserOrganization()
      const teams = organization?.id
        ? ((await getCurrentUserTeamsByOrganizationId({
            data: { organizationId: organization.id },
          })) as ProjectTeam[])
        : []

      const requestedTeamId = ProjectsSearchSchema.parse(location.search).teamId
      const validTeamIds = new Set(teams.map((team) => team.id))
      const selectedTeamId =
        teams.length > 0
          ? requestedTeamId && validTeamIds.has(requestedTeamId)
            ? requestedTeamId
            : teams[0]!.id
          : null

      const projects = selectedTeamId
        ? ((await getProjectsByTeamId({ data: { teamId: selectedTeamId } })) as Project[])
        : organization
          ? ([] as Project[])
          : ((await getProjectsByOwnerId({ data: { ownerId: user.id } })) as Project[])

      return {
        user,
        organization,
        teams,
        selectedTeamId,
        projects,
        loadError: null as string | null,
      }
    } catch (error) {
      void error
      return {
        user: null as ProjectUser | null,
        organization: null as ProjectOrganization,
        teams: [] as ProjectTeam[],
        selectedTeamId: null as string | null,
        projects: [] as Project[],
        loadError: "We couldn't load your projects right now. Please try again.",
      }
    }
  },
  pendingComponent: ProjectsPageSkeleton,
  component: ProjectsPage,
})

function ProjectsPage() {
  const router = useRouter()
  const navigate = useNavigate()
  const { user, organization, teams, selectedTeamId, projects, loadError } = Route.useLoaderData()
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreatingProject, setIsCreatingProject] = useState(false)

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null
  const scopeLabel = selectedTeam
    ? selectedTeam.name
    : organization
      ? "No team selected"
      : "Personal workspace"
  const canCreateProjectForRole =
    user?.role === "individual" || user?.role === "admin" || user?.role === "developer"
  const canCreateProject = canCreateProjectForRole && (!organization || selectedTeam != null)

  const handleTeamChange = async (nextTeamId: string) => {
    setCreateError(null)
    await navigate({
      to: "/projects",
      search: { teamId: nextTeamId },
    })
  }

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const trimmedName = projectName.trim()
    const trimmedDescription = projectDescription.trim()

    if (!trimmedName) {
      setCreateError("Project name is required.")
      return
    }

    if (organization && !selectedTeamId) {
      setCreateError("Choose a team before creating a project.")
      return
    }

    setCreateError(null)
    setIsCreatingProject(true)
    try {
      await createProject({
        data: {
          name: trimmedName,
          description: trimmedDescription || undefined,
          ownerTeamId: selectedTeamId ?? undefined,
        },
      })
      setProjectName("")
      setProjectDescription("")
      await router.invalidate()
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create project")
    } finally {
      setIsCreatingProject(false)
    }
  }

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

      {canCreateProjectForRole && (
        <Card>
          <CardHeader className="space-y-4">
            <div className="space-y-1">
              <CardTitle>Create Project</CardTitle>
              <CardDescription>
                {organization
                  ? `Projects in ${organization.name} are owned by the selected team.`
                  : "You are creating projects in your personal workspace."}
              </CardDescription>
            </div>

            {organization ? (
              <div className="space-y-1.5">
                <Label htmlFor="project-scope-team">Team</Label>
                <Select value={selectedTeamId ?? undefined} onValueChange={handleTeamChange}>
                  <SelectTrigger id="project-scope-team" className="w-full sm:w-80">
                    <SelectValue placeholder="Choose a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateProject}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="project-name">Project name</Label>
                  <Input
                    id="project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Vendor contracts"
                    disabled={isCreatingProject || !canCreateProject}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ownership scope</Label>
                  <div className="text-muted-foreground rounded-md border px-3 py-2 text-sm">
                    {scopeLabel}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                  id="project-description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Optional description"
                  disabled={isCreatingProject || !canCreateProject}
                />
              </div>

              {createError && (
                <div className="border-destructive/35 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
                  {createError}
                </div>
              )}

              {!canCreateProject && organization && (
                <p className="text-muted-foreground text-sm">
                  Create or join a team before creating projects in this organization.
                </p>
              )}

              <Button type="submit" disabled={isCreatingProject || !canCreateProject || !user}>
                {isCreatingProject ? (
                  <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlusIcon className="mr-2 h-4 w-4" />
                )}
                {isCreatingProject ? "Creating project..." : m.projects_list_create_button()}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">
              {organization
                ? `No projects exist for ${scopeLabel} yet.`
                : "You don't have any projects yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project: Project) => (
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
                  <p>{selectedTeam ? `Team: ${selectedTeam.name}` : m.projects_list_owner_you()}</p>
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
      )}
    </div>
  )
}
