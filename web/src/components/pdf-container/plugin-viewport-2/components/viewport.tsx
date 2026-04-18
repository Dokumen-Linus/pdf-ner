import { HTMLAttributes, ReactNode } from "react"

import { ViewportElementContext } from "../context"
import { useIsViewportGated, useViewportCapability } from "../hooks"
import { useViewportRef } from "../hooks/use-viewport-ref"

type ViewportProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  /**
   * The ID of the document that this viewport displays
   */
  documentId: string
}

export function Viewport({ children, documentId, ...props }: ViewportProps) {
  const viewportRef = useViewportRef(documentId)
  const { provides: viewportProvides } = useViewportCapability()
  const isGated = useIsViewportGated(documentId)

  const viewportGap = viewportProvides?.getViewportGap() ?? 0

  const { style, ...restProps } = props

  return (
    <ViewportElementContext.Provider value={viewportRef}>
      <div
        {...restProps}
        ref={viewportRef}
        style={{
          width: "100%",
          height: "100%",
          overflow: "auto",
          ...(typeof style === "object" ? style : {}),
          padding: `${viewportGap}px`,
        }}
      >
        {!isGated && children}
      </div>
    </ViewportElementContext.Provider>
  )
}
