import { MouseEvent, TouchEvent, useCallback, useEffect, useMemo, useState } from "react"
import { blendModeToCss, PdfAnnotationSubtype, PdfBlendMode } from "@embedpdf/models"

import {
  EmbedPdfPointerEvent,
  PointerEventHandlers,
  usePointerHandlers,
} from "../../plugin-interaction-manager-2"
import { useSelectionCapability } from "../../plugin-selection-2"
import { useAnnotationCapability } from "../hooks"

import { AnnotationContainer, SelectionOutline } from "./annotation-container/annotation-container"
import { Highlight } from "./text-markup/highlight"
import { Squiggly } from "./text-markup/squiggly"
import { Strikeout } from "./text-markup/strikeout"
import { Underline } from "./text-markup/underline"

import type { AnnotationDocumentState } from "../lib/state"
import type { PdfTextMarkupAnnotationObject } from "../lib/types"

function getAnnotationsByPageIndex(
  s: AnnotationDocumentState,
  page: number,
): PdfTextMarkupAnnotationObject[] {
  return (s.byPage[page] ?? []).map((uid) => s.byUid[uid])
}

interface AnnotationsProps {
  documentId: string
  pageIndex: number
  scale: number
  rotation: number
  selectionOutline?: SelectionOutline
}

export function Annotations(annotationsProps: AnnotationsProps) {
  const { documentId, pageIndex, scale, rotation, selectionOutline } = annotationsProps
  const { provides: annotationProvides } = useAnnotationCapability()
  const { provides: selectionProvides } = useSelectionCapability()
  const [annotations, setAnnotations] = useState<PdfTextMarkupAnnotationObject[]>([])
  const { register } = usePointerHandlers({ documentId, pageIndex })
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (annotationProvides) {
      return annotationProvides.onStateChange((state) => {
        const documentState = state.documents[documentId]
        setAnnotations(documentState ? getAnnotationsByPageIndex(documentState, pageIndex) : [])
        setSelectedUid(state.selectedUid)
      })
    }
  }, [annotationProvides, documentId, pageIndex])

  const handlers = useMemo(
    (): PointerEventHandlers<EmbedPdfPointerEvent<MouseEvent>> => ({
      onPointerDown: (_, pe) => {
        // Only deselect if clicking directly on the layer (not on an annotation)
        if (pe.target === pe.currentTarget && annotationProvides) {
          annotationProvides.deselectAnnotation()
          setEditingId(null)
        }
      },
    }),
    [annotationProvides],
  )

  const handleClick = useCallback(
    (e: MouseEvent | TouchEvent, annotation: PdfTextMarkupAnnotationObject) => {
      e.stopPropagation()
      if (annotationProvides && selectionProvides) {
        annotationProvides.selectAnnotation(annotation.id)
        selectionProvides.clear()
        if (annotation.id !== editingId) {
          setEditingId(null)
        }
      }
    },
    [annotationProvides, selectionProvides, editingId],
  )

  useEffect(() => {
    return register(handlers)
  }, [register, handlers])

  return (
    <>
      {annotations.map((annotation) => {
        return (
          <AnnotationContainer
            key={annotation.id}
            annotation={annotation}
            isSelected={selectedUid === annotation.id}
            onSelect={(e) => handleClick(e, annotation)}
            style={{
              mixBlendMode: blendModeToCss(
                annotation.blendMode ??
                  (annotation.type === PdfAnnotationSubtype.HIGHLIGHT
                    ? PdfBlendMode.Multiply
                    : PdfBlendMode.Normal),
              ),
            }}
            documentId={documentId}
            scale={scale}
            rotation={rotation}
            selectionOutline={selectionOutline}
          >
            {(obj) => {
              switch (obj.type) {
                case PdfAnnotationSubtype.HIGHLIGHT:
                  return (
                    <Highlight {...obj} scale={scale} onClick={(e) => handleClick(e, annotation)} />
                  )
                case PdfAnnotationSubtype.SQUIGGLY:
                  return (
                    <Squiggly {...obj} scale={scale} onClick={(e) => handleClick(e, annotation)} />
                  )
                case PdfAnnotationSubtype.STRIKEOUT:
                  return (
                    <Strikeout {...obj} scale={scale} onClick={(e) => handleClick(e, annotation)} />
                  )
                case PdfAnnotationSubtype.UNDERLINE:
                  return (
                    <Underline {...obj} scale={scale} onClick={(e) => handleClick(e, annotation)} />
                  )
                default:
                  return null
              }
            }}
          </AnnotationContainer>
        )
      })}
    </>
  )
}
