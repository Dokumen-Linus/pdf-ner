import { afterEach, describe, expect, it } from "bun:test"

import usePluginStore from "./use-plugin-store"

afterEach(() => {
  usePluginStore.getState().setActiveDocumentId(null)
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
})
