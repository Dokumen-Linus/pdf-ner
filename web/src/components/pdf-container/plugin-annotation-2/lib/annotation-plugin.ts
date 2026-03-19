import {
  BasePlugin,
  BasePluginConfig,
  createBehaviorEmitter,
  EventHook,
  PluginRegistry,
} from "@embedpdf/core"
import {
  PdfAnnotationSubtype,
  PdfErrorCode,
  PdfErrorReason,
  PdfTaskHelper,
  PdfTask,
  Task,
  uuidV4
} from "@embedpdf/models"
import {
  InteractionManagerCapability,
  InteractionManagerPlugin,
} from "../../plugin-interaction-manager-2"
import { SelectionCapability, SelectionPlugin } from "../../plugin-selection-2"
import type { AnnotationAction } from "./actions"
import {
  createAnnotation,
  cleanupAnnotationState,
  initAnnotationState,
  deleteAnnotation,
  deselectAnnotation,
  updateAnnotation,
  selectAnnotation,
  emptyPendingCommits,
  batchCreateAnnotations,
  batchUpdateAnnotations,
  batchDeleteAnnotations,
  setCanUndoRedo,
  setCreateAnnotationDefaults,
} from "./actions"
import { CommitType } from "./types"
import type { Command, Commit, PdfTextMarkupAnnotationObject, Subtype } from "./types"
import { subtypeToEnum } from "./types"
import type { AnnotationState } from "./state"
import { initialDocumentState } from "./state"

function ignore() {}

// ***PLUGIN CONFIG***
export interface AnnotationPluginConfig extends BasePluginConfig {
  author?: string
  deactivateSubtypeAfterCreate?: boolean
  selectAfterCreate?: boolean
}

// ***PLUGIN CAPABILITY***
export interface AnnotationCapability {
  onStateChange: EventHook<AnnotationState>

  selectAnnotation: (annotationId: string) => void
  deselectAnnotation: () => void

  setCreateAnnotationDefaults: (defaults: {
    color?: string
    opacity?: number
    subtype?: Subtype | null
    entityType?: string
  }) => void

  createAnnotations: (items: PdfTextMarkupAnnotationObject[], documentId?: string) => void // for consumer program to batch create annotations (without adding to timeline)
  createAnnotation: (annotation: PdfTextMarkupAnnotationObject, documentId?: string) => void // for user-created annotations
  updateAnnotations: (
    items: { id: string; patch: Partial<PdfTextMarkupAnnotationObject> }[],
    documentId?: string,
  ) => void // for consumer program to batch update annotations (without adding to timeline)
  updateAnnotation: (annotationId: string, patch: Partial<PdfTextMarkupAnnotationObject>, documentId?: string) => void // change the props of an annotation
  deleteAnnotations: (annotationIds: string[], documentId?: string) => void // for consumer program to batch delete annotations (without adding to timeline)
  deleteAnnotation: (annotationId: string, documentId?: string) => void
  undo: () => void
  redo: () => void
}

// ***PLUGIN CLASS***
export class AnnotationPlugin extends BasePlugin<
  AnnotationPluginConfig,
  AnnotationCapability,
  AnnotationState,
  AnnotationAction
