import type { Action, Reducer } from "@embedpdf/core"
import { CommitType, PdfTextMarkupAnnotationObject, Subtype } from "./types"
import type { AnnotationDocumentState, AnnotationState } from "./state"

// ***ACTION CONSTANTS***
// document lifecycle
export const INIT_ANNOTATION_STATE = 'ANNOTATION/INIT_STATE'
export const CLEANUP_ANNOTATION_STATE = 'ANNOTATION/CLEANUP_STATE'
export const SET_ACTIVE_DOCUMENT = 'ANNOTATION/SET_ACTIVE_DOCUMENT'

// global actions
export const SELECT_ANNOTATION = "ANNOTATION/SELECT_ANNOTATION"
export const DESELECT_ANNOTATION = "ANNOTATION/DESELECT_ANNOTATION"
export const SET_CREATE_ANNOTATION_DEFAULTS = "ANNOTATION/SET_CREATE_ANNOTATION_DEFAULTS"
export const SET_CAN_UNDO_REDO = "ANNOTATION/SET_CAN_UNDO_REDO"

// per-document actions (modify AnnotationDocumentState)
export const BATCH_CREATE_ANNOTATIONS = "ANNOTATION/BATCH_CREATE_ANNOTATIONS"
export const CREATE_ANNOTATION = "ANNOTATION/CREATE_ANNOTATION"
export const BATCH_UPDATE_ANNOTATIONS = "ANNOTATION/BATCH_UPDATE_ANNOTATIONS"
export const UPDATE_ANNOTATION = "ANNOTATION/UPDATE_ANNOTATION"
export const BATCH_DELETE_ANNOTATIONS = "ANNOTATION/BATCH_DELETE_ANNOTATIONS"
export const DELETE_ANNOTATION = "ANNOTATION/DELETE_ANNOTATION"
export const EMPTY_PENDING_COMMITS = "ANNOTATION/EMPTY_PENDING_COMMITS"

// ***ACTION INTERFACES***
export interface InitAnnotationStateAction extends Action {
  type: typeof INIT_ANNOTATION_STATE;
  payload: {
    documentId: string;
    state: AnnotationDocumentState;
  };
}
export interface CleanupAnnotationStateAction extends Action {
  type: typeof CLEANUP_ANNOTATION_STATE;
  payload: string; // documentId
}
export interface SetActiveDocumentAction extends Action {
  type: typeof SET_ACTIVE_DOCUMENT;
  payload: string | null; // documentId
}

export interface SelectAnnotationAction extends Action {
  type: typeof SELECT_ANNOTATION
  payload: { id: string }
}
export interface DeselectAnnotationAction extends Action {
  type: typeof DESELECT_ANNOTATION
}
export interface SetCreateAnnotationDefaultsAction extends Action {
  type: typeof SET_CREATE_ANNOTATION_DEFAULTS
  payload: {
    color?: string
    opacity?: number
    subtype?: Subtype | null
    entityType?: string
  }
}
export interface SetCanUndoRedoAction extends Action {
  type: typeof SET_CAN_UNDO_REDO
  payload: { timelineIndex: number; timelineLength: number }
}

export interface BatchCreateAnnotationsAction extends Action {
  type: typeof BATCH_CREATE_ANNOTATIONS
  payload: { documentId: string; annotations: PdfTextMarkupAnnotationObject[]}
}
export interface CreateAnnotationAction extends Action {
  type: typeof CREATE_ANNOTATION
  payload: { documentId: string; annotation: PdfTextMarkupAnnotationObject }
}
export interface BatchUpdateAnnotationsAction extends Action {
  type: typeof BATCH_UPDATE_ANNOTATIONS
  payload: { documentId: string; items: { id: string; patch: Partial<PdfTextMarkupAnnotationObject> }[] }
}
export interface UpdateAnnotationAction extends Action {
  type: typeof UPDATE_ANNOTATION
  payload: { documentId: string; id: string; patch: Partial<PdfTextMarkupAnnotationObject> }
}
export interface BatchDeleteAnnotationsAction extends Action {
  type: typeof BATCH_DELETE_ANNOTATIONS
  payload: { documentId: string; ids: string[] }
}
export interface DeleteAnnotationAction extends Action {
  type: typeof DELETE_ANNOTATION
  payload: { documentId: string; id: string }
}
export interface EmptyPendingCommitsAction extends Action {
  type: typeof EMPTY_PENDING_COMMITS
  payload: { documentId: string }
}

