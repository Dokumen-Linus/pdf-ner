import { BasePlugin, createScopedEmitter, PluginRegistry, REFRESH_PAGES } from "@embedpdf/core"
import {
  ignore,
  PageTextSlice,
  PdfErrorCode,
  PdfPageGeometry,
  PdfPermissionFlag,
  PdfTask,
  PdfTaskHelper,
  Position,
  Rect,
  Task,
} from "@embedpdf/models"
import {
  EmbedPdfPointerEvent,
  InteractionManagerCapability,
  InteractionManagerPlugin,
  PointerEventHandlersWithLifecycle,
} from "../../plugin-interaction-manager-2"
import {
  cachePageGeometry,
  cleanupSelectionState,
  clearSelection,
  endSelection,
  initSelectionState,
  SelectionAction,
  setRects,
  setSelection,
  setSlices,
  startSelection,
} from "./actions"
import { createMarqueeSelectionHandler } from "./handlers/marquee-selection.handler"
import {
  createTextSelectionHandler,
  TextSelectionHandlerOptions,
} from "./handlers/text-selection.handler"
import { createWordSelectionHandler } from "./handlers/word-selection.handler"
import { initialSelectionDocumentState } from "./reducer"
import * as selector from "./selectors"
import {
  BeginSelectionEvent,
  CopyToClipboardEvent,
  EmptySpaceClickEvent,
  EmptySpaceClickScopeEvent,
  EnableForModeOptions,
  EndSelectionEvent,
  MarqueeChangeEvent,
  MarqueeEndEvent,
  MarqueeEndScopeEvent,
  MarqueeScopeEvent,
  RegisterMarqueeOnPageOptions,
  RegisterSelectionOnPageOptions,
  SelectionCapability,
  SelectionChangeEvent,
  SelectionDocumentState,
  SelectionPluginConfig,
  SelectionRangeX,
  SelectionRectsCallback,
  SelectionScope,
  SelectionState,
  TextRetrievedEvent,
} from "./types"
import { compareGlyphPointers, rectsWithinSlice, sliceBounds, wordBoundsAt } from "./utils"

export class SelectionPlugin extends BasePlugin<
  SelectionPluginConfig,
  SelectionCapability,
  SelectionState,
  SelectionAction
