import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PdfAnnotationSubtype } from "@embedpdf/models"
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import {
  FileTextIcon,
  LayoutDashboardIcon,
  LockIcon,
  SaveIcon,
  SettingsIcon,
  TagIcon,
} from "lucide-react"
import { z } from "zod"
import EntityTable from "@/components/entity-table/components/entity-table"
import PDFContainer from "@/components/pdf-container/pdf-container"
import { useLoadDbAnnotations } from "@/components/plugin-store/hooks/use-load-db-annotations"
import usePluginStore from "@/components/plugin-store/hooks/use-plugin-store"
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
import { getProjectById } from "@/db-fns/web/projects"
import { getWorkersPdfsByProjectId } from "@/db-fns/workers/pdfs"
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
  validateSearch: LabellingSearchSchema,
  loaderDeps: ({ search }) => ({ pdfId: search.pdfId }),
  loader: async ({ params, deps, context }) => {
    const userId = context.session?.user?.id
    if (!userId) {
      return {
        project: null,
        pdfs: [] as FoundWorkersPdf[],
        activePdfId: null as string | null,
        activePdfAnnotated: undefined as boolean | undefined,
        initialUrl: null as string | null,
        lockState: null as
          | { locked: false }
          | { locked: true; lockedByName: string; lockedAt: Date | null }
          | null,
        userId: null as string | null,
        loadError: "Not authenticated" as string | null,
      }
    }

    try {
      const [project, pdfsRaw] = await Promise.all([
        getProjectById({ data: { id: params.projectId } }),
        getWorkersPdfsByProjectId({ data: { projectId: params.projectId } }),
      ])
      const pdfs = pdfsRaw as FoundWorkersPdf[]

      // Prefer the pdfId from search. Fall back to first project pdf. Null if
      // no pdfs at all — the component renders an "upload first" message.
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
          lockState: null,
          userId,
          loadError: null,
        }
      }

      // Try to acquire the lock for the chosen pdf. If denied, we fetch no
      // URL — there's nothing to render in the editor, and showing the PDF
      // to a non-editor would waste a signed URL.
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
          lockState: {
            locked: true as const,
            lockedByName: lockResult.lockedByName ?? "another user",
            lockedAt: lockResult.lockedAt ?? null,
          },
          userId,
          loadError: null,
        }
      }

      // Parallel: fetch signed URL + web.pdfs row (for `annotated` flag).
      // Both depend only on activePdfId so they can race.
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
        lockState: { locked: false as const },
        userId,
        loadError: null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        project: null,
        pdfs: [] as FoundWorkersPdf[],
        activePdfId: null,
        activePdfAnnotated: undefined,
        initialUrl: null,
        lockState: null,
        userId,
        loadError: message,
      }
    }
  },
  pendingComponent: LabellingSkeleton,
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
    lockState,
    userId,
    loadError,
  } = Route.useLoaderData()
  const { projectId } = Route.useParams()

  // Lock heartbeat — runs whenever we *have* a held lock. lockState.locked
  // is true ONLY when another user holds it, so negate to derive "we hold".
  const weHoldLock = lockState?.locked === false && Boolean(activePdfId)
  const { isLockLost, markLockLost, resetLockLost } = useLabellingLock({
    pdfId: weHoldLock ? activePdfId : null,
    userId: weHoldLock ? userId : null,
  })

  // Seed the AnnotationPlugin with annotations persisted in web.annotations.
  // Always on; skips the DB round-trip when `annotated === false` (most fresh
  // uploads) using the fast-path flag maintained by saveAnnotationsByPdfId.
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

  // Read plugin store to build save payload and to drive doc-switching.
  const { annoState, docManagerCapability } = usePluginStore()

  // Sidebar order: newest-first. Memoized so the prefetch effect doesn't
  // re-subscribe whenever React hands us a new `pdfs` array ref.
  const sortedPdfs = useMemo(
    () =>
      [...pdfs].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tb - ta
      }),
    [pdfs],
  )

  // Per-session record of pdfIds we've already asked DocumentManager to
  // preload. Survives active-doc switches because it's a ref on the page
  // component, which never unmounts during navigation within /labelling.
  const prefetchRequestedRef = useRef<Set<string>>(new Set())

  // Build the payload the labelling save path expects: a flat list of
  // annotations for the active document, plus the derived labeled_entities
  // aggregate.
  const buildSavePayload = useCallback(() => {
    if (!annoState || !activePdfId) return null
    const docState = annoState.documents[activePdfId]
    if (!docState) return null

    const labeledEntities: LabeledEntitiesMap = {}
    const annotations = Object.values(docState.byUid).map((a) => {
      // `custom` is typed loose on the plugin side; narrow here so we can
      // pull entityType out without the unknown cast spreading.
      const custom = (a.custom ?? {}) as { entityType?: string }
      const entityType = custom.entityType ?? ""
      if (entityType && a.contents) {
        labeledEntities[entityType] ??= []
        labeledEntities[entityType].push(a.contents)
      }
      return {
        id: a.id,
        pdfId: activePdfId,
        // Reverse of subtypeToEnum — the DB CHECK constraint wants the
        // string form. reverseSubtype returns undefined for subtypes the
        // DB doesn't support; those get filtered out below.
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

    // Defensive filter — any annotation whose subtype we couldn't map
    // (e.g. someone added a new subtype to the plugin without updating the
    // DB CHECK) would fail insert; drop it with a warning rather than blow
    // up the whole save.
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
      // Only the save path produces this specific sentinel — surface a
      // clear "you lost the lock" UI, don't keep blaming network.
      if (message.toLowerCase().includes("lock lost")) {
        markLockLost()
      }
    }
  }, [activePdfId, userId, buildSavePayload, markLockLost])

  // Switch to a different PDF in the project.
  //   1. release the current lock (we'll re-acquire or fail on the new one)
  //   2. navigate via search so URL is shareable / reload-safe
  //   3. the loader re-runs, acquiring the new lock + fetching new URL
  //   4. after the loader resolves, we reuse docManager to pre-render
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

  // After the loader fetches a new presigned URL, make DocumentManager aware
  // of it. Runs on the *client* — the loader is server-side and can't touch
  // DocumentManager state. No eviction: every URL seen this session stays
  // cached so switching between already-viewed PDFs is instant.
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

  // Prefetch the next PDF in sidebar order as soon as the active one has
  // finished rendering. We listen on `onDocumentOpened` (fires only on the
  // "loaded" status transition) so prefetch doesn't compete with the active
  // doc's initial network/pdfium work. The prefetch opens the doc with
  // `autoActivate: false` so it lands in DocumentManager state but doesn't
  // steal the active-document slot or remount any layers.
  useEffect(() => {
    if (!docManagerCapability || !activePdfId) return
    if (sortedPdfs.length < 2) return

    const triggerPrefetch = () => {
      const idx = sortedPdfs.findIndex((p) => p.id === activePdfId)
      if (idx === -1) return
      const next = sortedPdfs[idx + 1]
      if (!next) return // active is the last doc — nothing to prefetch
      if (prefetchRequestedRef.current.has(next.id)) return
      if (docManagerCapability.isDocumentOpen(next.id)) {
        prefetchRequestedRef.current.add(next.id)
        return
      }
      prefetchRequestedRef.current.add(next.id)
      void (async () => {
        try {
          const { url } = await getPdfPresignedUrl({ data: { pdfId: next.id } })
          // Re-check in case another effect opened it between the await and now.
          if (docManagerCapability.isDocumentOpen(next.id)) return
          docManagerCapability.openDocumentUrl({
            url,
            documentId: next.id,
            autoActivate: false,
          })
        } catch (err) {
          // Allow retry on next trigger — the signed URL may have been a
          // transient failure (network blip, 5xx).
          prefetchRequestedRef.current.delete(next.id)
          console.warn("[labelling] failed to prefetch next pdf", err)
        }
      })()
    }

    // Fast path: the active doc may already be loaded (e.g. user switched
    // to a previously-opened doc this session). No event will fire again,
    // so check current state up front.
    const activeState = docManagerCapability.getDocumentState(activePdfId)
    if (activeState?.status === "loaded") {
      triggerPrefetch()
      return
    }

    // Otherwise wait for the active doc to open.
    const unsub = docManagerCapability.onDocumentOpened((docState) => {
      if (docState.id !== activePdfId) return
      triggerPrefetch()
    })
    return unsub
  }, [docManagerCapability, activePdfId, sortedPdfs])

  // ─── error & empty states ─────────────────────────────────────────────
  if (loadError || !project) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Labelling</h1>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to open labeller</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{loadError ?? "Project not found."}</p>
            <Button onClick={() => void router.invalidate()}>Retry</Button>
            <Button variant="outline" asChild className="ml-2">
              <Link to="/projects">Back to projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

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

  // ─── locked by another user ──────────────────────────────────────────
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
                {lockState.lockedAt
                  ? `Last activity ${formatDistanceToNow(new Date(lockState.lockedAt), { addSuffix: true })}.`
                  : "Another user has this PDF open."}{" "}
                You can retry in a couple of minutes — the lock automatically releases if the other
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

  // ─── normal labelling editor ─────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col overflow-hidden">
      {/* Header strip: project name, tab nav, save button. */}
      <div className="flex items-center justify-between gap-4 border-b px-4 py-2">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link
              to="/projects/$projectId"
              params={{ projectId }}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <SettingsIcon className="h-4 w-4" />
              Overview
            </Link>
            <Link
              to="/projects/$projectId/dashboard"
              params={{ projectId }}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <LayoutDashboardIcon className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              to="/projects/$projectId/documents"
              params={{ projectId }}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <FileTextIcon className="h-4 w-4" />
              Documents
            </Link>
            <Link
              to="/projects/$projectId/entity_types"
              params={{ projectId }}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <TagIcon className="h-4 w-4" />
              Entity Types
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {saveState.state === "saving" && (
            <span className="text-xs text-muted-foreground">Saving…</span>
          )}
          {saveState.state === "saved" && (
            <span className="text-xs text-emerald-600">
              Saved {formatDistanceToNow(saveState.at, { addSuffix: true })}
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

      {/* Lock-lost modal — blocks the editor when our heartbeat reports the
          lock was stolen. Inline banner keeps UX simple; users can go back to
          documents and retry. */}
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

      {/* Three-column body */}
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
            <PDFContainer
              // Intentionally no `key={activePdfId}` — remounting would reset
              // the DocumentManager plugin and drop every already-loaded PDF.
              // Live switches to already-preloaded docs are handled by the
              // `setActiveDocument` useEffect above.
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
          <EntityTable />
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
  // Newest first — same ordering as the documents page.
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
                  {pdf.createdAt ? new Date(pdf.createdAt).toLocaleDateString() : "date unknown"}
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// Reverse of subtypeToEnum in plugin-annotation-2/lib/types.ts. Maps the
// PdfAnnotationSubtype enum value back to the string the DB CHECK
// constraint on web.annotations.subtype accepts. Uses the imported enum
// so values stay correct if the library renumbers.
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
