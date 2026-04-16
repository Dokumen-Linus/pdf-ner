import { CSSProperties, HTMLAttributes, useCallback, useMemo, useSyncExternalStore } from "react"
import { useDocumentState } from "@embedpdf/core/react"
import { useSearchCapability } from "../hooks"

type SearchLayoutProps = Omit<HTMLAttributes<HTMLDivElement>, "style"> & {
  documentId: string
  pageIndex: number
  scale?: number
  highlightColor?: string
  activeHighlightColor?: string
  style?: CSSProperties
}

export function SearchLayer({
  documentId,
  pageIndex,
  scale: scaleOverride,
  style,
  highlightColor = "#FFFF00",
  activeHighlightColor = "#FFBF00",
  ...props
}: SearchLayoutProps) {
  const { provides: searchProvides } = useSearchCapability()
  const documentState = useDocumentState(documentId)

  const scope = useMemo(() => searchProvides?.forDocument(documentId), [searchProvides, documentId])

  const actualScale = useMemo(() => {
    if (scaleOverride !== undefined) return scaleOverride
    return documentState?.scale ?? 1
  }, [scaleOverride, documentState?.scale])

  const rawState = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) => scope?.onStateChange(() => onStoreChange()) ?? (() => {}),
      [scope],
    ),
    () => scope?.getState() ?? null,
    () => null,
  )

  if (!rawState || !rawState.active) {
    return null
  }

  const searchResultState = {
    results: rawState.results,
    activeResultIndex: rawState.activeResultIndex,
    showAllResults: rawState.showAllResults,
    active: rawState.active,
  }

  // Filter results for current page while preserving original indices
  const pageResults = searchResultState.results
    .map((result, originalIndex) => ({ result, originalIndex }))
    .filter(({ result }) => result.pageIndex === pageIndex)

  // Decide which results to show
  const resultsToShow = pageResults.filter(
    ({ originalIndex }) =>
      searchResultState.showAllResults || originalIndex === searchResultState.activeResultIndex,
  )

  return (
    <div
      style={{
        ...style,
        pointerEvents: "none",
      }}
      {...props}
    >
      {resultsToShow.map(({ result, originalIndex }) =>
        result.rects.map((rect, rectIndex) => (
          <div
            key={`${originalIndex}-${rectIndex}`}
            style={{
              position: "absolute",
              top: rect.origin.y * actualScale,
              left: rect.origin.x * actualScale,
              width: rect.size.width * actualScale,
              height: rect.size.height * actualScale,
              backgroundColor:
                originalIndex === searchResultState.activeResultIndex
                  ? activeHighlightColor
                  : highlightColor,
              mixBlendMode: "multiply",
              transform: "scale(1.02)",
              transformOrigin: "center",
              transition: "opacity .3s ease-in-out",
              opacity: 1,
            }}
          ></div>
        )),
      )}
    </div>
  )
}
