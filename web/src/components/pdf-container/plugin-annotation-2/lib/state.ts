import type { Commit, PdfTextMarkupAnnotationObject, Subtype } from "./types"

// ***PLUGIN STATE***
export interface AnnotationState {
  documents: Record<string, AnnotationDocumentState>
  activeDocumentId: string | null

  selectedUid: string | null
  activeColor: string
  activeOpacity: number
  activeSubtype: Subtype | null
  activeEntityType: string
  canUndo: boolean
  canRedo: boolean
}

export interface AnnotationDocumentState {
  // annotation uid -> annotation object
  byUid: Record<string, PdfTextMarkupAnnotationObject>
  // page index -> annotation uids
  byPage: Record<number, string[]>
  // entity type -> annotation uids
  byEntityType: Record<string, string[]>

  pendingCommits: Commit[]
}

// ***INITIAL STATE***
export const initialState: AnnotationState = {
  documents: {},
  activeDocumentId: null,
  selectedUid: null,
  activeColor: "#FFCD45",
  activeOpacity: 0.5,
  activeSubtype: null,
  activeEntityType: "",
  canUndo: false,
  canRedo: false,
}

export const initialDocumentState: AnnotationDocumentState = {
  byUid: {},
  byPage: {},
  byEntityType: {},
  pendingCommits: [],
}
