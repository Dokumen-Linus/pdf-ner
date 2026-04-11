import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { FilesIcon, FileTextIcon, LayoutDashboardIcon, SettingsIcon, TagIcon } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"
import { Button } from "@/components/shadcn-ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn-ui/card"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { getProjectDashboardStats } from "@/db-fns/web/dashboard"
import { getProjectById } from "@/db-fns/web/projects"

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
      <Skeleton className="h-96 rounded-xl w-full" />
    </div>
  )
}

export const Route = createFileRoute("/_private/new-pages/projects/$projectId_/dashboard")({
  loader: async ({ params, context }) => {
    try {
      const email = context.session?.user?.email
      if (!email) {
        return { project: null, stats: null, loadError: "Not authenticated" }
      }

      const [project, stats] = await Promise.all([
        getProjectById({ data: { id: params.projectId } }),
        getProjectDashboardStats({ data: { projectId: params.projectId } }),
      ])

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
          <h1 className="text-3xl font-semibold tracking-tight">Project Dashboard</h1>
        </div>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {loadError || "Project or stats not found."}
            </p>
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
        <p className="text-sm text-muted-foreground">
          {project.description || "No description provided."}
        </p>
      </div>

      <div className="flex space-x-1 border-b pb-px overflow-x-auto">
        <Link
          to="/projects/$projectId"
          params={{ projectId }}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-all"
        >
          <SettingsIcon className="mr-2 h-4 w-4" />
          Overview
        </Link>
        <div className="inline-flex items-center justify-center whitespace-nowrap rounded-t-lg border-b-2 border-primary bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground transition-all">
          <LayoutDashboardIcon className="mr-2 h-4 w-4 text-primary" />
          Dashboard
        </div>
        <Link
          to="/projects/$projectId/documents"
          params={{ projectId }}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-all"
        >
          <FileTextIcon className="mr-2 h-4 w-4" />
          Documents
        </Link>
      </div>

      {stats.totalDocuments === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <div className="rounded-full bg-primary/10 p-4 mb-4">
            <LayoutDashboardIcon className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold tracking-tight mb-2">No data available</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Upload and process documents in this project to see extraction statistics and charts
            here.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                <FilesIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalDocuments}</div>
                <p className="text-xs text-muted-foreground">PDFs in this project</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Annotations</CardTitle>
                <TagIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalAnnotations}</div>
                <p className="text-xs text-muted-foreground">Extracted entities</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Entity Types</CardTitle>
                <SettingsIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.entityTypeBreakdown.length}</div>
                <p className="text-xs text-muted-foreground">Unique entity categories found</p>
              </CardContent>
            </Card>
          </div>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Entity Distribution</CardTitle>
              <CardDescription>Breakdown of all extracted entities by type.</CardDescription>
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
                <div className="flex h-62.5 items-center justify-center text-sm text-muted-foreground">
                  No entities extracted yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
