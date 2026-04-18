import { useCallback, useMemo, useSyncExternalStore } from "react"
import { useCapability, usePlugin } from "@embedpdf/core/react"

import { initialDocumentState, ZoomDocumentState, ZoomPlugin } from "../lib"

export const useZoomCapability = () => useCapability<ZoomPlugin>(ZoomPlugin.id)
export const useZoomPlugin = () => usePlugin<ZoomPlugin>(ZoomPlugin.id)

/**
 * Hook for zoom state for a specific document
 * @param documentId Document ID
 */
export const useZoom = (documentId: string) => {
  const { provides } = useZoomCapability()
  const scope = useMemo(() => provides?.forDocument(documentId), [provides, documentId])

  const subscribe = useCallback(
    (onStoreChange: () => void) => scope?.onStateChange(() => onStoreChange()) ?? (() => {}),
    [scope],
  )

  const getSnapshot = useCallback(
    (): ZoomDocumentState => scope?.getState() ?? initialDocumentState,
    [scope],
  )

  const state = useSyncExternalStore(subscribe, getSnapshot, () => initialDocumentState)

  return {
    state,
    provides: scope ?? null,
  }
}
