import { useCallback, useSyncExternalStore } from "react"
import { useCapability, usePlugin } from "@embedpdf/core/react"

import { ScrollPlugin, ScrollScope } from "../lib"

export const useScrollPlugin = () => usePlugin<ScrollPlugin>(ScrollPlugin.id)
export const useScrollCapability = () => useCapability<ScrollPlugin>(ScrollPlugin.id)

// Define the return type explicitly to maintain type safety
interface UseScrollReturn {
  provides: ScrollScope | null
  state: {
    currentPage: number
    totalPages: number
  }
}

export const useScroll = (documentId: string): UseScrollReturn => {
  const { provides } = useScrollCapability()

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      provides?.onPageChange((event) => {
        if (event.documentId === documentId) onStoreChange()
      }) ?? (() => {}),
    [provides, documentId],
  )

  const currentPage = useSyncExternalStore(
    subscribe,
    () => provides?.forDocument(documentId)?.getCurrentPage() ?? 1,
    () => 1,
  )

  const totalPages = useSyncExternalStore(
    subscribe,
    () => provides?.forDocument(documentId)?.getTotalPages() ?? 1,
    () => 1,
  )

  return {
    provides: provides?.forDocument(documentId) ?? null,
    state: { currentPage, totalPages },
  }
}