> {
  static readonly id = "annotation" as const

  public readonly config: AnnotationPluginConfig
  private readonly state$ = createBehaviorEmitter<AnnotationState>()
  private readonly interactionManager: InteractionManagerCapability | null
  private readonly selection: SelectionCapability | null

  private timeline: Command[] = []
  private timelineIndex: number = -1

  constructor(id: string, registry: PluginRegistry, config: AnnotationPluginConfig) {
    super(id, registry)
    this.config = config

    this.selection = registry.getPlugin<SelectionPlugin>("selection")?.provides() ?? null
    this.interactionManager =
      registry.getPlugin<InteractionManagerPlugin>("interaction-manager")?.provides() ?? null
  }

  
  // ─────────────────────────────────────────────────────────
  // Document Lifecycle (from BasePlugin)
  // ─────────────────────────────────────────────────────────

  protected override onDocumentLoadingStarted(documentId: string): void {
    this.dispatch(initAnnotationState(documentId, initialDocumentState))

    // Enable text selection while in "annotation" interaction mode
    this.selection?.enableForMode("annotation", {
      enableSelection: true,
      showSelectionRects: false,
    }, documentId)

    this.logger.debug(
      'AnnotationPlugin',
      'DocumentOpened',
      `Initialized annotation state for document: ${documentId}`,
    )
  }

  protected override onDocumentLoaded(documentId: string): void {
    // Load all annotations for this document
    const coreDocState = this.getCoreDocument(documentId)
    const docObj = coreDocState?.document
    if (docObj) {
      const task = this.engine.getAllAnnotations(docObj)
      task.wait((annotations) => {
        /**
         * annotations is Record<number, PdfAnnotationObject[]>
         * flatten and filter to only PdfTextMarkupAnnotationObjects
         */
        const textMarkupAnnotations: PdfTextMarkupAnnotationObject[] = []

        for (const pageAnnotations of Object.values(annotations)) {
          for (const annotation of pageAnnotations) {
            if (
              annotation.type === PdfAnnotationSubtype.HIGHLIGHT ||
              annotation.type === PdfAnnotationSubtype.UNDERLINE ||
              annotation.type === PdfAnnotationSubtype.SQUIGGLY ||
              annotation.type === PdfAnnotationSubtype.STRIKEOUT
            ) {
              textMarkupAnnotations.push(annotation as PdfTextMarkupAnnotationObject)
            }
          }
        }

        this.dispatch(batchCreateAnnotations(documentId, textMarkupAnnotations))
      }, ignore)
    }
  }

  protected override onDocumentClosed(documentId: string): void {
    this.dispatch(cleanupAnnotationState(documentId))

    this.logger.debug(
      'AnnotationPlugin',
      'DocumentClosed',
      `Cleaned up annotation state for document: ${documentId}`,
    )
  }

  async initialize(): Promise<void> {
    // Register a single interaction mode for annotations
    this.interactionManager?.registerMode({
      id: "annotation",
      scope: "page",
      exclusive: false,
      cursor: "text",
    })
    
    // Create annotations using SelectionPluginCapability callback
    this.selection?.onEndSelection(() => {
      const { activeSubtype, activeColor, activeOpacity, activeEntityType } = this.state
      if (!activeSubtype) return

      const formattedSelection = this.selection?.getFormattedSelection()
      const selectionText = this.selection?.getSelectedText()
      if (!formattedSelection || !selectionText) return

      for (const selection of formattedSelection) {
        selectionText.wait((text) => {
          const annotationId = uuidV4()
          // Create an annotation using the active state properties
          this.createAnnotation({
            type: subtypeToEnum(activeSubtype),
            color: activeColor,
            opacity: activeOpacity,
            rect: selection.rect,
            segmentRects: selection.segmentRects,
            pageIndex: selection.pageIndex,
            id: annotationId,
            contents: text.join("\n"),
            custom: {
              entityType: activeEntityType,
            },
          } as PdfTextMarkupAnnotationObject)

          if (this.config.deactivateSubtypeAfterCreate) {
            this.dispatch(setCreateAnnotationDefaults({ subtype: null, entityType: "" }))
          }
          if (this.config.selectAfterCreate) {
            this.dispatch(selectAnnotation(annotationId))
          }
        }, ignore)
      }

      this.selection?.clear()
    })
  }

  protected buildCapability(): AnnotationCapability {
    return {
      onStateChange: this.state$.on,
      selectAnnotation: (id) => this.dispatch(selectAnnotation(id)),
      deselectAnnotation: () => this.dispatch(deselectAnnotation()),
      setCreateAnnotationDefaults: (defaults) =>
        this.dispatch(setCreateAnnotationDefaults(defaults)),
      createAnnotations: (items, documentId) => this.createAnnotations(items, documentId),
      createAnnotation: (anno, documentId) => this.createAnnotation(anno, documentId),
      updateAnnotations: (items, documentId) => this.updateAnnotations(items, documentId),
      updateAnnotation: (id, patch, documentId) => this.updateAnnotation(id, patch, documentId),
      deleteAnnotations: (ids, documentId) => this.deleteAnnotations(ids, documentId),
      deleteAnnotation: (id, documentId) => this.deleteAnnotation(id, documentId),
      undo: () => {
        if (this.timelineIndex > -1) {
          const command = this.timeline[this.timelineIndex]
          command?.undo()
          this.timelineIndex--
          this.dispatch(setCanUndoRedo(this.timelineIndex, this.timeline.length))
          this.commit(this.state.activeDocumentId!)
        }
      },
      redo: () => {
        if (this.timelineIndex < this.timeline.length - 1) {
          this.timelineIndex++
          const command = this.timeline[this.timelineIndex]
          command?.execute()
          this.dispatch(setCanUndoRedo(this.timelineIndex, this.timeline.length))
          this.commit(this.state.activeDocumentId!)
        }
      },
    }
  }

  override onStoreUpdated(prev: AnnotationState, next: AnnotationState): void {
    // Reset undo/redo timeline if changing active document
    if (prev.activeDocumentId !== next.activeDocumentId) {      
      this.timeline = []
      this.timelineIndex = -1
    }

    // Change interaction mode when activeSubtype changes between null and non-null
    if (!prev.activeSubtype && next.activeSubtype) {
        this.interactionManager?.activate("annotation")
    }
    if (prev.activeSubtype && !next.activeSubtype) {
        this.interactionManager?.activateDefaultMode()
    }

    this.state$.emit(next)
  }

  // consumer capability to batch add annotations
  private createAnnotations(items: PdfTextMarkupAnnotationObject[], documentId?: string) {
    const docId = documentId || this.getActiveDocumentId()

    for (const annotation of items) {
      annotation.created = new Date()
      annotation.author = annotation.author ?? this.config.author
    }
    this.dispatch(batchCreateAnnotations(docId, items))
    this.commit(docId)
  }

  private createAnnotation(annotation: PdfTextMarkupAnnotationObject, documentId?: string) {
    const docId = documentId || this.getActiveDocumentId()
    const id = annotation.id

    const annotationModified = {
      ...annotation,
      created: new Date(),
      author: annotation.author ?? this.config.author,
    }

    const command: Command = {
      execute:  () => {
        this.dispatch(createAnnotation(docId, annotationModified))
      },
      undo: () => {
        if (this.state.selectedUid === id) this.dispatch(deselectAnnotation())
        this.dispatch(deleteAnnotation(docId, id))
      },
    }
    this.commitWithTimeline(command, docId)
  }

  // consumer capability to batch update annotations
  private updateAnnotations(
    items: { id: string; patch: Partial<PdfTextMarkupAnnotationObject> }[],
    documentId?: string
  ) {
    const docId = documentId || this.getActiveDocumentId()
    const stampedItems = items.map(({ id, patch }) => ({
      id,
      patch: { ...patch, modified: new Date(), author: patch.author ?? this.config.author },
    }))
    this.dispatch(batchUpdateAnnotations(docId, stampedItems))
    this.commit(docId)
  }

  private updateAnnotation(id: string, patch: Partial<PdfTextMarkupAnnotationObject>, documentId?: string) {
    const docId = documentId || this.getActiveDocumentId()

    const originalAnnotation = this.state.documents[docId]?.byUid[id]
    if (!originalAnnotation) return

    if (patch.id !== id) patch.id = id // id is immutable
    const patchModified = {
      ...patch,
      modified: new Date(),
      author: patch.author ?? this.config.author,
    }

    const command: Command = {
      execute: () => {
        this.dispatch(updateAnnotation(docId, id, patchModified))
      },
      undo: () => {
        this.dispatch(updateAnnotation(docId, id, originalAnnotation))
      },
    }
    this.commitWithTimeline(command, docId)
  }

  // consumer capability to batch delete annotations
  private deleteAnnotations(annotationIds: string[], documentId?: string) {
    const docId = documentId || this.getActiveDocumentId()
    this.dispatch(batchDeleteAnnotations(docId, annotationIds))
    this.commit(docId)
  }

  private deleteAnnotation(id: string, documentId?: string) {
    const docId = documentId || this.getActiveDocumentId()

    const originalAnnotation = this.state.documents[docId]?.byUid[id]
    if (!originalAnnotation) return

    const command: Command = {
      execute: () => {
        if (this.state.selectedUid === id) this.dispatch(deselectAnnotation())
        this.dispatch(deleteAnnotation(docId, id))
      },
      undo: () => {
        this.dispatch(createAnnotation(docId, originalAnnotation))
      },
    }
    this.commitWithTimeline(command, docId)
  }

  private commitWithTimeline(command: Command, documentId: string) {
    if (documentId === this.getActiveDocumentId()) {
      // add to timeline
      this.timeline.splice(this.timelineIndex + 1)
      this.timeline.push(command)
      this.timelineIndex++

      // dispatch action
      command.execute()

      // process all pending commits (commit = action)
      this.commit(documentId)

      // change state.canUndo, state.canRedo
      this.dispatch(setCanUndoRedo(this.timelineIndex, this.timeline.length))
    }
    else {
      command.execute()
      this.commit(documentId)
    }
  }

  private commit(documentId: string): PdfTask<boolean> {
    // get pendingCommits
    const commits: Commit[] = this.state.documents[documentId].pendingCommits
    if (!commits) {
      return PdfTaskHelper.resolve(true)
    } 

    // empty pending commits in state first so that if commit() is called while this call is running, commits aren't repeated
    this.dispatch(emptyPendingCommits(documentId))

    // get PdfDocumentObject
    const coreDocState = this.getCoreDocument(documentId)
    const docObj = coreDocState?.document
    if (!docObj) {
      return PdfTaskHelper.reject({ code: PdfErrorCode.NotFound, message: 'Document not found' });
    }

    // collect pendingTasks
    const pendingTasks: (PdfTask<string> | PdfTask<boolean>)[] = []
    for (const commit of commits) {
      const annoObj = commit.anno
      const pageIndex = annoObj.pageIndex
      const pageObj = docObj?.pages.find((p: any) => p.index === pageIndex)
      if (!pageObj) {
        return PdfTaskHelper.reject({ code: PdfErrorCode.NotFound, message: 'Page not found' });
      }

      switch (commit.type) {
        case CommitType.Create:
          const createTask = this.engine.createPageAnnotation!(docObj, pageObj, annoObj)
          pendingTasks.push(createTask)
          break
        case CommitType.Update:
          const updateTask = this.engine.updatePageAnnotation!(docObj, pageObj, annoObj)
          pendingTasks.push(updateTask)
          break
        case CommitType.Delete:
          const deleteTask = this.engine.removePageAnnotation!(docObj, pageObj, annoObj)
          pendingTasks.push(deleteTask)
          break
      }
    }

    const returnTask = new Task<boolean, PdfErrorReason>()

    // execute pendingTasks and wait for them to be settled
    Task.allSettled(pendingTasks).wait(
      () => returnTask.resolve(true),
      (error) => returnTask.fail(error)
    )

    return returnTask
  }
}
