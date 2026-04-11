import { useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { CheckCircle2Icon, FileTextIcon, LayoutDashboardIcon, Loader2Icon, PlusIcon, RefreshCwIcon, SettingsIcon, UploadIcon } from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/shadcn-ui/alert-dialog"
import { Button } from "@/components/shadcn-ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn-ui/card"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn-ui/table"
import { getWorkersPdfsByProjectId } from "@/db-fns/web/pdfs"
import { workersPdfs } from "@/db/schemas/workers/pdfs"
import { getProjectById } from "@/db-fns/web/projects"
import { UploadDropzone } from "@/integrations/uploadthing/components-hooks"

function DocumentsSkeleton() {
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
        <Skeleton className="col-span-3 h-64 rounded-xl" />
      </div>
    </div>
  )
}

export const Route = createFileRoute("/_private/new-pages/projects/$projectId_/documents")({
  loader: async ({ params, context }) => {
    try {
      const email = context.session?.user?.email
      if (!email) {
        return { project: null, pdfs: null, loadError: "Not authenticated" }
      }

      const [project, rawPdfs] = await Promise.all([
        getProjectById({ data: { id: params.projectId } }),
        getWorkersPdfsByProjectId({ data: { projectId: params.projectId } }) as Promise<(typeof workersPdfs.$inferSelect)[]>,
      ])

      const mappedPdfs = rawPdfs.map((pdf) => ({
        id: pdf.id,
        name: pdf.name,
        extractMethod: pdf.extractMethod,
        isProcessed: !!pdf.fullText || !!pdf.predictedEntities,
        createdAt: pdf.createdAt,
      }))

      return { project, pdfs: mappedPdfs, loadError: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { project: null, pdfs: null, loadError: message }
    }
  },
  pendingComponent: DocumentsSkeleton,
  component: DocumentsPage,
})

function DocumentsPage() {
  const router = useRouter()
  const { project, pdfs, loadError } = Route.useLoaderData()
  const { projectId } = Route.useParams()
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  if (loadError || !project || !pdfs) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Project Documents</h1>
        </div>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {loadError || "Project or documents not found."}
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

  // Sort pdfs by newest first
  const sortedPdfs = [...pdfs].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return timeB - timeA
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.description || "No description provided."}
          </p>
        </div>

        <AlertDialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <AlertDialogTrigger asChild>
            <Button size="lg" className="shadow-sm">
              <PlusIcon className="mr-2 h-5 w-5" />
              Upload PDF
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Upload Document</AlertDialogTitle>
              <AlertDialogDescription>
                Drag and drop a PDF to add it to this project.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <UploadDropzone
                endpoint="documentUploader"
                input={{ projectId }}
                onClientUploadComplete={() => {
                  setIsUploadOpen(false)
                  void router.invalidate()
                }}
                onUploadError={(error) => {
                  console.error("Upload error:", error)
                }}
                appearance={{
                  container: "w-full border-2 border-dashed border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors p-8 rounded-lg cursor-pointer",
                  label: "text-primary hover:text-primary/90 font-medium",
                  button: "bg-primary text-primary-foreground hover:bg-primary/90 ut-readying:bg-primary/90 px-6 py-2.5 h-auto text-sm font-semibold rounded-md shadow-sm mt-4",
                  allowedContent: "text-xs text-muted-foreground mt-1",
                }}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
        <Link
          to="/projects/$projectId/dashboard"
          params={{ projectId }}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-all"
        >
          <LayoutDashboardIcon className="mr-2 h-4 w-4" />
          Dashboard
        </Link>
        <div className="inline-flex items-center justify-center whitespace-nowrap rounded-t-lg border-b-2 border-primary bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground transition-all">
          <FileTextIcon className="mr-2 h-4 w-4 text-primary" />
          Documents
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4">
            <div className="space-y-1">
              <CardTitle className="text-lg">Project Documents</CardTitle>
              <CardDescription className="text-xs">
                {sortedPdfs.length} PDFs associated with this project.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-8" onClick={() => void router.invalidate()}>
              <RefreshCwIcon className="mr-2 h-3 w-3" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="p-0 border-t">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="py-3 px-6 h-auto text-xs font-semibold uppercase tracking-wider">Filename</TableHead>
                    <TableHead className="py-3 px-4 h-auto text-xs font-semibold uppercase tracking-wider text-center">Source</TableHead>
                    <TableHead className="py-3 px-4 h-auto text-xs font-semibold uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="py-3 px-6 h-auto text-xs font-semibold uppercase tracking-wider text-right">Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPdfs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <UploadIcon className="h-8 w-8 opacity-20" />
                          <p>No documents found. Start by uploading one.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedPdfs.map((pdf) => {
                      const timestamp = pdf.createdAt ? new Date(pdf.createdAt).toLocaleDateString() : "Unknown"

                      return (
                        <TableRow key={pdf.id} className="group hover:bg-muted/20 transition-colors">
                          <TableCell className="py-4 px-6 font-medium">{pdf.name}</TableCell>
                          <TableCell className="py-4 px-4 text-center">
                            <span className="capitalize px-2 py-1 rounded bg-muted/40 text-[11px] font-medium text-muted-foreground border border-border/40">
                              {pdf.extractMethod || "upload"}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex justify-center">
                              {pdf.isProcessed ? (
                                <div className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                  <CheckCircle2Icon className="mr-1 h-3 w-3" />
                                  Processed
                                </div>
                              ) : (
                                <div className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-blue-500/10 text-blue-600 border-blue-500/20">
                                  <Loader2Icon className="mr-1 h-3 w-3 animate-spin" />
                                  Processing
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6 text-right text-xs text-muted-foreground tabular-nums">
                            {timestamp}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