> {
  static readonly id = "selection" as const

  /** Modes that should trigger text-selection logic, per document (mode -> config) */
  private enabledModesPerDoc = new Map<string, Map<string, EnableForModeOptions>>()

  /* interactive state, per document */
  private selecting = new Map<string, boolean>()
  private anchor = new Map<string, { page: number; index: number } | undefined>()
  private anchorWord = new Map<
    string,
    { start: { page: number; index: number }; end: { page: number; index: number } } | undefined
  >()
  private selectionMode = new Map<string, "glyph" | "word">()

  /** Tracks the page a marquee drag started on, per document */
  private marqueePage = new Map<string, number>()

  /** Page callbacks for rect updates, per document */
  private pageCallbacks = new Map<string, Map<number, (data: SelectionRectsCallback) => void>>()
  private readonly selChange$ = createScopedEmitter<
    SelectionRangeX | null,
    SelectionChangeEvent,
    string
  >((documentId, selection) => ({
    documentId,
    selection,
    modeId: this.interactionManagerCapability.forDocument(documentId).getActiveMode(),
  }))
  private readonly textRetrieved$ = createScopedEmitter<string[], TextRetrievedEvent, string>(
    (documentId, text) => ({ documentId, text }),
  )
  private readonly copyToClipboard$ = createScopedEmitter<string, CopyToClipboardEvent, string>(
    (documentId, text) => ({ documentId, text }),
    { cache: false },
  )
  private readonly beginSelection$ = createScopedEmitter<
    { page: number; index: number; modeId: string },
    BeginSelectionEvent,
    string
  >(
    (documentId, data) => ({
      documentId,
      page: data.page,
      index: data.index,
      modeId: data.modeId,
    }),
    { cache: false },
  )
  private readonly endSelection$ = createScopedEmitter<
    { modeId: string },
    EndSelectionEvent,
    string
  >((documentId, data) => ({ documentId, modeId: data.modeId }), { cache: false })

  // Marquee selection emitters
  private readonly marqueeChange$ = createScopedEmitter<
    MarqueeScopeEvent,
    MarqueeChangeEvent,
    string
  >(
    (documentId, data) => ({
      documentId,
      pageIndex: data.pageIndex,
      rect: data.rect,
      modeId: data.modeId,
    }),
    { cache: false },
  )
  private readonly marqueeEnd$ = createScopedEmitter<MarqueeEndScopeEvent, MarqueeEndEvent, string>(
    (documentId, data) => ({
      documentId,
      pageIndex: data.pageIndex,
      rect: data.rect,
      modeId: data.modeId,
    }),
    { cache: false },
  )
  private readonly emptySpaceClick$ = createScopedEmitter<
    EmptySpaceClickScopeEvent,
    EmptySpaceClickEvent,
    string
  >(
    (documentId, data) => ({
      documentId,
      pageIndex: data.pageIndex,
      modeId: data.modeId,
    }),
    { cache: false },
  )

  private interactionManagerCapability: InteractionManagerCapability
  private readonly config: SelectionPluginConfig

  constructor(id: string, registry: PluginRegistry, config: SelectionPluginConfig) {
    super(id, registry)
    this.config = config

    const imPlugin = registry.getPlugin<InteractionManagerPlugin>("interaction-manager")
    if (!imPlugin) {
      throw new Error("SelectionPlugin: InteractionManagerPlugin is required.")
    }
    this.interactionManagerCapability = imPlugin.provides()

    this.coreStore.onAction(REFRESH_PAGES, (action) => {
      const { documentId, pageIndexes } = action.payload
      const tasks = pageIndexes.map((pageIndex) =>
        this.getNewPageGeometryAndCache(documentId, pageIndex),
      )
      Task.all(tasks).wait(() => {
        // Notify affected pages about geometry updates
        pageIndexes.forEach((pageIndex) => {
          this.notifyPage(documentId, pageIndex)
        })
      }, ignore)
    })
  }

  /* ── life-cycle ────────────────────────────────────────── */
  protected override onDocumentLoadingStarted(documentId: string): void {
    this.dispatch(initSelectionState(documentId, initialSelectionDocumentState))
    const marqueeEnabled = this.config.marquee?.enabled !== false
    this.enabledModesPerDoc.set(
      documentId,
      new Map<string, EnableForModeOptions>([
        [
          "pointerMode",
          {
            enableSelection: true,
            showSelectionRects: true,
            enableMarquee: marqueeEnabled,
            showMarqueeRects: true,
          },
        ],
      ]),
    )
    this.pageCallbacks.set(documentId, new Map())
    this.selecting.set(documentId, false)
    this.anchor.set(documentId, undefined)
    this.anchorWord.set(documentId, undefined)
    this.selectionMode.set(documentId, "glyph")
  }

  protected override onDocumentClosed(documentId: string): void {
    this.dispatch(cleanupSelectionState(documentId))
    this.enabledModesPerDoc.delete(documentId)
    this.pageCallbacks.delete(documentId)
    this.selecting.delete(documentId)
    this.anchor.delete(documentId)
    this.anchorWord.delete(documentId)
    this.selectionMode.delete(documentId)
    this.marqueePage.delete(documentId)
    this.selChange$.clearScope(documentId)
    this.textRetrieved$.clearScope(documentId)
    this.copyToClipboard$.clearScope(documentId)
    this.beginSelection$.clearScope(documentId)
    this.endSelection$.clearScope(documentId)
    this.marqueeChange$.clearScope(documentId)
    this.marqueeEnd$.clearScope(documentId)
    this.emptySpaceClick$.clearScope(documentId)
  }

  async initialize() {}
  async destroy() {
    this.selChange$.clear()
    this.textRetrieved$.clear()
    this.copyToClipboard$.clear()
    this.beginSelection$.clear()
    this.endSelection$.clear()
    this.marqueeChange$.clear()
    this.marqueeEnd$.clear()
    this.emptySpaceClick$.clear()
    super.destroy()
  }

  /* ── capability exposed to UI / other plugins ─────────── */
  buildCapability(): SelectionCapability {
    const getDocId = (documentId?: string) => documentId ?? this.getActiveDocumentId()

    return {
      // Active document operations
      getFormattedSelection: (docId) =>
        selector.getFormattedSelection(this.getDocumentState(getDocId(docId))),
      getFormattedSelectionForPage: (p, docId) =>
        selector.getFormattedSelectionForPage(this.getDocumentState(getDocId(docId)), p),
      getHighlightRectsForPage: (p, docId) =>
        selector.selectRectsForPage(this.getDocumentState(getDocId(docId)), p),
      getHighlightRects: (docId) => this.getDocumentState(getDocId(docId)).rects,
      getBoundingRectForPage: (p, docId) =>
        selector.selectBoundingRectForPage(this.getDocumentState(getDocId(docId)), p),
      getBoundingRects: (docId) =>
        selector.selectBoundingRectsForAllPages(this.getDocumentState(getDocId(docId))),
      getSelectedText: (docId) => this.getSelectedText(getDocId(docId)),
      clear: (docId) => this.clearSelection(getDocId(docId)),
      copyToClipboard: (docId) => this.copyToClipboard(getDocId(docId)),
      getState: (docId) => this.getDocumentState(getDocId(docId)),
      enableForMode: (modeId, options, docId) =>
        this.enabledModesPerDoc.get(getDocId(docId))?.set(modeId, { ...options }),
      isEnabledForMode: (modeId, docId) =>
        this.enabledModesPerDoc.get(getDocId(docId))?.has(modeId) ?? false,
      setMarqueeEnabled: (enabled, docId) => this.setMarqueeEnabled(getDocId(docId), enabled),
      isMarqueeEnabled: (docId) => this.isMarqueeEnabled(getDocId(docId)),

      // Document-scoped operations
      forDocument: this.createSelectionScope.bind(this),

      // Global events
      onCopyToClipboard: this.copyToClipboard$.onGlobal,
      onSelectionChange: this.selChange$.onGlobal,
      onTextRetrieved: this.textRetrieved$.onGlobal,
      onBeginSelection: this.beginSelection$.onGlobal,
      onEndSelection: this.endSelection$.onGlobal,

      // Marquee selection events
      onMarqueeChange: this.marqueeChange$.onGlobal,
      onMarqueeEnd: this.marqueeEnd$.onGlobal,

      // Empty space click event
      onEmptySpaceClick: this.emptySpaceClick$.onGlobal,
    }
  }

  private createSelectionScope(documentId: string): SelectionScope {
    return {
      getFormattedSelection: () =>
        selector.getFormattedSelection(this.getDocumentState(documentId)),
      getFormattedSelectionForPage: (p) =>
        selector.getFormattedSelectionForPage(this.getDocumentState(documentId), p),
      getHighlightRectsForPage: (p) =>
        selector.selectRectsForPage(this.getDocumentState(documentId), p),
      getHighlightRects: () => this.getDocumentState(documentId).rects,
      getBoundingRectForPage: (p) =>
        selector.selectBoundingRectForPage(this.getDocumentState(documentId), p),
      getBoundingRects: () =>
        selector.selectBoundingRectsForAllPages(this.getDocumentState(documentId)),
      getSelectedText: () => this.getSelectedText(documentId),
      clear: () => this.clearSelection(documentId),
      copyToClipboard: () => this.copyToClipboard(documentId),
      getState: () => this.getDocumentState(documentId),
      setMarqueeEnabled: (enabled) => this.setMarqueeEnabled(documentId, enabled),
      isMarqueeEnabled: () => this.isMarqueeEnabled(documentId),
      onSelectionChange: this.selChange$.forScope(documentId),
      onTextRetrieved: this.textRetrieved$.forScope(documentId),
      onCopyToClipboard: this.copyToClipboard$.forScope(documentId),
      onBeginSelection: this.beginSelection$.forScope(documentId),
      onEndSelection: this.endSelection$.forScope(documentId),
      onMarqueeChange: this.marqueeChange$.forScope(documentId),
      onMarqueeEnd: this.marqueeEnd$.forScope(documentId),
      onEmptySpaceClick: this.emptySpaceClick$.forScope(documentId),
    }
  }

  private getDocumentState(documentId: string): SelectionDocumentState {
    const state = this.state.documents[documentId]
    if (!state) {
      throw new Error(`Selection state not found for document: ${documentId}`)
    }
    return state
  }

  /**
   * Register text selection on a page. Uses `registerAlways` so any plugin
   * can enable text selection for their mode via `enableForMode()`.
   */
  public registerSelectionOnPage(opts: RegisterSelectionOnPageOptions) {
    const { documentId, pageIndex, onRectsChange } = opts
    const docState = this.state.documents[documentId]

    if (!docState) {
      this.logger.warn(
        "SelectionPlugin",
        "RegisterFailed",
        `Cannot register selection on page ${pageIndex} for document ${documentId}: document state not initialized.`,
      )
      return () => {}
    }

    // Track this callback for the page
    this.pageCallbacks.get(documentId)?.set(pageIndex, onRectsChange)

    const geoTask = this.getOrLoadGeometry(documentId, pageIndex)
    const interactionScope = this.interactionManagerCapability.forDocument(documentId)
    const enabledModes = this.enabledModesPerDoc.get(documentId)

    // Send initial state
    onRectsChange({
      rects: selector.selectRectsForPage(docState, pageIndex),
      boundingRect: selector.selectBoundingRectForPage(docState, pageIndex),
    })

    const textSelectionHandlerOptions: TextSelectionHandlerOptions = {
      getGeometry: () => this.getDocumentState(documentId).geometry[pageIndex],
      isEnabled: (modeId) => {
        const config = enabledModes?.get(modeId)
        if (!config) return false
        return config.enableSelection !== false
      },
      onBegin: (g, modeId) => this.beginSelection(documentId, pageIndex, g, modeId),
      onUpdate: (g, modeId) => this.updateSelection(documentId, pageIndex, g, modeId),
      onEnd: (modeId) => this.endSelection(documentId, modeId),
      onClear: (modeId) => this.clearSelection(documentId, modeId),
      isSelecting: () => this.selecting.get(documentId) ?? false,
      setCursor: (cursor) =>
        cursor
          ? interactionScope.setCursor("selection-text", cursor, 10)
          : interactionScope.removeCursor("selection-text"),
      onEmptySpaceClick: (modeId) => this.emptySpaceClick$.emit(documentId, { pageIndex, modeId }),
    }

    const textHandler = createTextSelectionHandler(textSelectionHandlerOptions)
    const wordHandler = createWordSelectionHandler(textSelectionHandlerOptions)
    const pickTextHandler = (modeId: string) =>
      this.getSelectionMode(documentId, modeId) === "word" ? wordHandler : textHandler

    const selectionHandler: PointerEventHandlersWithLifecycle<EmbedPdfPointerEvent> = {
      onPointerDown: (point: Position, evt: EmbedPdfPointerEvent, modeId: string) =>
        pickTextHandler(modeId).onPointerDown?.(point, evt, modeId),
      onPointerMove: (point: Position, evt: EmbedPdfPointerEvent, modeId: string) =>
        pickTextHandler(modeId).onPointerMove?.(point, evt, modeId),
      onPointerUp: (point: Position, evt: EmbedPdfPointerEvent, modeId: string) =>
        pickTextHandler(modeId).onPointerUp?.(point, evt, modeId),
      onPointerCancel: (point: Position, evt: EmbedPdfPointerEvent, modeId: string) =>
        pickTextHandler(modeId).onPointerCancel?.(point, evt, modeId),
      onHandlerActiveEnd: (modeId: string) => pickTextHandler(modeId).onHandlerActiveEnd?.(modeId),
    }

    // Register text selection with registerAlways - any plugin can enable it for their mode
    const unregisterHandlers = this.interactionManagerCapability.registerAlways({
      scope: { type: "page", documentId, pageIndex },
      handlers: selectionHandler,
    })

    // Return cleanup function
    return () => {
      unregisterHandlers()
      this.pageCallbacks.get(documentId)?.delete(pageIndex)
      geoTask.abort({ code: PdfErrorCode.Cancelled, message: "Cleanup" })
    }
  }

  /**
   * Register marquee selection on a page. Uses `registerAlways` so any plugin
   * can enable marquee selection for their mode via `enableForMode({ enableMarquee: true })`.
   */
  public registerMarqueeOnPage(opts: RegisterMarqueeOnPageOptions) {
    const { documentId, pageIndex, scale, onRectChange } = opts
    const docState = this.state.documents[documentId]

    if (!docState) {
      this.logger.warn(
        "SelectionPlugin",
        "RegisterMarqueeFailed",
        `Cannot register marquee on page ${pageIndex} for document ${documentId}: document state not initialized.`,
      )
      return () => {}
    }

    // Get page size from core state (same pattern as ZoomPlugin)
    const coreDoc = this.coreState.core.documents[documentId]
    if (!coreDoc || !coreDoc.document) {
      this.logger.warn(
        "SelectionPlugin",
        "DocumentNotFound",
        `Cannot register marquee on page ${pageIndex}: document not found`,
      )
      return () => {}
    }

    const page = coreDoc.document.pages[pageIndex]
    if (!page) {
      this.logger.warn(
        "SelectionPlugin",
        "PageNotFound",
        `Cannot register marquee on page ${pageIndex}: page not found`,
      )
      return () => {}
    }

    const pageSize = page.size
    const minDragPx = this.config.marquee?.minDragPx ?? 5

    const shouldShowRect = () => {
      const mode = this.interactionManagerCapability.forDocument(documentId).getActiveMode()
      const config = this.enabledModesPerDoc.get(documentId)?.get(mode)
      return config?.showMarqueeRects !== false
    }

    // Create marquee selection handler
    const marqueeHandler = createMarqueeSelectionHandler({
      pageSize,
      scale,
      minDragPx,
      isEnabled: (modeId) => {
        const config = this.enabledModesPerDoc.get(documentId)?.get(modeId)
        return config?.enableMarquee === true
      },
      isTextSelecting: () => this.selecting.get(documentId) ?? false,
      onBegin: (pos, modeId) => this.beginMarquee(documentId, pageIndex, pos, modeId),
      onChange: (rect, modeId) => {
        this.updateMarquee(documentId, pageIndex, rect, modeId)
        onRectChange(shouldShowRect() ? rect : null)
      },
      onEnd: (rect, modeId) => {
        this.endMarquee(documentId, pageIndex, rect, modeId)
        onRectChange(null)
      },
      onCancel: (modeId) => {
        this.cancelMarquee(documentId, modeId)
        onRectChange(null)
      },
    })

    // Register marquee with registerAlways - any plugin can enable it for their mode
    const unregisterHandlers = this.interactionManagerCapability.registerAlways({
      scope: { type: "page", documentId, pageIndex },
      handlers: marqueeHandler,
    })

    return unregisterHandlers
  }

  private notifyPage(documentId: string, pageIndex: number) {
    const callback = this.pageCallbacks.get(documentId)?.get(pageIndex)
    if (callback) {
      const docState = this.getDocumentState(documentId)
      const mode = this.interactionManagerCapability.forDocument(documentId).getActiveMode()
      const modeConfig = this.enabledModesPerDoc.get(documentId)?.get(mode)

      // Show rects if mode is enabled and showSelectionRects/showRects is not explicitly false
      const shouldShowRects =
        modeConfig && (modeConfig.showSelectionRects ?? modeConfig.showRects) !== false

      if (shouldShowRects) {
        callback({
          rects: selector.selectRectsForPage(docState, pageIndex),
          boundingRect: selector.selectBoundingRectForPage(docState, pageIndex),
        })
      } else {
        callback({ rects: [], boundingRect: null })
      }
    }
  }

  private notifyAllPages(documentId: string) {
    this.pageCallbacks.get(documentId)?.forEach((_, pageIndex) => {
      this.notifyPage(documentId, pageIndex)
    })
  }

  private getNewPageGeometryAndCache(
    documentId: string,
    pageIdx: number,
  ): PdfTask<PdfPageGeometry> {
    const coreDoc = this.getCoreDocument(documentId)
    if (!coreDoc || !coreDoc.document)
      return PdfTaskHelper.reject({ code: PdfErrorCode.NotFound, message: "Doc Not Found" })

    const page = coreDoc.document.pages.find((p) => p.index === pageIdx)!
    const task = this.engine.getPageGeometry(coreDoc.document, page)
    task.wait((geo) => {
      this.dispatch(cachePageGeometry(documentId, pageIdx, geo))
    }, ignore)
    return task
  }

  /* ── geometry cache ───────────────────────────────────── */
  private getOrLoadGeometry(documentId: string, pageIdx: number): PdfTask<PdfPageGeometry> {
    const cached = this.getDocumentState(documentId).geometry[pageIdx]
    if (cached) return PdfTaskHelper.resolve(cached)

    return this.getNewPageGeometryAndCache(documentId, pageIdx)
  }

  /* ── selection state updates ───────────────────────────── */
  private beginSelection(documentId: string, page: number, index: number, modeId: string) {
    const selectionMode = this.getSelectionMode(documentId, modeId)
    this.selecting.set(documentId, true)
    this.selectionMode.set(documentId, selectionMode)

    if (selectionMode === "word") {
      const bounds = this.resolveWordBounds(documentId, page, index)
      if (bounds) {
        this.anchorWord.set(documentId, {
          start: { page, index: bounds.start },
          end: { page, index: bounds.end },
        })
        this.anchor.set(documentId, { page, index: bounds.start })
      } else {
        this.anchorWord.set(documentId, undefined)
        this.anchor.set(documentId, { page, index })
      }
    } else {
      this.anchorWord.set(documentId, undefined)
      this.anchor.set(documentId, { page, index })
    }

    this.dispatch(startSelection(documentId))
    this.beginSelection$.emit(documentId, { page, index, modeId })
  }

  private endSelection(documentId: string, modeId: string) {
    this.selecting.set(documentId, false)
    this.anchor.set(documentId, undefined)
    this.dispatch(endSelection(documentId))
    this.endSelection$.emit(documentId, { modeId })
  }

  private clearSelection(documentId: string, _modeId?: string) {
    this.selecting.set(documentId, false)
    this.anchor.set(documentId, undefined)
    this.anchorWord.set(documentId, undefined)
    this.selectionMode.set(documentId, "glyph")
    this.dispatch(clearSelection(documentId))
    this.selChange$.emit(documentId, null)
    this.notifyAllPages(documentId)
  }

  private updateSelection(documentId: string, page: number, index: number, modeId: string) {
    if (!this.selecting.get(documentId) || !this.anchor.get(documentId)) return

    const selectionMode =
      this.selectionMode.get(documentId) ?? this.getSelectionMode(documentId, modeId)
    let start: { page: number; index: number }
    let end: { page: number; index: number }

    if (selectionMode === "word") {
      const anchorWord = this.anchorWord.get(documentId)
      if (!anchorWord) return

      const currentBounds = this.resolveWordBounds(documentId, page, index)
      if (!currentBounds) return

      const currentWordEnd = { page, index: currentBounds.end }
      const backward = compareGlyphPointers(currentWordEnd, anchorWord.start) < 0

      start = backward ? { page, index: currentBounds.start } : anchorWord.start
      end = backward ? anchorWord.end : currentWordEnd
      this.anchor.set(documentId, backward ? anchorWord.end : anchorWord.start)
    } else {
      const a = this.anchor.get(documentId)!
      const forward = page > a.page || (page === a.page && index >= a.index)
      start = forward ? a : { page, index }
      end = forward ? { page, index } : a
    }

    const range = { start, end }
    this.dispatch(setSelection(documentId, range))
    this.updateRectsAndSlices(documentId, range)
    this.selChange$.emit(documentId, range)

    // Notify affected pages
    for (let p = range.start.page; p <= range.end.page; p++) {
      this.notifyPage(documentId, p)
    }
  }

  private updateRectsAndSlices(documentId: string, range: SelectionRangeX) {
    const docState = this.getDocumentState(documentId)
    const allRects: Record<number, Rect[]> = {}
    const allSlices: Record<number, { start: number; count: number }> = {}

    for (let p = range.start.page; p <= range.end.page; p++) {
      const geo = docState.geometry[p]
      const sb = sliceBounds(range, geo, p)
      if (!sb) continue

      allRects[p] = rectsWithinSlice(geo!, sb.from, sb.to)
      allSlices[p] = { start: sb.from, count: sb.to - sb.from + 1 }
    }

    this.dispatch(setRects(documentId, allRects))
    this.dispatch(setSlices(documentId, allSlices))
  }

  private getSelectionMode(documentId: string, modeId: string): "glyph" | "word" {
    const config = this.enabledModesPerDoc.get(documentId)?.get(modeId)
    return config?.selectionMode === "word" ? "word" : "glyph"
  }

  private resolveWordBounds(documentId: string, page: number, index: number) {
    const geometry = this.getDocumentState(documentId).geometry[page]
    if (!geometry) return null
    return wordBoundsAt(geometry, index)
  }

  private getSelectedText(documentId: string): PdfTask<string[]> {
    // Prevent extracting text without permission
    if (!this.checkPermission(documentId, PdfPermissionFlag.CopyContents)) {
      this.logger.debug(
        "SelectionPlugin",
        "GetSelectedText",
        `Cannot get selected text: document ${documentId} lacks CopyContents permission`,
      )
      return PdfTaskHelper.reject({
        code: PdfErrorCode.Security,
        message: "Document lacks CopyContents permission",
      })
    }

    const coreDoc = this.getCoreDocument(documentId)
    const docState = this.getDocumentState(documentId)

    if (!coreDoc?.document || !docState.selection) {
      return PdfTaskHelper.reject({
        code: PdfErrorCode.NotFound,
        message: "Doc Not Found or No Selection",
      })
    }

    const sel = docState.selection
    const req: PageTextSlice[] = []

    for (let p = sel.start.page; p <= sel.end.page; p++) {
      const s = docState.slices[p]
      if (s) req.push({ pageIndex: p, charIndex: s.start, charCount: s.count })
    }

    if (req.length === 0) return PdfTaskHelper.resolve([] as string[])

    const task = this.engine.getTextSlices(coreDoc.document, req)

    // Emit the text when it's retrieved
    task.wait((text) => {
      this.textRetrieved$.emit(documentId, text)
    }, ignore)

    return task
  }

  private copyToClipboard(documentId: string) {
    // Prevent copying text without permission
    if (!this.checkPermission(documentId, PdfPermissionFlag.CopyContents)) {
      this.logger.debug(
        "SelectionPlugin",
        "CopyToClipboard",
        `Cannot copy to clipboard: document ${documentId} lacks CopyContents permission`,
      )
      return
    }

    const text = this.getSelectedText(documentId)
    text.wait((text) => {
      this.copyToClipboard$.emit(documentId, text.join("\n"))
    }, ignore)
  }

  /* ── marquee selection state updates ─────────────────────── */
  private beginMarquee(
    documentId: string,
    pageIndex: number,
    _startPos: Position,
    _modeId: string,
  ) {
    this.marqueePage.set(documentId, pageIndex)
  }

  private updateMarquee(documentId: string, pageIndex: number, rect: Rect, modeId: string) {
    this.marqueeChange$.emit(documentId, { pageIndex, rect, modeId })
  }

  private endMarquee(documentId: string, pageIndex: number, rect: Rect, modeId: string) {
    this.marqueeEnd$.emit(documentId, { pageIndex, rect, modeId })
    this.marqueeChange$.emit(documentId, { pageIndex, rect: null, modeId })
    this.marqueePage.delete(documentId)
  }

  private cancelMarquee(documentId: string, modeId: string) {
    const pageIndex = this.marqueePage.get(documentId)
    if (pageIndex !== undefined) {
      this.marqueeChange$.emit(documentId, { pageIndex, rect: null, modeId })
      this.marqueePage.delete(documentId)
    }
  }

  /** @deprecated — shim for backward compat; delegates to pointerMode config */
  private setMarqueeEnabled(documentId: string, enabled: boolean) {
    const modes = this.enabledModesPerDoc.get(documentId)
    if (!modes) return
    const current = modes.get("pointerMode")
    if (current) {
      current.enableMarquee = enabled
    } else if (enabled) {
      modes.set("pointerMode", { enableMarquee: true })
    }
  }

  /** @deprecated — shim for backward compat; reads pointerMode config */
  private isMarqueeEnabled(documentId: string): boolean {
    const config = this.enabledModesPerDoc.get(documentId)?.get("pointerMode")
    return config?.enableMarquee !== false
  }
}
