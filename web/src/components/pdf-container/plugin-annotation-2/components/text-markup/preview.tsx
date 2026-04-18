import { useEffect, useState, type ReactElement } from "react"
import { blendModeToCss, PdfAnnotationSubtype, PdfBlendMode, Rect } from "@embedpdf/models"
import { useSelectionCapability } from "../../../plugin-selection-2"
import { useAnnotationCapability } from "../../hooks"
import { Subtype, subtypeToEnum } from "../../lib/types"
import { Highlight } from "./highlight"
import { Squiggly } from "./squiggly"
import { Strikeout } from "./strikeout"
import { Underline } from "./underline"

interface TextMarkupPreviewProps {
  documentId: string
  pageIndex: number
  scale: number
}

export function TextMarkupPreview({ documentId, pageIndex, scale }: TextMarkupPreviewProps) {
  const { provides: selectionProvides } = useSelectionCapability()
  const { provides: annotationProvides } = useAnnotationCapability()
  const [rects, setRects] = useState<Array<Rect>>([])
  const [boundingRect, setBoundingRect] = useState<Rect | null>(null)
  const [activeSubtype, setActiveSubtype] = useState<Subtype | null>(null)
  const [activeColor, setActiveColor] = useState<string>("red")
  const [activeOpacity, setActiveOpacity] = useState<number>(0.5)

  useEffect(() => {
    if (!selectionProvides) return

    const off = selectionProvides.forDocument(documentId).onSelectionChange(() => {
      setRects(selectionProvides.forDocument(documentId).getHighlightRectsForPage(pageIndex))
      setBoundingRect(selectionProvides.forDocument(documentId).getBoundingRectForPage(pageIndex))
    })
    return off
  }, [selectionProvides, documentId, pageIndex])

  useEffect(() => {
    if (!annotationProvides) return

    const off = annotationProvides.onStateChange((state) => {
      setActiveSubtype(state.activeSubtype)
      setActiveColor(state.activeColor)
      setActiveOpacity(state.activeOpacity)
    })
    return off
  }, [annotationProvides])

  if (!boundingRect) return null
  if (!activeSubtype) return null

  const subtype = subtypeToEnum(activeSubtype)

  let inner: ReactElement | null = null
  switch (subtype) {
    case PdfAnnotationSubtype.UNDERLINE:
      inner = (
        <Underline color={activeColor} opacity={activeOpacity} segmentRects={rects} scale={scale} />
      )
      break
    case PdfAnnotationSubtype.HIGHLIGHT:
      inner = (
        <Highlight color={activeColor} opacity={activeOpacity} segmentRects={rects} scale={scale} />
      )
      break
    case PdfAnnotationSubtype.STRIKEOUT:
      inner = (
        <Strikeout color={activeColor} opacity={activeOpacity} segmentRects={rects} scale={scale} />
      )
      break
    case PdfAnnotationSubtype.SQUIGGLY:
      inner = (
        <Squiggly color={activeColor} opacity={activeOpacity} segmentRects={rects} scale={scale} />
      )
      break
    default:
      return null
  }

  return (
    <div
      style={{
        mixBlendMode: blendModeToCss(
          subtype === PdfAnnotationSubtype.HIGHLIGHT ? PdfBlendMode.Multiply : PdfBlendMode.Normal,
        ),
        pointerEvents: "none",
        position: "absolute",
        inset: 0,
      }}
    >
      {inner}
    </div>
  )
}