// ***ACTION UNION***
export type AnnotationAction =
  | InitAnnotationStateAction
  | CleanupAnnotationStateAction
  | SetActiveDocumentAction
  | SelectAnnotationAction
  | DeselectAnnotationAction
  | SetCreateAnnotationDefaultsAction
  | SetCanUndoRedoAction
  | BatchCreateAnnotationsAction
  | CreateAnnotationAction
  | BatchUpdateAnnotationsAction
  | UpdateAnnotationAction
  | BatchDeleteAnnotationsAction
  | DeleteAnnotationAction
  | EmptyPendingCommitsAction

// ***ACTION CREATORS***
export function initAnnotationState(
  documentId: string,
  state: AnnotationDocumentState,
): InitAnnotationStateAction {
  return { type: INIT_ANNOTATION_STATE, payload: { documentId, state } };
}
export function cleanupAnnotationState(documentId: string): CleanupAnnotationStateAction {
  return { type: CLEANUP_ANNOTATION_STATE, payload: documentId };
}
export function setActiveDocument(documentId: string | null): SetActiveDocumentAction {
  return { type: SET_ACTIVE_DOCUMENT, payload: documentId };
}

export const selectAnnotation = (id: string): SelectAnnotationAction => ({
  type: SELECT_ANNOTATION,
  payload: { id },
})
export const deselectAnnotation = (): DeselectAnnotationAction => ({ type: DESELECT_ANNOTATION })
export const setCreateAnnotationDefaults = (defaults: {
  color?: string
  opacity?: number
  subtype?: Subtype | null
  entityType?: string
}): SetCreateAnnotationDefaultsAction => ({
  type: SET_CREATE_ANNOTATION_DEFAULTS,
  payload: defaults,
})
export const setCanUndoRedo = (
  timelineIndex: number,
  timelineLength: number,
): SetCanUndoRedoAction => ({
  type: SET_CAN_UNDO_REDO,
  payload: { timelineIndex, timelineLength },
})

export const batchCreateAnnotations = (
  documentId: string,
  annotations: PdfTextMarkupAnnotationObject[],
): BatchCreateAnnotationsAction => ({
  type: BATCH_CREATE_ANNOTATIONS,
  payload: { documentId, annotations },
})
export const createAnnotation = (
  documentId: string,
  annotation: PdfTextMarkupAnnotationObject,
): CreateAnnotationAction => ({
  type: CREATE_ANNOTATION,
  payload: { documentId, annotation },
})
export const batchUpdateAnnotations = (
  documentId: string,
  items: { id: string; patch: Partial<PdfTextMarkupAnnotationObject> }[],
): BatchUpdateAnnotationsAction => ({
  type: BATCH_UPDATE_ANNOTATIONS,
  payload: { documentId, items },
})
export const updateAnnotation = (
  documentId: string,
  id: string,
  patch: Partial<PdfTextMarkupAnnotationObject>,
): UpdateAnnotationAction => ({ type: UPDATE_ANNOTATION, payload: { documentId, id, patch } })
export const batchDeleteAnnotations = (documentId: string, ids: string[]): BatchDeleteAnnotationsAction => ({
  type: BATCH_DELETE_ANNOTATIONS,
  payload: { documentId, ids },
})
export const deleteAnnotation = (documentId: string, id: string): DeleteAnnotationAction => ({
  type: DELETE_ANNOTATION,
  payload: { documentId, id },
})
export const emptyPendingCommits = (documentId: string): EmptyPendingCommitsAction => ({
  type: EMPTY_PENDING_COMMITS,
  payload: { documentId },
})

