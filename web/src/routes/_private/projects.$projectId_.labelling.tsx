import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PdfAnnotationSubtype } from "@embedpdf/models"
import { createFileRoute, Link, useHydrated, useNavigate, useRouter } from "@tanstack/react-router"
import type { ErrorComponentProps } from "@tanstack/router-core"
import { formatDistanceToNow } from "date-fns"
import { FileTextIcon, LockIcon, SaveIcon } from "lucide-react"
import { z } from "zod"
import EntityTable from "@/components/entity-table/components/entity-table"
import PDFContainerClient from "@/components/pdf-container/pdf-container-client"
import { useLoadDbAnnotations } from "@/components/plugin-store/hooks/use-load-db-annotations"
import usePluginStore from "@/components/plugin-store/hooks/use-plugin-store"
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
import { getPdfPresignedUrl } from "@/db-fns/api/storage"
import { saveAnnotationsByPdfId } from "@/db-fns/web/annotations"
import {
  acquireLabellingLock,
  getPdfById,
  releaseLabellingLock,
  upsertPdfLabels,
} from "@/db-fns/web/pdfs"
import { getEntityTypesByProjectId } from "@/db-fns/web/entity-types"
import { getProjectById } from "@/db-fns/web/projects"
import { getWorkersPdfsByProjectId } from "@/db-fns/workers/pdfs"
import type { EntityType } from "@/components/entity-table/entity-type"
import type { FoundWorkersPdf, LabeledEntitiesMap } from "@/db/types"
import { useLabellingLock } from "@/hooks/use-labelling-lock"

const LabellingSearchSchema = z.object({
  pdfId: z.string().uuid().optional(),
})

function LabellingSkeleton() {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full gap-4 p-4">
      <Skeleton className="h-full w-64" />
      <Skeleton className="h-full flex-1" />
      <Skeleton className="h-full w-96" />
    </div>
  )
}

export const Route = createFileRoute("/_private/projects/$projectId_/labelling")({
  // ssr: false,
  validateSearch: LabellingSearchSchema,
  loaderDeps: ({ search }) => ({ pdfId: search.pdfId }),
  loader: async ({ params, deps, context }) => {
    const userId = context.session?.user?.id
    if (!userId) {
      throw new Error("Not authenticated")
    }

    const [project, pdfsRaw, entityTypes] = await Promise.all([
      getProjectById({ data: { id: params.projectId } }),
      getWorkersPdfsByProjectId({ data: { projectId: params.projectId } }),
      getEntityTypesByProjectId({ data: { projectId: params.projectId } }),
    ])
    const pdfs = pdfsRaw as FoundWorkersPdf[]

    const requestedPdfId = deps.pdfId
    const activePdfId =
      (requestedPdfId && pdfs.find((p) => p.id === requestedPdfId)?.id) ?? pdfs[0]?.id ?? null

    if (!activePdfId) {
      return {
        project,
        pdfs,
        activePdfId: null,
        activePdfAnnotated: undefined,
        initialUrl: null,
        entityTypes,
        lockState: null as
          | { locked: false }
          | { locked: true; lockedByName: string; lockedAt: Date | null }
          | null,
        userId,
      }
    }

    const lockResult = await acquireLabellingLock({
      data: { pdfId: activePdfId, userId },
    })

    if (!lockResult.acquired) {
      return {
        project,
        pdfs,
        activePdfId,
        activePdfAnnotated: undefined,
        initialUrl: null,
        entityTypes,
        lockState: {
          locked: true as const,
          lockedByName: lockResult.lockedByName ?? "another user",
          lockedAt: lockResult.lockedAt ?? null,
        },
        userId,
      }
    }

    const [{ url }, webPdf] = await Promise.all([
      getPdfPresignedUrl({ data: { pdfId: activePdfId } }),
      getPdfById({ data: { id: activePdfId } }),
    ])

    return {
      project,
      pdfs,
      activePdfId,
      activePdfAnnotated: webPdf.annotated,
      initialUrl: url,
      entityTypes,
      lockState: { locked: false as const },
      userId,
    }
  },
  pendingComponent: LabellingSkeleton,
  errorComponent: LabellingRouteError,
  component: LabellingPage,
})

