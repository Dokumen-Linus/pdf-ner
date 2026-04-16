import { useCallback, useMemo, useSyncExternalStore } from "react"
import { useCapability, usePlugin } from "@embedpdf/core/react"
import { initialSearchDocumentState, SearchDocumentState, SearchPlugin, SearchScope } from "../lib"

export const useSearchPlugin = () => usePlugin<SearchPlugin>(SearchPlugin.id)
export const useSearchCapability = () => useCapability<SearchPlugin>(SearchPlugin.id)

export const useSearch = (
  documentId: string,
): {
  state: SearchDocumentState
  provides: SearchScope | null
} => {
  const { provides } = useSearchCapability()

  const scope = useMemo(() => provides?.forDocument(documentId), [provides, documentId])

  const subscribe = useCallback(
    (onStoreChange: () => void) => scope?.onStateChange(() => onStoreChange()) ?? (() => {}),
    [scope],
  )

  const getSnapshot = useCallback(
    (): SearchDocumentState => scope?.getState() ?? initialSearchDocumentState,
    [scope],
  )

  const state = useSyncExternalStore(subscribe, getSnapshot, () => initialSearchDocumentState)

  return {
    state,
    provides: scope ?? null,
  }
}
