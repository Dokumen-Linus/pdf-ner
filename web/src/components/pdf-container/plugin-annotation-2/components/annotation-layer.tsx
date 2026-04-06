import { CSSProperties, HTMLAttributes, useMemo } from "react"
import { useDocumentState } from "@embedpdf/core/react"
import { Rotation } from "@embedpdf/models"
import type { SelectionOutline } from "./annotation-container/annotation-container"
import { Annotations } from "./annotations"
import { TextMarkupPreview } from "./text-markup/preview"

type AnnotationLayerProps = Omit<HTMLAttributes<HTMLDivElement>, "style"> & {
  documentId: string
  pageIndex: number
  scale?: number
  rotation?: number
  selectionOutline?: SelectionOutline
  style?: CSSProperties
}

export function AnnotationLayer({
  documentId,
  pageIndex,
  scale: overrideScale,
  rotation: overrideRotation,
  selectionOutline,
  style,
  ...props
}: AnnotationLayerProps) {
  const documentState = useDocumentState(documentId)
  const page = documentState?.document?.pages?.[pageIndex]

  const actualScale = useMemo(() => {
    if (overrideScale !== undefined) return overrideScale
    return documentState?.scale ?? 1
  }, [overrideScale, documentState?.scale])

  const actualRotation = useMemo(() => {
    if (overrideRotation !== undefined) return overrideRotation
    // Combine page intrinsic rotation with document rotation
    const pageRotation = page?.rotation ?? 0
    const docRotation = documentState?.rotation ?? 0
    return ((pageRotation + docRotation) % 4) as Rotation
  }, [overrideRotation, page?.rotation, documentState?.rotation])

  return (
    <div
      style={{
        ...style,
      }}
      {...props}
    >
      <Annotations
        documentId={documentId}
        pageIndex={pageIndex}
        scale={actualScale}
        rotation={actualRotation}
        selectionOutline={selectionOutline}
      />
      <TextMarkupPreview documentId={documentId} pageIndex={pageIndex} scale={actualScale} />
    </div>
  )
}
