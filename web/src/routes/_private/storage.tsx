import { useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileUp, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn-ui/card"
import { Label } from "@/components/shadcn-ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn-ui/select"
import { uploadPdf } from "@/db-fns/api/storage"
import { getProjectsByOwnerId } from "@/db-fns/web/projects"
import { authClient } from "@/lib/auth-client"

type Project = Awaited<ReturnType<typeof getProjectsByOwnerId>>[number]

export const Route = createFileRoute("/_private/storage")({
  loader: async ({ context }) => {
    const userId = context.session?.user?.id
    if (!userId) return { projects: [] as Project[] }
    const projects = await getProjectsByOwnerId({ data: { ownerId: userId } })
    return { projects }
  },
  component: StoragePage,
})

function StoragePage() {
  const { projects } = Route.useLoaderData()
  const { data: session } = authClient.useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedProject = projects.find((p: Project) => p.id === selectedProjectId)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setError(null)
    setSuccess(null)

    if (file && file.type !== "application/pdf") {
      setError("Only PDF files are accepted.")
      setSelectedFile(null)
      return
    }

    if (file && file.size > 50 * 1024 * 1024) {
      setError("File exceeds the 50 MB size limit.")
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile || !selectedProject?.bucketId) return

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const buffer = await selectedFile.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const chunks: string[] = []
      for (let i = 0; i < bytes.length; i += 8192) {
        chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)))
      }
      const fileBase64 = btoa(chunks.join(""))

      const result = await uploadPdf({
        data: {
          projectId: selectedProject.id,
          bucketId: selectedProject.bucketId,
          fileName: selectedFile.name,
          fileBase64,
        },
      })

      setSuccess(`Uploaded "${selectedFile.name}" successfully. PDF ID: ${result.pdf_id}`)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  if (!session?.user) return null

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            PDF Storage
          </CardTitle>
          <CardDescription>Upload PDF documents to a project's S3 bucket</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Project</Label>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No projects found. Create a project first.
              </p>
            ) : (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project: Project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                      {!project.bucketId && " (no bucket)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedProject && !selectedProject.bucketId && (
              <p className="text-sm text-destructive">
                This project has no storage bucket. Re-create it or contact support.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pdf-file">PDF File</Label>
            <div
              className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-muted-foreground/50"
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
                <p className="text-sm text-muted-foreground">Click to select a PDF (max 50 MB)</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              id="pdf-file"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-md border border-green-500/20 bg-green-500/10 p-3">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">{success}</p>
            </div>
          )}

          <Button
            className="w-full"
            disabled={!selectedFile || !selectedProject?.bucketId || uploading}
            onClick={handleUpload}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload PDF
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
