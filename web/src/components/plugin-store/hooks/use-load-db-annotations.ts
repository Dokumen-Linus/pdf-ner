import { useEffect, useRef } from "react"
import { PdfAnnotationSubtype } from "@embedpdf/models"
import {
  subtypeToEnum,
  type PdfTextMarkupAnnotationObject,
  type Subtype,
} from "@/components/pdf-container/plugin-annotation-2"
import { getAnnotationsByPdfId } from "@/db-fns/web/annotations"
import { toEmbedRect, toEmbedRects } from "@/db/rect"
import type { FoundDbAnnotation } from "@/db/types"
import usePluginStore from "./use-plugin-store"

// Converts a DB annotation row into the plugin's in-memory shape. Returns
// null for rows whose subtype isn't one of the four text-markup kinds the
// plugin supports — that's defensive against rows written by future/legacy
// code paths.
function toAnnotationObject(row: FoundDbAnnotation): PdfTextMarkupAnnotationObject | null {
  const s = row.subtype as Subtype
  if (s !== "highlight" && s !== "underline" && s !== "strikeout" && s !== "squiggly") {
    return null
  }
  // Sanity: map through the plugin's own conversion so we fail loudly if the
  // plugin's subtype list ever shrinks.
  const enumValue: PdfAnnotationSubtype = subtypeToEnum(s)

  return {
    id: row.id,
    type: enumValue,
    pageIndex: row.pageIndex,
    rect: toEmbedRect(row.rect),
    segmentRects: toEmbedRects(row.segmentRects),
    color: row.color ?? "#FFCD45",
    opacity: row.opacity ?? 0.5,
    contents: row.contents ?? "",
    author: row.author ?? undefined,
    created: row.created ? new Date(row.created) : undefined,
    modified: row.modified ? new Date(row.modified) : undefined,
    custom: { entityType: row.customEntityType ?? "" },
  } as PdfTextMarkupAnnotationObject
}

interface UseLoadDbAnnotationsArgs {
  /** Current active documentId. Same UUID as workers.pdfs.id / web.annotations.pdf_id. */
  documentId: string | null
  /**
   * Fast-path flag from web.pdfs.annotated. When false, the hook skips the
   * DB fetch entirely — the overwhelming majority of fresh uploads have no
   * annotations and we shouldn't pay for a round-trip to confirm empty.
   * When the flag is undefined, the hook behaves conservatively (fetches).
   */
  annotated: boolean | undefined
}

/**
 * Seeds the AnnotationPlugin with annotations persisted in web.annotations.
 *
 * Intentionally a hook, not a component. The labelling page calls this once
 * per mount; whenever `documentId` changes (e.g. user switches PDFs in the
 * sidebar), this re-runs for the new pdf and seeds its annotations.
 *
 * Uses `annoCapability.createAnnotations(items, docId)` — the batch method
 * bypasses the undo/redo timeline, which is correct for "these came from
 * the DB, the user didn't just create them."
 *
 * Runs ALONGSIDE the plugin's own PDF-embedded annotation load in
 * AnnotationPlugin.onDocumentLoaded. Uploaded PDFs in this app don't have
 * baked-in annotations, so the two sets never collide.
 */
export function useLoadDbAnnotations({ documentId, annotated }: UseLoadDbAnnotationsArgs): void {
  const annoCapability = usePluginStore((s) => s.annoCapability)
  const annoState = usePluginStore((s) => s.annoState)

  // Tracks which docIds we've already seeded this session. Prevents
  // re-injection on plugin state changes or loader re-fires. Per-doc so
  // switching back-and-forth between two pdfs only seeds each once.
  const seededRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!annoCapability || !documentId) return
    const hasInMemoryState = annoState?.documents[documentId] !== undefined
    if (seededRef.current.has(documentId) && hasInMemoryState) return
    if (annotated === false) {
      // Short-circuit: pdf is known to have zero annotations. Mark as
      // "seeded" so we don't keep re-checking on every re-render.
      seededRef.current.add(documentId)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const rows = (await getAnnotationsByPdfId({
          data: { pdfId: documentId },
        })) as FoundDbAnnotation[]
        if (cancelled) return
        const items = rows
          .map(toAnnotationObject)
          .filter((a): a is PdfTextMarkupAnnotationObject => a !== null)
        if (items.length > 0) {
          annoCapability.createAnnotations(items, documentId)
        }
        seededRef.current.add(documentId)
      } catch (err) {
        // Swallow — failing to load annotations shouldn't block the editor.
        // The user can still annotate; save flow won't collide because it
        // does a full replace of the pdf's annotation set.
        console.warn("[use-load-db-annotations] failed to load", err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [annoCapability, annoState, documentId, annotated])
}
