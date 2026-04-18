import { useEffect, useMemo, useState } from "react"
import { useDocumentState } from "@embedpdf/core/react"
import { Rect } from "@embedpdf/models"

import { useSelectionPlugin } from "../hooks"

type TextSelectionProps = {
  documentId: string
  pageIndex: number
  scale?: number
  /** Background color for text selection highlights. Default: 'rgba(33,150,243)' */
  background?: string
}

/**
 * TextSelection renders text selection highlight rects.
 * It registers the text selection handler on the page and mirrors the current
 * selection rectangles from the selection plugin.
 *
 * Use this component directly for advanced cases, or use `SelectionLayer`
 * which composes both `TextSelection` and `MarqueeSelection`.
 */
export function TextSelection({
  documentId,
  pageIndex,
  scale: scaleOverride,
  background = "rgba(33,150,243)",
}: TextSelectionProps) {
  const { plugin: selPlugin } = useSelectionPlugin()
  const documentState = useDocumentState(documentId)
  const [rects, setRects] = useState<Rect[]>([])
  const [boundingRect, setBoundingRect] = useState<Rect | null>(null)

  useEffect(() => {
    if (!selPlugin || !documentId) return

    return selPlugin.registerSelectionOnPage({
      documentId,
      pageIndex,
      onRectsChange: ({ rects, boundingRect }) => {
        setRects(rects)
        setBoundingRect(boundingRect)
      },
    })
  }, [selPlugin, documentId, pageIndex])

  const actualScale = useMemo(() => {
    if (scaleOverride !== undefined) return scaleOverride
    return documentState?.scale ?? 1
  }, [scaleOverride, documentState?.scale])

  if (!boundingRect) return null

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: boundingRect.origin.x * actualScale,
          top: boundingRect.origin.y * actualScale,
          width: boundingRect.size.width * actualScale,
          height: boundingRect.size.height * actualScale,
          mixBlendMode: "multiply",
          isolation: "isolate",
          pointerEvents: "none",
        }}
      >
        {rects.map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: (b.origin.x - boundingRect.origin.x) * actualScale,
              top: (b.origin.y - boundingRect.origin.y) * actualScale,
              width: b.size.width * actualScale,
              height: b.size.height * actualScale,
              background,
            }}
          />
        ))}
      </div>
    </>
  )
}
