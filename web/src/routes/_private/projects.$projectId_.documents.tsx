import { useRef, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import axios, { AxiosError } from "axios"
import {
  CheckCircle2Icon,
  FileTextIcon,
  FileUp,
  LayoutDashboardIcon,
  Loader2,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  SettingsIcon,
  UploadIcon,
} from "lucide-react"
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
import { Progress } from "@/components/shadcn-ui/progress"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn-ui/table"
import { getProjectById } from "@/db-fns/web/projects"
import { getWorkersPdfsByProjectId } from "@/db-fns/workers/pdfs"
import type { FoundWorkersPdf } from "@/db/types"
import { m } from "@/paraglide/messages.js"

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

export const Route = createFileRoute("/_private/projects/$projectId_/documents")({
  loader: async ({ params, context }) => {
    try {
      const userId = context.session?.user?.id
      if (!userId) {
        return { project: null, pdfs: null, loadError: "Not authenticated" }
      }

      const project = await getProjectById({ data: { id: params.projectId } })
      const rawPdfs = await getWorkersPdfsByProjectId({
        data: { projectId: params.projectId },
      })

      const mappedPdfs = (rawPdfs as FoundWorkersPdf[]).map((pdf) => ({
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [clientValidationError, setClientValidationError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!project?.bucketId) throw new Error("missing bucket")
      setUploadProgress(0)
      const query = new URLSearchParams({
        project_id: projectId,
        bucket_id: project.bucketId,
      }).toString()
      const res = await axios.post(`/api/pdf-upload?${query}`, file, {
        headers: {
          "Content-Type": "application/pdf",
          "X-Filename": encodeURIComponent(file.name),
        },
        onUploadProgress: (event) => {
          if (event.total) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100))
          }
        },
      })
      return res.data
    },
    onSuccess: () => {
      setSelectedFile(null)
      setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ""
      setIsUploadOpen(false)
      void router.invalidate()
    },
  })

  const uploadErrorMessage = (() => {
    if (clientValidationError) return clientValidationError
    const err = uploadMutation.error
    if (!err) return null
    if (err instanceof AxiosError) {
      return err.response?.data?.detail ?? err.message ?? m.projects_docs_upload_error_failed()
    }
    return err instanceof Error ? err.message : m.projects_docs_upload_error_failed()
  })()

  if (loadError || !project || !pdfs) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{m.projects_docs_title()}</h1>
        </div>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">{m.projects_docs_error_title()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {loadError || m.projects_docs_error_not_found()}
            </p>
            <Button onClick={() => void router.invalidate()}>
              {m.projects_docs_error_retry()}
            </Button>
            <Button variant="outline" asChild className="ml-2">
              <Link to="/projects">{m.projects_docs_back_button()}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setClientValidationError(null)
    uploadMutation.reset()

    if (file && file.type !== "application/pdf") {
      setClientValidationError(m.projects_docs_upload_error_not_pdf())
      setSelectedFile(null)
      return
    }

    if (file && file.size > 50 * 1024 * 1024) {
      setClientValidationError(m.projects_docs_upload_error_too_large())
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }

  const handleUpload = () => {
    if (!selectedFile || !project.bucketId) return
    setClientValidationError(null)
    uploadMutation.mutate(selectedFile)
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

        <AlertDialog
          open={isUploadOpen}
          onOpenChange={(open) => {
            // Block closing the dialog while an upload is in flight — cancelling
            // mid-stream would leave an orphaned S3 multipart upload. axios has
            // no cancel support wired up here, so the safest UX is "locked".
            if (!open && uploadMutation.isPending) return
            setIsUploadOpen(open)
            if (!open) {
              setSelectedFile(null)
              setClientValidationError(null)
              setUploadProgress(0)
              uploadMutation.reset()
              if (fileInputRef.current) fileInputRef.current.value = ""
            }
          }}
        >
          <AlertDialogTrigger asChild>
            <Button size="lg" className="shadow-sm" disabled={!project.bucketId}>
              <PlusIcon className="mr-2 h-5 w-5" />
              {m.projects_docs_upload_button()}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>{m.projects_docs_upload_modal_title()}</AlertDialogTitle>
              <AlertDialogDescription>
                {m.projects_docs_upload_modal_description()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-4">
              <div
                className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border/60 bg-muted/20 p-8 transition-colors hover:bg-muted/30"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click()
                }}
                role="button"
                tabIndex={0}
              >
                <FileUp className="h-10 w-10 text-muted-foreground" />
                {selectedFile ? (
                  <div className="text-center">
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {m.projects_docs_upload_modal_placeholder()}
                  </p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              {uploadErrorMessage && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3">
                  <p className="text-sm font-medium text-destructive">{uploadErrorMessage}</p>
                </div>
              )}

              {uploadMutation.isPending && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} />
                  <p className="text-right text-xs tabular-nums text-muted-foreground">
                    {uploadProgress}%
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                disabled={!selectedFile || uploadMutation.isPending}
                onClick={handleUpload}
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {m.projects_docs_upload_button_loading()}
                  </>
                ) : (
                  <>
                    <UploadIcon className="mr-2 h-4 w-4" />
                    {m.projects_docs_upload_button()}
                  </>
                )}
              </Button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={uploadMutation.isPending}>
                {m.projects_docs_upload_modal_close()}
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {!project.bucketId && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{m.projects_docs_no_bucket_error()}</p>
        </div>
      )}

      <div className="flex space-x-1 border-b pb-px overflow-x-auto">
        <Link
          to="/projects/$projectId"
          params={{ projectId }}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-all"
        >
          <SettingsIcon className="mr-2 h-4 w-4" />
          {m.projects_details_tab_overview()}
        </Link>
        <Link
          to="/projects/$projectId/dashboard"
          params={{ projectId }}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-all"
        >
          <LayoutDashboardIcon className="mr-2 h-4 w-4" />
          {m.projects_details_tab_dashboard()}
        </Link>
        <div className="inline-flex items-center justify-center whitespace-nowrap rounded-t-lg border-b-2 border-primary bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground transition-all">
          <FileTextIcon className="mr-2 h-4 w-4 text-primary" />
          {m.projects_details_tab_documents()}
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4">
            <div className="space-y-1">
              <CardTitle className="text-lg">{m.projects_docs_title()}</CardTitle>
              <CardDescription className="text-xs">
                {m.projects_docs_list_count({ count: sortedPdfs.length })}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => void router.invalidate()}
            >
              <RefreshCwIcon className="mr-2 h-3 w-3" />
              {m.projects_docs_refresh_button()}
            </Button>
          </CardHeader>
          <CardContent className="p-0 border-t">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="py-3 px-6 h-auto text-xs font-semibold uppercase tracking-wider">
                      {m.projects_docs_table_col_name()}
                    </TableHead>
                    <TableHead className="py-3 px-4 h-auto text-xs font-semibold uppercase tracking-wider text-center">
                      {m.projects_docs_table_col_source()}
                    </TableHead>
                    <TableHead className="py-3 px-4 h-auto text-xs font-semibold uppercase tracking-wider text-center">
                      {m.projects_docs_table_col_status()}
                    </TableHead>
                    <TableHead className="py-3 px-6 h-auto text-xs font-semibold uppercase tracking-wider text-right">
                      {m.projects_docs_table_col_date()}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPdfs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <UploadIcon className="h-8 w-8 opacity-20" />
                          <p>{m.projects_docs_list_empty()}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedPdfs.map((pdf) => {
                      const timestamp = pdf.createdAt
                        ? new Date(pdf.createdAt).toLocaleDateString()
                        : "Unknown"

                      return (
                        <TableRow
                          key={pdf.id}
                          className="group hover:bg-muted/20 transition-colors"
                        >
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
                                  {m.projects_docs_status_processed()}
                                </div>
                              ) : (
                                <div className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-blue-500/10 text-blue-600 border-blue-500/20">
                                  <Loader2Icon className="mr-1 h-3 w-3 animate-spin" />
                                  {m.projects_docs_status_processing()}
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
