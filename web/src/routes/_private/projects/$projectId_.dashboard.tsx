import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { FilesIcon, LayoutDashboardIcon, SettingsIcon, TagIcon } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

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
import { getCorePdfIdsByProjectId } from "@/db-fns/core/pdfs"
import { getAnnotationsByPdfIds } from "@/db-fns/web/annotations"
import { getEntityTypesByProjectId } from "@/db-fns/web/entity-types"
import { getProjectById } from "@/db-fns/web/projects"
import { m } from "@/integrations/paraglide/messages.js"

function DashboardSkeleton() {
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
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  )
}

export const Route = createFileRoute("/_private/projects/$projectId_/dashboard")({
  loader: async ({ params, context }) => {
    try {
      const userId = context.session?.user?.id
      if (!userId) {
        return { project: null, stats: null, loadError: "Not authenticated" }
      }

      const [project, pdfRows, entityTypesList] = await Promise.all([
        getProjectById({ data: { id: params.projectId } }),
        getCorePdfIdsByProjectId({ data: { projectId: params.projectId } }),
        getEntityTypesByProjectId({ data: { projectId: params.projectId } }),
      ])

      const pdfIds = pdfRows.map((p) => p.id)
      const projectAnnotations = await getAnnotationsByPdfIds({ data: { pdfIds } })

      const entityTypeMap = new Map(entityTypesList.map((t) => [t.id, t.name]))

      const breakdownMap = new Map<string, number>()
      for (const ann of projectAnnotations) {
        const typeKey = ann.customEntityType || ann.subtype || "Unknown"
        const displayName = entityTypeMap.get(typeKey) || typeKey
        breakdownMap.set(displayName, (breakdownMap.get(displayName) || 0) + 1)
      }

      const stats = {
        totalDocuments: pdfIds.length,
        totalAnnotations: projectAnnotations.length,
        entityTypeBreakdown: Array.from(breakdownMap.entries()).map(([name, count]) => ({
          name,
          count,
        })),
      }

      return { project, stats, loadError: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { project: null, stats: null, loadError: message }
    }
  },
  pendingComponent: DashboardSkeleton,
  component: DashboardPage,
})

function DashboardPage() {
  const router = useRouter()
  const { project, stats, loadError } = Route.useLoaderData()
  const { projectId } = Route.useParams()

  if (loadError || !project || !stats) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{m.projects_dashboard_title()}</h1>
        </div>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">{m.projects_dashboard_error_title()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {loadError || m.projects_dashboard_error_not_found()}
            </p>
            <Button onClick={() => void router.invalidate()}>
              {m.projects_dashboard_error_retry()}
            </Button>
            <Button variant="outline" asChild className="ml-2">
              <Link to="/projects">{m.projects_dashboard_back_button()}</Link>
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

      <ProjectTabs projectId={projectId} currentStep="dashboard" />

      {stats.totalDocuments === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
          <div className="bg-primary/10 mb-4 rounded-full p-4">
            <LayoutDashboardIcon className="text-primary h-8 w-8" />
          </div>
          <h3 className="mb-2 text-xl font-semibold tracking-tight">
            {m.projects_dashboard_empty_title()}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm text-sm">
            {m.projects_dashboard_empty_description()}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {m.projects_dashboard_stats_docs_title()}
                </CardTitle>
                <FilesIcon className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalDocuments}</div>
                <p className="text-muted-foreground text-xs">
                  {m.projects_dashboard_stats_docs_description()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {m.projects_dashboard_stats_ann_title()}
                </CardTitle>
                <TagIcon className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalAnnotations}</div>
                <p className="text-muted-foreground text-xs">
                  {m.projects_dashboard_stats_ann_description()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{m.projects_list_title()}</CardTitle>
                <SettingsIcon className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.entityTypeBreakdown.length}</div>
                <p className="text-muted-foreground text-xs">
                  {m.projects_dashboard_stats_types_description()}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>{m.projects_dashboard_chart_title()}</CardTitle>
              <CardDescription>{m.projects_dashboard_chart_description()}</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.entityTypeBreakdown.length > 0 ? (
                <div className="h-87.5 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.entityTypeBreakdown}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        angle={-45}
                        textAnchor="end"
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                      />
                      <RechartsTooltip
                        cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-muted-foreground flex h-62.5 items-center justify-center text-sm">
                  {m.projects_dashboard_chart_empty()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
