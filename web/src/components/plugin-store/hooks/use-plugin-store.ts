import { create } from "zustand"
import { useShallow } from "zustand/react/shallow"
import {
  AnnotationCapability,
  AnnotationState,
} from "@/components/pdf-container/plugin-annotation-2"
import type { DocumentManagerCapability } from "@/components/pdf-container/plugin-document-manager-2"
import type { ScrollCapability } from "@/components/pdf-container/plugin-scroll-2"
import type { SelectionCapability } from "@/components/pdf-container/plugin-selection-2"

interface PluginStore {
  annoCapability: AnnotationCapability | null
  annoState: AnnotationState | null
  selectCapability: SelectionCapability | null
  scrollCapability: ScrollCapability | null
  docManagerCapability: DocumentManagerCapability | null
  setAnnoCapability: (capability: AnnotationCapability | null) => void
  setAnnoState: (state: AnnotationState | null) => void
  setSelectCapability: (capability: SelectionCapability | null) => void
  setScrollCapability: (capability: ScrollCapability | null) => void
  setDocManagerCapability: (capability: DocumentManagerCapability | null) => void
}

// use entire store (rerenders on any state change)
const usePluginStore = create<PluginStore>((set) => ({
  annoCapability: null,
  annoState: null,
  selectCapability: null,
  scrollCapability: null,
  docManagerCapability: null,
  setAnnoCapability: (annoCapability) => set({ annoCapability }),
  setAnnoState: (annoState) => set({ annoState }),
  setSelectCapability: (selectCapability) => set({ selectCapability }),
  setScrollCapability: (scrollCapability) => set({ scrollCapability }),
  setDocManagerCapability: (docManagerCapability) => set({ docManagerCapability }),
}))
export default usePluginStore

// use only capabilities (only rerenders when capabilities are set, which should be exactly once in plugin-store-sync)
export const usePluginCapabilities = () =>
  usePluginStore(
    useShallow((state: PluginStore) => ({
      annoCapability: state.annoCapability,
      selectCapability: state.selectCapability,
      scrollCapability: state.scrollCapability,
      docManagerCapability: state.docManagerCapability,
    })),
  )