function LabellingPage() {
  const router = useRouter()
  const navigate = useNavigate({ from: Route.fullPath })
  const {
    project,
    pdfs,
    activePdfId,
    activePdfAnnotated,
    initialUrl,
    entityTypes,
    lockState,
    userId,
  } = Route.useLoaderData()
  const { projectId } = Route.useParams()
  const entityTableTypes = useMemo<EntityType[]>(
    () =>
      entityTypes.map((entityType) => ({
        name: entityType.name,
        subtype: (entityType.subtype as EntityType["subtype"] | null) ?? "highlight",
        color: entityType.color ?? "#FFEB3B",
        opacity: entityType.opacity ?? 0.8,
        unique: entityType.unique,
        required: entityType.required,
      })),
    [entityTypes],
  )

  const weHoldLock = lockState?.locked === false && Boolean(activePdfId)
  const { isLockLost, markLockLost, resetLockLost } = useLabellingLock({
    pdfId: weHoldLock ? activePdfId : null,
    userId: weHoldLock ? userId : null,
  })

  useLoadDbAnnotations({
    documentId: weHoldLock ? activePdfId : null,
    annotated: activePdfAnnotated,
  })

  const [saveState, setSaveState] = useState<
    | { state: "idle" }
    | { state: "saving" }
    | { state: "saved"; at: Date }
    | { state: "error"; message: string }
  >({ state: "idle" })

  const [switchingTo, setSwitchingTo] = useState<string | null>(null)
  const { annoState, docManagerCapability } = usePluginStore()

  const sortedPdfs = useMemo(
    () =>
      [...pdfs].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tb - ta
      }),
    [pdfs],
  )

  const prefetchRequestedRef = useRef<Set<string>>(new Set())

  const buildSavePayload = useCallback(() => {
    if (!annoState || !activePdfId) return null
    const docState = annoState.documents[activePdfId]
    if (!docState) return null

    const labeledEntities: LabeledEntitiesMap = {}
    const annotations = Object.values(docState.byUid).map((a) => {
      const custom = (a.custom ?? {}) as { entityType?: string }
      const entityType = custom.entityType ?? ""
      if (entityType && a.contents) {
        labeledEntities[entityType] ??= []
        labeledEntities[entityType].push(a.contents)
      }
      return {
        id: a.id,
        pdfId: activePdfId,
        subtype: reverseSubtype(a.type),
        rect: a.rect,
        segmentRects: a.segmentRects,
        pageIndex: a.pageIndex,
        color: a.color,
        opacity: a.opacity,
        contents: a.contents,
        customEntityType: entityType || undefined,
        author: a.author,
        created: a.created ? new Date(a.created) : undefined,
        modified: a.modified ? new Date(a.modified) : undefined,
      }
    })

    const valid = annotations.filter(
      (a): a is typeof a & { subtype: string } => typeof a.subtype === "string",
    )
    if (valid.length !== annotations.length) {
      console.warn(
        `[labelling] skipping ${annotations.length - valid.length} annotations with unsupported subtype`,
      )
    }

    return { annotations: valid, labeledEntities }
  }, [annoState, activePdfId])

  const handleSave = useCallback(async () => {
    if (!activePdfId || !userId) return
    const payload = buildSavePayload()
    if (!payload) return
    setSaveState({ state: "saving" })
    try {
      await saveAnnotationsByPdfId({
        data: {
          pdfId: activePdfId,
          userId,
          annotations: payload.annotations,
          labeledEntities: payload.labeledEntities,
        },
      })
      await upsertPdfLabels({
        data: {
          id: activePdfId,
          labeledEntities: payload.labeledEntities,
          uploadedBy: userId,
        },
      })
      setSaveState({ state: "saved", at: new Date() })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed"
      setSaveState({ state: "error", message })
      if (message.toLowerCase().includes("lock lost")) {
        markLockLost()
      }
    }
  }, [activePdfId, userId, buildSavePayload, markLockLost])

  const handleSwitchPdf = useCallback(
    async (nextPdfId: string) => {
      if (!nextPdfId || nextPdfId === activePdfId || !userId) return
      setSwitchingTo(nextPdfId)
      try {
        if (activePdfId && weHoldLock) {
          await releaseLabellingLock({ data: { pdfId: activePdfId, userId } })
        }
        resetLockLost()
        await navigate({ search: { pdfId: nextPdfId } })
      } finally {
        setSwitchingTo(null)
      }
    },
    [activePdfId, userId, weHoldLock, navigate, resetLockLost],
  )

  useEffect(() => {
    if (!docManagerCapability || !activePdfId || !initialUrl) return
    if (!docManagerCapability.isDocumentOpen(activePdfId)) {
      docManagerCapability.openDocumentUrl({
        url: initialUrl,
        documentId: activePdfId,
      })
    }
    docManagerCapability.setActiveDocument(activePdfId)
  }, [docManagerCapability, activePdfId, initialUrl])

  useEffect(() => {
    if (!docManagerCapability || !activePdfId) return
    if (sortedPdfs.length < 2) return

    const triggerPrefetch = () => {
      const idx = sortedPdfs.findIndex((p) => p.id === activePdfId)
      if (idx === -1) return
      const next = sortedPdfs[idx + 1]
      if (!next) return
      if (prefetchRequestedRef.current.has(next.id)) return
      if (docManagerCapability.isDocumentOpen(next.id)) {
        prefetchRequestedRef.current.add(next.id)
        return
      }
      prefetchRequestedRef.current.add(next.id)
      void (async () => {
        try {
          const { url } = await getPdfPresignedUrl({ data: { pdfId: next.id } })
          if (docManagerCapability.isDocumentOpen(next.id)) return
          docManagerCapability.openDocumentUrl({
            url,
            documentId: next.id,
            autoActivate: false,
          })
        } catch (err) {
          prefetchRequestedRef.current.delete(next.id)
          console.warn("[labelling] failed to prefetch next pdf", err)
        }
      })()
    }

    const activeState = docManagerCapability.getDocumentState(activePdfId)
    if (activeState?.status === "loaded") {
      triggerPrefetch()
      return
    }

    const unsub = docManagerCapability.onDocumentOpened((docState) => {
      if (docState.id !== activePdfId) return
      triggerPrefetch()
    })
    return unsub
  }, [docManagerCapability, activePdfId, sortedPdfs])

  if (pdfs.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
        <Card>
          <CardHeader>
            <CardTitle>No PDFs yet</CardTitle>
            <CardDescription>
              Upload a PDF before labelling entities in this project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/projects/$projectId/documents" params={{ projectId }}>
                Go to documents
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (lockState?.locked === true) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
        <Card className="border-amber-500/40">
          <CardHeader className="flex flex-row items-center gap-3">
            <LockIcon className="h-5 w-5 text-amber-500" />
            <div>
              <CardTitle>Currently being labelled by {lockState.lockedByName}</CardTitle>
              <CardDescription>
                {lockState.lockedAt ? (
                  <>
                    Last activity <ClientRelativeTime value={lockState.lockedAt} suffix="." />{" "}
                  </>
                ) : (
                  <>Another user has this PDF open. </>
                )}
                You can retry in a couple of minutes - the lock automatically releases if the other
                editor goes idle.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={() => void router.invalidate()}>Retry</Button>
              <Button variant="outline" asChild>
                <Link to="/projects/$projectId/documents" params={{ projectId }}>
                  Back to documents
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <SidebarPdfList
          pdfs={pdfs}
          activePdfId={activePdfId}
          switchingTo={switchingTo}
          onSwitch={handleSwitchPdf}
        />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-2">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
          <ProjectTabs projectId={projectId} currentStep="labelling" variant="compact" />
        </div>

        <div className="flex items-center gap-3">
          {saveState.state === "saving" && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
          {saveState.state === "saved" && (
            <span className="text-xs text-emerald-600">
              Saved <ClientRelativeTime value={saveState.at} />
            </span>
          )}
          {saveState.state === "error" && (
            <span className="text-xs text-destructive">{saveState.message}</span>
          )}
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={saveState.state === "saving" || isLockLost}
          >
            <SaveIcon className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      {isLockLost && (
        <div className="flex items-center justify-between gap-2 border-b border-destructive/40 bg-destructive/5 px-4 py-2 text-sm">
          <span className="text-destructive">
            Your editing session expired because another user took over. Unsaved changes cannot be
            saved.
          </span>
          <Button size="sm" variant="outline" onClick={() => void router.invalidate()}>
            Refresh
          </Button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 shrink-0 overflow-y-auto border-r bg-muted/20">
          <SidebarPdfList
            pdfs={pdfs}
            activePdfId={activePdfId}
            switchingTo={switchingTo}
            onSwitch={handleSwitchPdf}
          />
        </div>

        <div className="flex-1 overflow-hidden">
          {activePdfId && initialUrl ? (
            <PDFContainerClient
              initalDocuments={[{ url: initialUrl, documentId: activePdfId }]}
              author={userId ?? "anonymous"}
              exportName={`${project.name}-labeled.pdf`}
              canRotate={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a PDF from the sidebar.
            </div>
          )}
        </div>

        <div className="w-96 shrink-0 overflow-y-auto border-l">
          <EntityTable entityTypes={entityTableTypes} />
        </div>
      </div>
    </div>
  )
}

function SidebarPdfList({
  pdfs,
  activePdfId,
  switchingTo,
  onSwitch,
}: {
  pdfs: FoundWorkersPdf[]
  activePdfId: string | null
  switchingTo: string | null
  onSwitch: (pdfId: string) => void
}) {
  const sorted = useMemo(
    () =>
      [...pdfs].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tb - ta
      }),
    [pdfs],
  )

  return (
    <ul className="divide-y">
      {sorted.map((pdf) => {
        const isActive = pdf.id === activePdfId
        const isSwitching = pdf.id === switchingTo
        return (
          <li key={pdf.id}>
            <button
              type="button"
              onClick={() => onSwitch(pdf.id)}
              disabled={isActive || isSwitching}
              className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-foreground"
                  : "hover:bg-muted/50 text-muted-foreground"
              } ${isSwitching ? "opacity-50" : ""}`}
            >
              <FileTextIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{pdf.name ?? "untitled.pdf"}</div>
                <div className="text-xs text-muted-foreground">
                  {pdf.createdAt ? <ClientDate value={pdf.createdAt} /> : "date unknown"}
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function LabellingRouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const message = error instanceof Error ? error.message : "Unable to open labeller"

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Labelling</h1>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Unable to open labeller</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                reset()
                void router.invalidate()
              }}
            >
              Retry
            </Button>
            <Button variant="outline" asChild>
              <Link to="/projects">Back to projects</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ClientRelativeTime({ value, suffix = "" }: { value: Date | string; suffix?: string }) {
  const hydrated = useHydrated()
  const date = new Date(value)

  if (!hydrated) {
    return (
      <span suppressHydrationWarning>
        {date.toISOString().replace("T", " ").slice(0, 16)} UTC{suffix}
      </span>
    )
  }

  return (
    <span suppressHydrationWarning>
      {formatDistanceToNow(date, { addSuffix: true })}
      {suffix}
    </span>
  )
}

function ClientDate({ value }: { value: Date | string }) {
  const hydrated = useHydrated()
  const date = new Date(value)

  return (
    <span suppressHydrationWarning>
      {hydrated ? date.toLocaleDateString() : date.toISOString().slice(0, 10)}
    </span>
  )
}

function reverseSubtype(enumValue: number): string | undefined {
  switch (enumValue) {
    case PdfAnnotationSubtype.HIGHLIGHT:
      return "highlight"
    case PdfAnnotationSubtype.UNDERLINE:
      return "underline"
    case PdfAnnotationSubtype.SQUIGGLY:
      return "squiggly"
    case PdfAnnotationSubtype.STRIKEOUT:
      return "strikeout"
    default:
      return undefined
  }
}
