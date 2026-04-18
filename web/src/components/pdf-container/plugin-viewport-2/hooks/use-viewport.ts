import {
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react"
import { useCapability, usePlugin } from "@embedpdf/core/react"

import { ViewportElementContext } from "../context"
import { ScrollActivity, ViewportPlugin } from "../lib"

export const useViewportPlugin = () => usePlugin<ViewportPlugin>(ViewportPlugin.id)
export const useViewportCapability = () => useCapability<ViewportPlugin>(ViewportPlugin.id)

/**
 * Hook to get the viewport DOM element ref from context.
 * Must be used within a Viewport component.
 */
export const useViewportElement = (): RefObject<HTMLDivElement | null> | null => {
  return useContext(ViewportElementContext)
}

/**
 * Hook to get the gated state of the viewport for a specific document.
 * The viewport children are not rendered when gated.
 * @param documentId Document ID.
 */
export const useIsViewportGated = (documentId: string) => {
  const { provides } = useViewportCapability()

  const isGated = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) =>
        provides?.onGateChange((event) => {
          if (event.documentId === documentId) onStoreChange()
        }) ?? (() => {}),
      [provides, documentId],
    ),
    () => provides?.isGated(documentId) ?? false,
    () => false,
  )

  return isGated
}

/**
 * Hook to get scroll activity for a specific document
 * @param documentId Document ID.
 */
export const useViewportScrollActivity = (documentId: string) => {
  const { provides } = useViewportCapability()
  const [scrollActivity, setScrollActivity] = useState<ScrollActivity>({
    isScrolling: false,
    isSmoothScrolling: false,
  })

  useEffect(() => {
    if (!provides) return

    // Subscribe to scroll activity events
    return provides.onScrollActivity((event) => {
      // Filter by documentId if provided
      if (event.documentId === documentId) {
        setScrollActivity(event.activity)
      }
    })
  }, [provides, documentId])

  return scrollActivity
}
