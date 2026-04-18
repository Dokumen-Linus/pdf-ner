import {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react"

import { useThumbnailPlugin } from "../hooks"
import { ThumbMeta } from "../lib"

type ThumbnailsProps = Omit<HTMLAttributes<HTMLDivElement>, "style" | "children"> & {
  /**
   * The ID of the document that this thumbnail pane displays
   */
  documentId: string
  style?: CSSProperties
  children: (m: ThumbMeta) => ReactNode
}

export function ThumbnailsPane({ documentId, style, children, ...props }: ThumbnailsProps) {
  const { plugin: thumbnailPlugin } = useThumbnailPlugin()
  const viewportRef = useRef<HTMLDivElement>(null)

  // 1) subscribe to window updates via useSyncExternalStore (avoids synchronous setState in effect)
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!thumbnailPlugin) return () => {}
      const scope = thumbnailPlugin.provides().forDocument(documentId)
      return scope.onWindow(() => onStoreChange())
    },
    [thumbnailPlugin, documentId],
  )

  const window = useSyncExternalStore(
    subscribe,
    () => thumbnailPlugin?.provides().forDocument(documentId)?.getWindow() ?? null,
    () => null,
  )

  // 2) keep plugin in sync while the user scrolls
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp || !thumbnailPlugin) return
    const scope = thumbnailPlugin.provides().forDocument(documentId)
    const onScroll = () => scope.updateWindow(vp.scrollTop, vp.clientHeight)
    vp.addEventListener("scroll", onScroll)
    return () => vp.removeEventListener("scroll", onScroll)
  }, [thumbnailPlugin, documentId])

  // 2.5) keep plugin in sync when viewport resizes
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp || !thumbnailPlugin) return

    const scope = thumbnailPlugin.provides().forDocument(documentId)
    const resizeObserver = new ResizeObserver(() => {
      scope.updateWindow(vp.scrollTop, vp.clientHeight)
    })
    resizeObserver.observe(vp)

    return () => resizeObserver.disconnect()
  }, [thumbnailPlugin, documentId])

  // 3) kick-start after document change
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp || !thumbnailPlugin) return

    const scope = thumbnailPlugin.provides().forDocument(documentId)
    scope.updateWindow(vp.scrollTop, vp.clientHeight)
  }, [window, thumbnailPlugin, documentId])

  // 4) let plugin drive scroll
  const hasWindow = !!window
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp || !thumbnailPlugin || !hasWindow) return

    const scope = thumbnailPlugin.provides().forDocument(documentId)
    return scope.onScrollTo(({ top, behavior }) => {
      vp.scrollTo({ top, behavior })
    })
  }, [thumbnailPlugin, documentId, hasWindow])

  const paddingY = thumbnailPlugin?.cfg.paddingY ?? 0

  return (
    <div
      ref={viewportRef}
      style={{
        overflowY: "auto",
        position: "relative",
        paddingTop: paddingY,
        paddingBottom: paddingY,
        height: "100%",
        ...style,
      }}
      {...props}
    >
      <div style={{ height: window?.totalHeight ?? 0, position: "relative" }}>
        {window?.items.map((m) => children(m))}
      </div>
    </div>
  )
}
