import { useEffect } from "react"

import { useAnnotationCapability } from "../../pdf-container/plugin-annotation-2"
import { useDocumentManagerCapability } from "../../pdf-container/plugin-document-manager-2"
import { useScrollCapability } from "../../pdf-container/plugin-scroll-2"
import { useSearchCapability } from "../../pdf-container/plugin-search-2"
import { useSelectionCapability } from "../../pdf-container/plugin-selection-2"
import usePluginStore from "../hooks/use-plugin-store"

const PluginStoreSync = () => {
  const { provides: annoCapability } = useAnnotationCapability()
  const { provides: searchCapability } = useSearchCapability()
  const { provides: selectCapability } = useSelectionCapability()
  const { provides: scrollCapability } = useScrollCapability()
  const { provides: docManagerCapability } = useDocumentManagerCapability()

  useEffect(() => {
    if (
      !annoCapability ||
      !searchCapability ||
      !selectCapability ||
      !scrollCapability ||
      !docManagerCapability
    ) {
      return
    }

    const store = usePluginStore.getState()

    // initialize capabilities (which are static)
    store.setAnnoCapability(annoCapability)
    store.setSearchCapability(searchCapability)
    store.setSelectCapability(selectCapability)
    store.setScrollCapability(scrollCapability)
    store.setDocManagerCapability(docManagerCapability)

    // sync store with changes
    const syncState = annoCapability.onStateChange((state) => {
      store.setAnnoState(state)
    })

    return () => {
      syncState()
      // clear store values when unmounting
      store.setAnnoCapability(null)
      store.setAnnoState(null)
      store.setSearchCapability(null)
      store.setSelectCapability(null)
      store.setScrollCapability(null)
      store.setDocManagerCapability(null)
    }
  }, [annoCapability, searchCapability, selectCapability, scrollCapability, docManagerCapability])

  return null
}
export default PluginStoreSync
