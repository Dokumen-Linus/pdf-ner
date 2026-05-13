import { PdfAnnotationSubtype } from "@embedpdf/models"
import { describe, expect, it } from "bun:test"

import {
  batchCreateAnnotations,
  batchDeleteAnnotations,
  batchUpdateAnnotations,
  cleanupAnnotationState,
  createAnnotation,
  deleteAnnotation,
  deselectAnnotation,
  emptyPendingCommits,
  initAnnotationState,
  reducer,
  selectAnnotation,
  setActiveDocument,
  setCanUndoRedo,
  setCreateAnnotationDefaults,
  updateAnnotation,
} from "./actions"
import { initialDocumentState, initialState } from "./state"
import { CommitType, type PdfTextMarkupAnnotationObject } from "./types"

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

function freshDocumentState() {
  return structuredClone(initialDocumentState)
}

describe("annotation active document reducer state", () => {
  it("tracks the active document without dropping per-document annotations", () => {
    let state = reducer(initialState, initAnnotationState("doc-a", freshDocumentState()))
    state = reducer(state, initAnnotationState("doc-b", freshDocumentState()))
    state = reducer(state, createAnnotation("doc-a", annotation("anno-a", "Name")))
    state = reducer(state, createAnnotation("doc-b", annotation("anno-b", "Total")))

    state = reducer(state, setActiveDocument("doc-b"))

    expect(state.activeDocumentId).toBe("doc-b")
    expect(state.documents["doc-a"].byEntityType.Name).toEqual(["anno-a"])
    expect(state.documents["doc-b"].byEntityType.Total).toEqual(["anno-b"])
  })

  it("selects only annotations from the active document", () => {
    let state = reducer(initialState, initAnnotationState("doc-a", freshDocumentState()))
    state = reducer(state, initAnnotationState("doc-b", freshDocumentState()))
    state = reducer(state, createAnnotation("doc-a", annotation("anno-a", "Name")))
    state = reducer(state, createAnnotation("doc-b", annotation("anno-b", "Name")))

    state = reducer(state, setActiveDocument("doc-b"))
    state = reducer(state, selectAnnotation("anno-a"))
    expect(state.selectedUid).toBeNull()

    state = reducer(state, selectAnnotation("anno-b"))
    expect(state.selectedUid).toBe("anno-b")
  })

  it("updates annotations only in the provided document", () => {
    let state = reducer(initialState, initAnnotationState("doc-a", freshDocumentState()))
    state = reducer(state, initAnnotationState("doc-b", freshDocumentState()))
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

  it("cleans up a document and clears active state when the active document is removed", () => {
    let state = reducer(initialState, initAnnotationState("doc-a", freshDocumentState()))
    state = reducer(state, initAnnotationState("doc-b", freshDocumentState()))
    state = reducer(state, setActiveDocument("doc-b"))

    state = reducer(state, cleanupAnnotationState("doc-b"))

    expect(state.documents["doc-b"]).toBeUndefined()
    expect(state.documents["doc-a"]).toBeDefined()
    expect(state.activeDocumentId).toBeNull()
  })

  it("updates creation defaults without replacing omitted values", () => {
    const state = reducer(
      initialState,
      setCreateAnnotationDefaults({
        color: "#00FF00",
        opacity: 0.75,
        subtype: "highlight",
        entityType: "InvoiceNumber",
      }),
    )

    const updated = reducer(state, setCreateAnnotationDefaults({ subtype: null }))

    expect(updated.activeColor).toBe("#00FF00")
    expect(updated.activeOpacity).toBe(0.75)
    expect(updated.activeSubtype).toBeNull()
    expect(updated.activeEntityType).toBe("InvoiceNumber")
  })

  it("derives undo and redo availability from timeline position", () => {
    expect(reducer(initialState, setCanUndoRedo(-1, 3))).toMatchObject({
      canUndo: false,
      canRedo: true,
    })
    expect(reducer(initialState, setCanUndoRedo(1, 3))).toMatchObject({
      canUndo: true,
      canRedo: true,
    })
    expect(reducer(initialState, setCanUndoRedo(2, 3))).toMatchObject({
      canUndo: true,
      canRedo: false,
    })
  })

  it("batch creates annotations and records create commits", () => {
    let state = reducer(initialState, initAnnotationState("doc-a", freshDocumentState()))

    state = reducer(
      state,
      batchCreateAnnotations("doc-a", [
        annotation("anno-a", "Name"),
        { ...annotation("anno-b", "Total"), pageIndex: 1 },
      ]),
    )

    expect(Object.keys(state.documents["doc-a"].byUid)).toEqual(["anno-a", "anno-b"])
    expect(state.documents["doc-a"].byPage).toEqual({ 0: ["anno-a"], 1: ["anno-b"] })
    expect(state.documents["doc-a"].byEntityType).toEqual({
      Name: ["anno-a"],
      Total: ["anno-b"],
    })
    expect(state.documents["doc-a"].pendingCommits.map((commit) => commit.type)).toEqual([
      CommitType.Create,
      CommitType.Create,
    ])
  })

  it("moves annotations between entity type indexes on updates", () => {
    let state = reducer(initialState, initAnnotationState("doc-a", freshDocumentState()))
    state = reducer(state, createAnnotation("doc-a", annotation("anno-a", "Name")))

    state = reducer(
      state,
      updateAnnotation("doc-a", "anno-a", {
        custom: { entityType: "Total" },
      }),
    )

    expect(state.documents["doc-a"].byEntityType.Name).toEqual([])
    expect(state.documents["doc-a"].byEntityType.Total).toEqual(["anno-a"])
    expect(state.documents["doc-a"].pendingCommits.at(-1)?.type).toBe(CommitType.Update)
  })

  it("batch updates existing annotations and ignores missing ids", () => {
    let state = reducer(initialState, initAnnotationState("doc-a", freshDocumentState()))
    state = reducer(state, createAnnotation("doc-a", annotation("anno-a", "Name")))

    state = reducer(
      state,
      batchUpdateAnnotations("doc-a", [
        { id: "anno-a", patch: { color: "#0000FF", custom: { entityType: "Date" } } },
        { id: "missing", patch: { color: "#FF0000" } },
      ]),
    )

    expect(state.documents["doc-a"].byUid["anno-a"].color).toBe("#0000FF")
    expect(state.documents["doc-a"].byEntityType.Name).toEqual([])
    expect(state.documents["doc-a"].byEntityType.Date).toEqual(["anno-a"])
    expect(
      state.documents["doc-a"].pendingCommits.filter((commit) => commit.type === CommitType.Update),
    ).toHaveLength(1)
  })

  it("deletes annotations from uid, page, entity type, and pending commits", () => {
    let state = reducer(initialState, initAnnotationState("doc-a", freshDocumentState()))
    state = reducer(state, createAnnotation("doc-a", annotation("anno-a", "Name")))

    state = reducer(state, deleteAnnotation("doc-a", "anno-a"))

    expect(state.documents["doc-a"].byUid["anno-a"]).toBeUndefined()
    expect(state.documents["doc-a"].byPage[0]).toEqual([])
    expect(state.documents["doc-a"].byEntityType.Name).toEqual([])
    expect(state.documents["doc-a"].pendingCommits.at(-1)?.type).toBe(CommitType.Delete)
  })

  it("batch deletes existing annotations and ignores missing ids", () => {
    let state = reducer(initialState, initAnnotationState("doc-a", freshDocumentState()))
    state = reducer(
      state,
      batchCreateAnnotations("doc-a", [annotation("anno-a", "Name"), annotation("anno-b", "Name")]),
    )

    state = reducer(state, batchDeleteAnnotations("doc-a", ["anno-a", "missing"]))

    expect(Object.keys(state.documents["doc-a"].byUid)).toEqual(["anno-b"])
    expect(state.documents["doc-a"].byPage[0]).toEqual(["anno-b"])
    expect(state.documents["doc-a"].byEntityType.Name).toEqual(["anno-b"])
    expect(
      state.documents["doc-a"].pendingCommits.filter((commit) => commit.type === CommitType.Delete),
    ).toHaveLength(1)
  })

  it("clears pending commits for one document without touching annotations", () => {
    let state = reducer(initialState, initAnnotationState("doc-a", freshDocumentState()))
    state = reducer(state, createAnnotation("doc-a", annotation("anno-a", "Name")))

    state = reducer(state, emptyPendingCommits("doc-a"))

    expect(state.documents["doc-a"].byUid["anno-a"]).toBeDefined()
    expect(state.documents["doc-a"].pendingCommits).toEqual([])
  })

  it("returns the same state for missing-document mutations", () => {
    expect(reducer(initialState, createAnnotation("missing", annotation("anno-a", "Name")))).toBe(
      initialState,
    )
    expect(reducer(initialState, updateAnnotation("missing", "anno-a", { color: "#000" }))).toBe(
      initialState,
    )
    expect(reducer(initialState, deleteAnnotation("missing", "anno-a"))).toBe(initialState)
    expect(reducer(initialState, emptyPendingCommits("missing"))).toBe(initialState)
  })

  it("deselects the current annotation", () => {
    let state = reducer(initialState, initAnnotationState("doc-a", freshDocumentState()))
    state = reducer(state, createAnnotation("doc-a", annotation("anno-a", "Name")))
    state = reducer(state, selectAnnotation("anno-a"))

    state = reducer(state, deselectAnnotation())

    expect(state.selectedUid).toBeNull()
  })
})
