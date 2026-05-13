import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "bun:test"

import usePluginStore, { usePluginCapabilities } from "./use-plugin-store"

import type { AnnotationCapability } from "@/components/pdf-container/plugin-annotation-2"
import type { DocumentManagerCapability } from "@/components/pdf-container/plugin-document-manager-2"
import type { ScrollCapability } from "@/components/pdf-container/plugin-scroll-2"
import type { SearchCapability } from "@/components/pdf-container/plugin-search-2"
import type { SelectionCapability } from "@/components/pdf-container/plugin-selection-2"

afterEach(() => {
  usePluginStore.getState().setActiveDocumentId(null)
  usePluginStore.getState().setAnnoCapability(null)
  usePluginStore.getState().setAnnoState(null)
  usePluginStore.getState().setSearchCapability(null)
  usePluginStore.getState().setSelectCapability(null)
  usePluginStore.getState().setScrollCapability(null)
  usePluginStore.getState().setDocManagerCapability(null)
})

describe("usePluginStore activeDocumentId", () => {
  it("stores the UI active document independently from annotation state", () => {
    usePluginStore.getState().setAnnoState({
      activeDocumentId: "doc-a",
      documents: {},
      selectedUid: null,
      activeColor: "#FFCD45",
      activeOpacity: 0.5,
      activeSubtype: null,
      activeEntityType: "",
      canUndo: false,
      canRedo: false,
    })

    usePluginStore.getState().setActiveDocumentId("doc-b")

    expect(usePluginStore.getState().activeDocumentId).toBe("doc-b")
    expect(usePluginStore.getState().annoState?.activeDocumentId).toBe("doc-a")
  })

  it("clears the UI active document", () => {
    usePluginStore.getState().setActiveDocumentId("doc-b")
    usePluginStore.getState().setActiveDocumentId(null)

    expect(usePluginStore.getState().activeDocumentId).toBeNull()
  })

  it("selects only plugin capabilities from the store", () => {
    const annoCapability = { kind: "anno" } as unknown as AnnotationCapability
    const searchCapability = { kind: "search" } as unknown as SearchCapability
    const selectCapability = { kind: "select" } as unknown as SelectionCapability
    const scrollCapability = { kind: "scroll" } as unknown as ScrollCapability
    const docManagerCapability = { kind: "doc-manager" } as unknown as DocumentManagerCapability

    usePluginStore.getState().setActiveDocumentId("doc-a")
    usePluginStore.getState().setAnnoCapability(annoCapability)
    usePluginStore.getState().setSearchCapability(searchCapability)
    usePluginStore.getState().setSelectCapability(selectCapability)
    usePluginStore.getState().setScrollCapability(scrollCapability)
    usePluginStore.getState().setDocManagerCapability(docManagerCapability)

    const { result } = renderHook(() => usePluginCapabilities())

    expect(result.current).toEqual({
      annoCapability,
      searchCapability,
      selectCapability,
      scrollCapability,
      docManagerCapability,
    })
    expect(result.current).not.toHaveProperty("activeDocumentId")
    expect(result.current).not.toHaveProperty("annoState")
  })
})