// ***ACTION REDUCER***
export const reducer: Reducer<AnnotationState, AnnotationAction> = (state, action) => {
  switch (action.type) {
    case INIT_ANNOTATION_STATE: {
      const { documentId, state: docState } = action.payload;
      return {
        ...state,
        documents: {
          ...state.documents,
          [documentId]: docState,
        },
        // Set as active if no active document
        activeDocumentId: state.activeDocumentId ?? documentId,
      };
    }

    case CLEANUP_ANNOTATION_STATE: {
      const documentId = action.payload;
      const { [documentId]: removed, ...remainingDocs } = state.documents;
      return {
        ...state,
        documents: remainingDocs,
        activeDocumentId: state.activeDocumentId === documentId ? null : state.activeDocumentId,
      };
    }

    case SET_ACTIVE_DOCUMENT: {
      return {
        ...state,
        activeDocumentId: action.payload,
        // set global state props to null/false on active doc change
        activeSubtype: null,
        selectedUid: null,
        canUndo: false,
        canRedo: false,
      }
    }
    
    case SET_CREATE_ANNOTATION_DEFAULTS:
      return {
        ...state,
        activeColor: action.payload.color ?? state.activeColor,
        activeOpacity: action.payload.opacity ?? state.activeOpacity,
        activeSubtype:
          action.payload.subtype !== undefined ? action.payload.subtype : state.activeSubtype,
        activeEntityType: action.payload.entityType ?? state.activeEntityType,
      }

    case SELECT_ANNOTATION: {
      // if annotation is not on active document, don't select it
      if (state.activeDocumentId && state.documents[state.activeDocumentId].byUid[action.payload.id]) {
        return { ...state, selectedUid: action.payload.id }
      }
      return state
    }

    case DESELECT_ANNOTATION:
      return { ...state, selectedUid: null }

    case SET_CAN_UNDO_REDO: {
      const { timelineIndex, timelineLength } = action.payload
      const canUndo = timelineIndex > -1
      const canRedo = timelineIndex < timelineLength - 1
      return { ...state, canUndo, canRedo }
    }

    case BATCH_CREATE_ANNOTATIONS: {
      const { documentId, annotations } = action.payload
      const docState = state.documents[documentId]
      if (!docState) return state

      const newByUid = { ...docState.byUid }
      const newByPage = { ...docState.byPage }
      const newByEntityType = { ...docState.byEntityType }
      const commits = [ ...docState.pendingCommits ]
      for (const anno of annotations) {
        const pageIndex = anno.pageIndex
        const uid = anno.id
        newByUid[uid] = anno

        newByPage[pageIndex] = [...(newByPage[pageIndex] || []), uid]

        const et = anno?.custom?.entityType
        if (et) {
          newByEntityType[et] = [...(newByEntityType[et] || []), uid]
        }

        commits.push({ type: CommitType.Create, anno })
      }

      return {
        ...state,
        documents: {
          ...state.documents,
          [documentId]: {
            ...docState,
            byUid: newByUid,
            byPage: newByPage,
            byEntityType: newByEntityType,
            pendingCommits: commits
          }
        }
      }
    }
    
    case CREATE_ANNOTATION: {
      const { documentId, annotation: anno } = action.payload
      const docState = state.documents[documentId]
      if (!docState) return state
    
      const uid = anno.id
      const pageIndex = anno.pageIndex
      const et = anno.custom?.entityType
    
      return {
        ...state,
        documents: {
          ...state.documents,
          [documentId]: {
            ...docState,
            byUid: { ...docState.byUid, [uid]: anno },
            byPage: {
              ...docState.byPage,
              [pageIndex]: [...(docState.byPage[pageIndex] || []), uid],
            },
            byEntityType: et
              ? {
                  ...docState.byEntityType,
                  [et]: [...(docState.byEntityType[et] || []), uid],
                }
              : docState.byEntityType,
            pendingCommits: [
              ...docState.pendingCommits,
              { type: CommitType.Create, anno },
            ],
          },
        },
      }
    }

    case BATCH_UPDATE_ANNOTATIONS: {
      const { documentId, items } = action.payload
      const docState = state.documents[documentId]
      if (!docState) return state

      const newByUid = { ...docState.byUid }
      const newByEntityType = { ...docState.byEntityType }
      const commits = [...docState.pendingCommits]
      for (const { id, patch } of items) {
        const existing = newByUid[id]
        if (!existing) continue

        const updatedAnno = { ...existing, ...patch }
        newByUid[id] = updatedAnno

        const oldEt = existing.custom?.entityType
        const newEt = updatedAnno.custom?.entityType
        if (oldEt !== newEt) {
          if (oldEt) {
            newByEntityType[oldEt] = (newByEntityType[oldEt] || []).filter((u) => u !== id)
          }
          if (newEt) {
            newByEntityType[newEt] = [...(newByEntityType[newEt] || []), id]
          }
        }

        commits.push({ type: CommitType.Update, anno: updatedAnno })
      }

      return {
        ...state,
        documents: {
          ...state.documents,
          [documentId]: {
            ...docState,
            byUid: newByUid,
            byEntityType: newByEntityType,
            pendingCommits: commits,
          },
        },
      }
    }

    case UPDATE_ANNOTATION: {
      const { documentId, id, patch } = action.payload
      const docState = state.documents[documentId]
      if (!docState) return state

      const existing = docState.byUid[id]
      if (!existing) return state

      const updatedAnno = { ...existing, ...patch }
      const oldEt = existing.custom?.entityType
      const newEt = updatedAnno.custom?.entityType

      const newByEntityType = oldEt !== newEt
        ? {
            ...docState.byEntityType,
            ...(oldEt ? { [oldEt]: (docState.byEntityType[oldEt] || []).filter((u) => u !== id) } : {}),
            ...(newEt ? { [newEt]: [...(docState.byEntityType[newEt] || []), id] } : {}),
          }
        : docState.byEntityType

      return {
        ...state,
        documents: {
          ...state.documents,
          [documentId]: {
            ...docState,
            byUid: { ...docState.byUid, [id]: updatedAnno },
            byEntityType: newByEntityType,
            pendingCommits: [
              ...docState.pendingCommits,
              { type: CommitType.Update, anno: updatedAnno },
            ],
          },
        },
      }
    }

    case BATCH_DELETE_ANNOTATIONS: {
      const { documentId, ids } = action.payload
      const docState = state.documents[documentId]
      if (!docState) return state

      const newByUid = { ...docState.byUid }
      const newByPage = { ...docState.byPage }
      const newByEntityType = { ...docState.byEntityType }
      const commits = [...docState.pendingCommits]
      for (const uid of ids) {
        const anno = newByUid[uid]
        if (!anno) continue

        const pageIndex = anno.pageIndex
        const et = anno.custom?.entityType
        delete newByUid[uid]

        newByPage[pageIndex] = (newByPage[pageIndex] || []).filter((u) => u !== uid)

        if (et) {
          newByEntityType[et] = (newByEntityType[et] || []).filter((u) => u !== uid)
        }

        commits.push({ type: CommitType.Delete, anno })
      }

      return {
        ...state,
        documents: {
          ...state.documents,
          [documentId]: {
            ...docState,
            byUid: newByUid,
            byPage: newByPage,
            byEntityType: newByEntityType,
            pendingCommits: commits,
          },
        },
      }
    }

    case DELETE_ANNOTATION: {
      const { documentId, id: uid } = action.payload
      const docState = state.documents[documentId]
      if (!docState) return state

      const anno = docState.byUid[uid]
      if (!anno) return state

      const pageIndex = anno.pageIndex
      const et = anno.custom?.entityType

      return {
        ...state,
        documents: {
          ...state.documents,
          [documentId]: {
            ...docState,
            byUid: (({ [uid]: _, ...rest }) => rest)(docState.byUid),
            byPage: {
              ...docState.byPage,
              [pageIndex]: (docState.byPage[pageIndex] || []).filter((u) => u !== uid),
            },
            byEntityType: et
              ? {
                  ...docState.byEntityType,
                  [et]: (docState.byEntityType[et] || []).filter((u) => u !== uid),
                }
              : docState.byEntityType,
            pendingCommits: [
              ...docState.pendingCommits,
              { type: CommitType.Delete, anno },
            ],
          },
        },
      }
    }

    case EMPTY_PENDING_COMMITS: {
      const { documentId } = action.payload
      const docState = state.documents[documentId]
      if (!docState) return state
      return {
        ...state,
        documents: {
          ...state.documents,
          [documentId]: { ...docState, pendingCommits: [] },
        },
      }
    }

    default:
      return state
  }
}
