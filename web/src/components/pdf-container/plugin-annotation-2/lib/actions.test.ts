import { PdfAnnotationSubtype } from "@embedpdf/models"
import { describe, expect, it } from "bun:test"

import {
  createAnnotation,
  initAnnotationState,
  reducer,
  selectAnnotation,
  setActiveDocument,
  updateAnnotation,
} from "./actions"
import { initialDocumentState, initialState } from "./state"

import type { PdfTextMarkupAnnotationObject } from "./types"

function annotation(id: string, entityType: string): PdfTextMarkupAnnotationObject {
  return {
    id,
    type: PdfAnnotationSubtype.HIGHLIGHT,
    color: "#FFFF00",
    opacity: 0.5,
    rect: { origin: { x: 0, y: 0 }, size: { width: 10, height: 10 } },
    segmentRects: [{ origin: { x: 0, y: 0 }, size: { width: 10, height: 10 } }],
    pageIndex: 0,
    contents: id,
    custom: { entityType },
  } as PdfTextMarkupAnnotationObject
}

describe("annotation active document reducer state", () => {
  it("tracks the active document without dropping per-document annotations", () => {
    let state = reducer(initialState, initAnnotationState("doc-a", initialDocumentState))
    state = reducer(state, initAnnotationState("doc-b", initialDocumentState))
    state = reducer(state, createAnnotation("doc-a", annotation("anno-a", "Name")))
    state = reducer(state, createAnnotation("doc-b", annotation("anno-b", "Total")))

    state = reducer(state, setActiveDocument("doc-b"))

    expect(state.activeDocumentId).toBe("doc-b")
    expect(state.documents["doc-a"].byEntityType.Name).toEqual(["anno-a"])
    expect(state.documents["doc-b"].byEntityType.Total).toEqual(["anno-b"])
  })

  it("selects only annotations from the active document", () => {
    let state = reducer(initialState, initAnnotationState("doc-a", initialDocumentState))
    state = reducer(state, initAnnotationState("doc-b", initialDocumentState))
    state = reducer(state, createAnnotation("doc-a", annotation("anno-a", "Name")))
    state = reducer(state, createAnnotation("doc-b", annotation("anno-b", "Name")))

    state = reducer(state, setActiveDocument("doc-b"))
    state = reducer(state, selectAnnotation("anno-a"))
    expect(state.selectedUid).toBeNull()

    state = reducer(state, selectAnnotation("anno-b"))
    expect(state.selectedUid).toBe("anno-b")
  })

  it("updates annotations only in the provided document", () => {
    let state = reducer(initialState, initAnnotationState("doc-a", initialDocumentState))
    state = reducer(state, initAnnotationState("doc-b", initialDocumentState))
    state = reducer(state, createAnnotation("doc-a", annotation("anno-a", "Name")))
    state = reducer(state, createAnnotation("doc-b", annotation("anno-b", "Name")))

    state = reducer(
      state,
      updateAnnotation("doc-b", "anno-b", {
        color: "#FF0000",
      }),
    )

    expect(state.documents["doc-a"].byUid["anno-a"].color).toBe("#FFFF00")
    expect(state.documents["doc-b"].byUid["anno-b"].color).toBe("#FF0000")
  })
})
