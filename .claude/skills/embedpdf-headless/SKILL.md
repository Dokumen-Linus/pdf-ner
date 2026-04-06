---
name: embedpdf-headless
description: "How to use EmbedPDF React Headless Components"
---

# EmbedPDF Headless

## Overview

EmbedPDF React's headless library is an unopinionated UI toolkit for building fully customized PDF experiences. It provides logic (hooks) and rendering primitives (components)

**Powered by:** PDFium via WebAssembly (same engine as Google Chrome), virtualization, first-class TypeScript, tree-shakeable imports.

---

## Architecture

### Component Hierarchy

```tsx
<EmbedPDF engine={engine} plugins={plugins}>
  {({ activeDocumentId }) => (
    <DocumentContent documentId={activeDocumentId}>
      {({ isLoaded }) => isLoaded && (
        <Viewport documentId={activeDocumentId}>
          <Scroller documentId={activeDocumentId} renderPage={({ pageIndex }) => (
            <PagePointerProvider documentId={activeDocumentId} pageIndex={pageIndex}>
              <RenderLayer documentId={activeDocumentId} pageIndex={pageIndex} />
              <SelectionLayer documentId={activeDocumentId} pageIndex={pageIndex} />
              <AnnotationLayer documentId={activeDocumentId} pageIndex={pageIndex} />
              <MarqueeZoom documentId={activeDocumentId} pageIndex={pageIndex} />
            </PagePointerProvider>
          )} />
        </Viewport>
      )}
    </DocumentContent>
  )}
</EmbedPDF>
```

### Multi-Document Support
All hooks and components require a `documentId` parameter. Get `activeDocumentId` from the `<EmbedPDF>` children function. Each plugin maintains independent state per document.

### Plugin System (3-step pattern)

1. **Install** the plugin package: `npm install @embedpdf/plugin-<name>`
2. **Register** via `createPluginRegistration(PluginPackage, { options })`
3. **Use** the plugin's React components and hooks (always passing `documentId`)

```tsx
import { createPluginRegistration } from '@embedpdf/core';
import { ZoomPluginPackage, ZoomMode } from '@embedpdf/plugin-zoom/react';

const plugins = [
  createPluginRegistration(ZoomPluginPackage, {
    defaultZoomLevel: ZoomMode.FitPage,
  }),
];
```

---

## Engine Setup

### `usePdfiumEngine` Hook

```tsx
import { usePdfiumEngine } from '@embedpdf/engines/react';
import { EmbedPDF } from '@embedpdf/core/react';

function MyViewer() {
  const { engine, isLoading, error } = usePdfiumEngine();
  if (isLoading || !engine) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <EmbedPDF engine={engine} plugins={plugins}>
      {/* viewer components */}
    </EmbedPDF>
  );
}
```

**Config options:** `wasmUrl` (string), `worker` (boolean, default: true), `logger` (Logger)

**Returns:** `engine` (PdfEngine | null), `isLoading` (boolean), `error` (Error | null)

**Provider pattern:** `PdfEngineProvider` / `useEngineContext` / `useEngine` for sharing engine across components.

> **Warning:** The engine is stateless. Direct engine operations won't update UI or plugin state. Use plugin hooks for UI-affecting operations.

---

## Core Plugins

### Document Manager (`@embedpdf/plugin-document-manager`)

**Required for all viewers.** Manages document lifecycle: loading, state tracking, tabs.

```tsx
createPluginRegistration(DocumentManagerPluginPackage, {
  initialDocuments: [{ url: 'https://example.com/doc.pdf' }],
  maxDocuments: 10,
})
```

**Components:**
- `<DocumentContent documentId={id}>` - Render prop with `{ isLoading, isError, isLoaded }`

**Hooks:**
- `useDocumentManagerCapability()` - Returns `provides` with methods:
  - `openDocumentUrl(options)`, `openDocumentBuffer(options)`, `openFileDialog(options?)`
  - `closeDocument(id)`, `closeAllDocuments()`
  - `setActiveDocument(id)`, `getActiveDocumentId()`, `getActiveDocument()`
  - `retryDocument(id, options?)` (e.g., with new password)
  - `getDocumentOrder()`, `moveDocument(id, toIndex)`, `swapDocuments(id1, id2)`
  - `getOpenDocuments()`, `isDocumentOpen(id)`, `getDocumentCount()`
- `useActiveDocument()` - Returns `{ activeDocumentId, activeDocument }`
- `useOpenDocuments(documentIds?)` - Returns `DocumentState[]`

**Events:** `onDocumentOpened`, `onDocumentClosed`, `onActiveDocumentChanged`, `onDocumentOrderChanged`, `onDocumentError`

---

### Viewport (`@embedpdf/plugin-viewport`)

Foundational scrollable container for PDF content.

```tsx
createPluginRegistration(ViewportPluginPackage, {
  viewportGap: 20,      // padding in px (default: 10)
  scrollEndDelay: 300,   // ms before isScrolling=false (default: 300)
})
```

**Components:**
- `<Viewport documentId={id} style={{}} className="">` - Scrollable container div

**Hooks:**
- `useViewportCapability()` - Returns `provides`:
  - `forDocument(id)` -> `ViewportScope`: `scrollTo({ x, y, behavior?, center? })`, `getMetrics()`, `isScrolling()`
  - `getViewportGap()`, `isViewportMounted(id)`
- `useViewportScrollActivity(documentId)` - Returns `{ isScrolling, isSmoothScrolling }`

---

### Scroll (`@embedpdf/plugin-scroll`)

Page layout, virtualization, and navigation. Depends on Viewport.

```tsx
createPluginRegistration(ScrollPluginPackage, {
  defaultStrategy: ScrollStrategy.Vertical, // or Horizontal
  defaultPageGap: 10,
  defaultBufferSize: 2,
})
```

**Components:**
- `<Scroller documentId={id} renderPage={({ pageIndex, width, height, scale }) => ...} />`

**Hooks:**
- `useScroll(documentId)` - Returns `{ state: { currentPage, totalPages }, provides }`:
  - `scrollToPage({ pageNumber, behavior?, center? })`, `scrollToNextPage()`, `scrollToPreviousPage()`
  - `setScrollStrategy(s)`

**Events** (via `useScrollCapability()`):
- `onLayoutReady({ documentId, isInitial })` - Fires when layout is ready
- `onPageChange({ documentId, pageNumber, totalPages })`
- `onScroll({ documentId, metrics })`

---

### Render (`@embedpdf/plugin-render`)

Visual rendering of PDF pages, forms, and annotations.

```tsx
createPluginRegistration(RenderPluginPackage, {
  withForms: true,        // draw form widgets visually (default: false)
  withAnnotations: false,  // bake annotations into page image (default: false)
})
```

**Components:**
- `<RenderLayer documentId={id} pageIndex={n} scale={n?} dpr={n?} />`

**Hooks:**
- `useRenderCapability()` -> `forDocument(id)` -> `RenderScope`:
  - `renderPage({ pageIndex, options: { scaleFactor, withAnnotations, withForms, imageType, imageQuality } })` -> returns Task<Blob>
  - `renderPageRect({ pageIndex, rect, options })` -> renders sub-region

---

## Feature Plugins

### Zoom (`@embedpdf/plugin-zoom`)

Zoom in/out, fit-to-page, fit-to-width, marquee (area) zoom, gesture zoom.

**Depends on:** `@embedpdf/plugin-interaction-manager` (for marquee zoom)

```tsx
createPluginRegistration(ZoomPluginPackage, {
  defaultZoomLevel: ZoomMode.FitPage, // or number (1.5 = 150%), ZoomMode.Automatic, ZoomMode.FitWidth
  minZoom: 0.2,
  maxZoom: 60,
  presets: [{ name: '100%', value: 1.0 }, { name: 'Fit Page', value: ZoomMode.FitPage }],
})
```

**Components:**
- `<MarqueeZoom documentId={id} pageIndex={n} className? stroke? fill? />`
- `<ZoomGestureWrapper documentId={id} enablePinch? enableWheel?>` - Wraps `<Scroller>` for pinch/wheel zoom

**Hooks:**
- `useZoom(documentId)` - Returns `{ state, provides }`:
  - **State:** `currentZoomLevel` (number), `zoomLevel` (ZoomMode | number), `isMarqueeZoomActive` (boolean)
  - **Methods:** `zoomIn()`, `zoomOut()`, `requestZoom(level)`, `toggleMarqueeZoom()`, `getPresets()`

---

### Annotation (`@embedpdf/plugin-annotation`)

Highlights, ink drawings, shapes, text boxes, stamps, custom tools.

**Depends on:** `@embedpdf/plugin-interaction-manager`, `@embedpdf/plugin-selection`, `@embedpdf/plugin-history` (optional, for undo/redo)

```tsx
createPluginRegistration(AnnotationPluginPackage, {
  annotationAuthor: 'Jane Doe',  // default: 'Guest'
  autoCommit: true,
  tools: [],                       // custom AnnotationTool[]
  colorPresets: [],                // hex color strings
  deactivateToolAfterCreate: false,
  selectAfterCreate: true,
})
```

**Components:**
- `<AnnotationLayer documentId={id} pageIndex={n} selectionMenu={(props) => ...} resizeUI? vertexUI? selectionOutlineColor? />`

**Hooks:**
- `useAnnotation(documentId)` - Returns `{ provides, state }`:
  - **State:** `activeToolId`, `selectedUid`
  - **Methods:** `setActiveTool(toolId | null)`, `getActiveTool()`, `addTool(tool)`, `createAnnotation(..)`, `updateAnnotation(..)`, `deleteAnnotation(pageIndex, id)`, `selectAnnotation(..)`, `getSelectedAnnotation()`, `importAnnotations(..)`, `commit()`, `onStateChange(cb)`, `onAnnotationEvent(cb)`

**Default Tools (tool IDs):** `highlight`, `underline`, `strikeout`, `squiggly`, `ink`, `inkHighlighter`, `circle`, `square`, `line`, `lineArrow`, `polyline`, `polygon`, `freeText`, `stamp`

**Custom Tools:** Call `addTool()` with `{ id, name, interaction, matchScore, defaults }` -- often in `onInitialized` callback of `<EmbedPDF>`.

**Events (`onAnnotationEvent`):** `create` (annotation, pageIndex, ctx, committed), `update` (annotation, pageIndex, patch, committed), `delete` (annotation, pageIndex, committed), `loaded` (total)

---

### Selection (`@embedpdf/plugin-selection`)

Text selection, copy-to-clipboard, selection menu.

**Depends on:** `@embedpdf/plugin-interaction-manager`

```tsx
createPluginRegistration(SelectionPluginPackage, {
  menuHeight: 40,  // height hint for menu positioning
})
```

**Components:**
- `<SelectionLayer documentId={id} pageIndex={n} background? selectionMenu={(props) => ...} />`

**Hooks:**
- `useSelectionCapability()` -> `forDocument(id)` -> `SelectionScope`:
  - `copyToClipboard()`, `getSelectedText()` (Task<string[]>), `getFormattedSelection()`
  - Events: `onSelectionChange`, `onEndSelection`

---

### Pan (`@embedpdf/plugin-pan`)

Hand tool for drag-to-scroll navigation.

**Depends on:** `@embedpdf/plugin-viewport`, `@embedpdf/plugin-interaction-manager`

```tsx
createPluginRegistration(PanPluginPackage, {
  defaultMode: 'mobile', // 'never' | 'mobile' | 'always'
})
```

**Hooks:**
- `usePan(documentId)` - Returns `{ isPanning, provides }`:
  - `enablePan()`, `disablePan()`, `togglePan()`, `makePanDefault()`

> Use `<GlobalPointerProvider documentId={id}>` around `<Viewport>` for smooth panning outside viewport bounds.

---

### Rotate (`@embedpdf/plugin-rotate`)

90-degree rotation increments.

```tsx
createPluginRegistration(RotatePluginPackage, {
  defaultRotation: Rotation.Degree0, // Rotation enum from @embedpdf/models
})
```

**Components:**
- `<Rotate documentId={id} pageIndex={n}>` - Wrapper that applies CSS rotation transform. Place *outside* `<PagePointerProvider>`.

**Hooks:**
- `useRotate(documentId)` - Returns `{ rotation, provides }`:
  - `rotateForward()`, `rotateBackward()`, `setRotation(r)`, `getRotation()`

---

### Spread (`@embedpdf/plugin-spread`)

Single-page or two-page book-like layouts. Purely logical (no UI components).

```tsx
createPluginRegistration(SpreadPluginPackage, {
  defaultSpreadMode: SpreadMode.None, // None | Odd | Even
})
```

**Hooks:**
- `useSpread(documentId)` - Returns `{ spreadMode, provides }`:
  - `setSpreadMode(mode)`, `getSpreadMode()`

**SpreadMode:**
- `None` - Single pages: `[[p1], [p2], [p3]]`
- `Odd` - Paired from first: `[[p1, p2], [p3, p4]]`
- `Even` - Cover standalone: `[[p1], [p2, p3], [p4, p5]]`

---

### Thumbnail (`@embedpdf/plugin-thumbnail`)

Virtualized thumbnail sidebar for quick navigation.

**Depends on:** `@embedpdf/plugin-render`

```tsx
createPluginRegistration(ThumbnailPluginPackage, {
  width: 120,      // thumbnail width in CSS px
  gap: 8,          // vertical space between thumbnails
  buffer: 3,       // off-screen thumbnails to pre-render
  labelHeight: 16, // height reserved for label
  autoScroll: true, // sidebar tracks current page
  paddingY: 0,
})
```

**Components:**
- `<ThumbnailsPane documentId={id}>` - Virtualized container, render prop: `{(meta) => ...}`
- `<ThumbImg documentId={id} meta={m} />` - Renders actual thumbnail image

**Meta object:** `m.top`, `m.wrapperHeight`, `m.width`, `m.height`, `m.pageIndex`

**Hooks:**
- `useThumbnailCapability()` -> `forDocument(id)` -> `scrollToThumb(pageIndex)`

---

### Tiling (`@embedpdf/plugin-tiling`)

Performance optimization: renders pages in smaller tiles for high-zoom scenarios.

**Depends on:** `@embedpdf/plugin-render`, `@embedpdf/plugin-scroll`, `@embedpdf/plugin-viewport`

```tsx
createPluginRegistration(TilingPluginPackage, {
  tileSize: 768,    // tile size in px
  overlapPx: 5,     // overlap to prevent seams
  extraRings: 0,    // pre-render tiles outside viewport
})
```

**Components:**
- `<TilingLayer documentId={id} pageIndex={n} scale? />`

**Recommended pattern:** Use `<RenderLayer scale={1.0}>` as low-res base + `<TilingLayer>` on top for high-res tiles.

---

### Capture (`@embedpdf/plugin-capture`)

Screenshot/area capture with export.

**Depends on:** `@embedpdf/plugin-render`, `@embedpdf/plugin-interaction-manager`

```tsx
createPluginRegistration(CapturePluginPackage, {
  scale: 2.0,
  imageType: 'image/png',
  withAnnotations: true,
})
```

**Components:**
- `<MarqueeCapture documentId={id} pageIndex={n} className? stroke? fill? />`

**Hooks:**
- `useCapture(documentId)` - Returns `{ state: { isMarqueeCaptureActive }, provides }`:
  - `toggleMarqueeCapture()`, `captureArea(pageIndex, rect)`
  - `onCaptureArea(callback)` - Callback receives `CaptureAreaEvent: { pageIndex, rect, blob, imageType, scale }`

---

### Redaction (`@embedpdf/plugin-redaction`)

Permanently remove content from PDFs. Two modes: Legacy (internal state) and Annotation (PDF REDACT annotations).

**Depends on:** `@embedpdf/plugin-selection`, `@embedpdf/plugin-interaction-manager`

```tsx
// Legacy mode
createPluginRegistration(RedactionPluginPackage, {
  drawBlackBoxes: true,
  useAnnotationMode: false, // default
})

// Annotation mode (requires AnnotationPluginPackage + HistoryPluginPackage)
createPluginRegistration(RedactionPluginPackage, {
  useAnnotationMode: true,
})
```

**Components:**
- `<RedactionLayer documentId={id} pageIndex={n} selectionMenu={(props) => ...} />`
- In annotation mode, also add `<AnnotationLayer>` for rendering REDACT annotations.

**Hooks:**
- `useRedaction(documentId)` - Returns `{ state, provides }`:
  - **State:** `isRedacting`, `activeType` (RedactionMode), `pending`, `pendingCount`, `selected`
  - **Methods:** `toggleRedact()` (unified mode), `enableRedact()`, `isRedactActive()`, `toggleRedactSelection()`, `toggleMarqueeRedact()`, `addPending(items)`, `removePending(page, id)`, `clearPending()`, `commitAllPending()` (destructive), `commitPending(page, id)` (destructive), `onStateChange(cb)`, `onRedactionEvent(cb)`

---

### Print (`@embedpdf/plugin-print`)

Browser native print dialog integration.

```tsx
createPluginRegistration(PrintPluginPackage)
```

**Hooks:**
- `usePrint(documentId)` - Returns `{ provides }`:
  - `print(options?)` - Returns Task. Options: `{ pageRanges?: string, includeAnnotations?: boolean }`

---

### Export (`@embedpdf/plugin-export`)

Download PDF documents.

```tsx
createPluginRegistration(ExportPluginPackage, {
  defaultFileName: 'my-document.pdf',
})
```

**Hooks:**
- `useExport(documentId)` - Returns `{ provides }`:
  - `download()`, `saveAsCopy()` (returns Task<ArrayBuffer>)

---

### Commands (`@embedpdf/plugin-commands`)

Central command registry for actions, keyboard shortcuts, and UI state.

```tsx
createPluginRegistration(CommandsPluginPackage, {
  commands: myCommands,
})
```

**Defining Commands:**
```tsx
import { GlobalStoreState } from '@embedpdf/core';
import { Command } from '@embedpdf/plugin-commands';

type AppState = GlobalStoreState<{ [SCROLL_PLUGIN_ID]: ScrollState }>;

const myCommands: Record<string, Command<AppState>> = {
  'nav.next': {
    id: 'nav.next',
    label: 'Next Page',
    shortcuts: ['arrowright', 'j'],
    action: ({ registry }) => {
      registry.getPlugin('scroll')?.provides()?.scrollToNextPage();
    },
    disabled: ({ state, documentId }) => {
      const s = state.plugins.scroll.documents[documentId];
      return s ? s.currentPage >= s.totalPages : true;
    },
  },
};
```

**Hooks:**
- `useCommand(commandId, documentId)` - Returns `ResolvedCommand`: `{ execute, disabled, active, visible, label, shortcuts }`
- `useCommandsCapability()` -> `registerCommand(cmd)`, `execute(id)`, `getCommandByShortcut(key)`, `getAllCommands()`

---

### I18n (`@embedpdf/plugin-i18n`)

Multi-language support with param resolvers.

```tsx
const locale: Locale = {
  code: 'en',
  name: 'English',
  translations: {
    zoom: { in: 'Zoom In', out: 'Zoom Out', level: 'Zoom ({level}%)' },
  },
};

createPluginRegistration(I18nPluginPackage, {
  defaultLocale: 'en',
  locales: [locale],
  fallbackLocale: 'en',
  paramResolvers: {
    'zoom.level': ({ state, documentId }) => ({
      level: Math.round(state.plugins.zoom.documents[documentId]?.currentZoomLevel * 100),
    }),
  },
})
```

**Hooks:**
- `useTranslations(documentId?)` - Returns `{ translate(key, options?), locale }`
- `useTranslation(key, options?, documentId?)` - Single key convenience
- `useLocale()` - Current locale code
- `useI18nCapability()` -> `t(key, options?)`, `forDocument(id)`, `setLocale(code)`, `getLocale()`, `getAvailableLocales()`, `getLocaleInfo(code)`, `registerLocale(locale)`, `hasLocale(code)`, `registerParamResolver(key, resolver)`, `unregisterParamResolver(key)`

**Components:**
- `<Translate k="zoom.in" params? fallback? documentId? />`

---

### View Manager (`@embedpdf/plugin-view-manager`)

Multi-view layouts, split-screens, document tab groups.

```tsx
createPluginRegistration(ViewManagerPluginPackage, {
  defaultViewCount: 1,
})
```

**Components:**
- `<ViewContext viewId={id}>` - Render prop: `{ documentIds, activeDocumentId, setActiveDocument, isFocused, focus, addDocument, removeDocument }`

**Hooks:**
- `useViewManagerCapability()` -> `createView(id?)`, `removeView(id)`, `addDocumentToView(viewId, docId, index?)`, `removeDocumentFromView(viewId, docId)`, `setViewActiveDocument(viewId, docId)`, `moveDocumentBetweenViews(...)`, `setFocusedView(id)`, `getAllViews()`
- `useAllViews()` - Returns all views
- `useView(viewId)` - Returns `{ id, documentIds, activeDocumentId }`

---

## Security & Permissions

PDF documents support encryption (AES-256/RC4) and permission flags. Permission flags are metadata that viewers choose to honor -- they are NOT cryptographic security.

### Permission Overrides (resolution order, highest to lowest priority):
1. Per-Document Override
2. Global Configuration
3. Enforce Setting (`enforceDocumentPermissions`)
4. PDF Document Flags

```tsx
// Global config
const config = {
  permissions: {
    enforceDocumentPermissions: false, // ignore PDF flags entirely
    overrides: { print: false, modifyContents: false },
  }
};
<EmbedPDF engine={engine} config={config}>...</EmbedPDF>

// Per-document
createPluginRegistration(DocumentManagerPluginPackage, {
  initialDocuments: [{
    url: '/confidential.pdf',
    permissions: { overrides: { print: true } }
  }]
})
```

**Hook:** `useDocumentPermissions(documentId)` - Returns `{ canPrint, ... }`

**Permission keys:** `print`, `printHighQuality`, `modifyContents`, `copyContents`, `modifyAnnotations`, `fillForms`, `extractForAccessibility`, `assembleDocument`

---

## Minimal Getting Started Example

```sh
npm install @embedpdf/core @embedpdf/engines @embedpdf/plugin-document-manager @embedpdf/plugin-viewport @embedpdf/plugin-scroll @embedpdf/plugin-render
```

```tsx
import { createPluginRegistration } from '@embedpdf/core';
import { EmbedPDF } from '@embedpdf/core/react';
import { usePdfiumEngine } from '@embedpdf/engines/react';
import { Viewport, ViewportPluginPackage } from '@embedpdf/plugin-viewport/react';
import { Scroller, ScrollPluginPackage } from '@embedpdf/plugin-scroll/react';
import { DocumentContent, DocumentManagerPluginPackage } from '@embedpdf/plugin-document-manager/react';
import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/react';

const plugins = [
  createPluginRegistration(DocumentManagerPluginPackage, {
    initialDocuments: [{ url: 'https://snippet.embedpdf.com/ebook.pdf' }],
  }),
  createPluginRegistration(ViewportPluginPackage),
  createPluginRegistration(ScrollPluginPackage),
  createPluginRegistration(RenderPluginPackage),
];

export const PDFViewer = () => {
  const { engine, isLoading } = usePdfiumEngine();
  if (isLoading || !engine) return <div>Loading PDF Engine...</div>;

  return (
    <div style={{ height: '500px' }}>
      <EmbedPDF engine={engine} plugins={plugins}>
        {({ activeDocumentId }) =>
          activeDocumentId && (
            <DocumentContent documentId={activeDocumentId}>
              {({ isLoaded }) =>
                isLoaded && (
                  <Viewport documentId={activeDocumentId} style={{ backgroundColor: '#f1f3f5' }}>
                    <Scroller
                      documentId={activeDocumentId}
                      renderPage={({ width, height, pageIndex }) => (
                        <div style={{ width, height }}>
                          <RenderLayer documentId={activeDocumentId} pageIndex={pageIndex} />
                        </div>
                      )}
                    />
                  </Viewport>
                )
              }
            </DocumentContent>
          )
        }
      </EmbedPDF>
    </div>
  );
};
```

---

## Code Examples Reference

Complete working examples are in the `references/` directory:

| File | Description |
|------|-------------|
| `simple-pdf-viewer.tsx` | Minimal 3-plugin viewer (viewport, scroll, render) |
| `simple-zoom-example.tsx` | Zoom toolbar with controls |
| `annotation-example.tsx` | Highlight, ink, square tools with delete & selection menu |
| `capture-example.tsx` | Area screenshot with download |
| `commands-example.tsx` | Keyboard shortcuts & state-driven UI via command pattern |
| `document-manager-example.tsx` | Multi-document tabs with open/close |
| `export-example.tsx` | Download button |
| `i18n-example.tsx` | Multi-language (EN, ES, DE, NL) |
| `pan-example.tsx` | Hand tool drag navigation |
| `password-example.tsx` | Password-protected PDF handling |
| `pdfium-hook.tsx` | Direct engine hook usage |
| `print-example.tsx` | Print dialog integration |
| `redaction-example.tsx` | Mark & apply redactions (legacy mode) |
| `redaction-annotation-example.tsx` | Redactions as annotations with color customization |
| `render-example.tsx` | High-resolution page export |
| `render-page.tsx` | Single page rendering |
| `rotate-example.tsx` | Page rotation toolbar |
| `scroll-example.tsx` | Page navigation controls |
| `scroll-initial-page-example.tsx` | Load at specific page |
| `security-example.tsx` | Permission overrides (full access, print disabled, read-only) |
| `selection-example.tsx` | Text selection context menu |
| `spread-example.tsx` | Two-page spread layout |
| `thumbnail-example.tsx` | Thumbnail sidebar with virtualization |
| `tiling-example.tsx` | High-zoom tiling performance |
| `use-pdfium-hook.tsx` | Engine hook wrapper |
| `view-manager-example.tsx` | Split-view comparison layout |
| `viewport-example.tsx` | Viewport scrolling controls |
| `zoom-example.tsx` | Full zoom toolbar with marquee zoom |

---

## Package Reference

| Package | Purpose |
|---------|---------|
| `@embedpdf/core` | Core library, `createPluginRegistration`, `<EmbedPDF>`, `GlobalStoreState` |
| `@embedpdf/engines` | PDFium WASM engine, `usePdfiumEngine`, `PdfEngineProvider` |
| `@embedpdf/models` | Shared types: `Rotation`, `PdfAnnotationSubtype`, `PdfPermissionFlag`, etc. |
| `@embedpdf/plugin-document-manager` | Document lifecycle, tabs, passwords |
| `@embedpdf/plugin-viewport` | Scrollable container |
| `@embedpdf/plugin-scroll` | Virtualized scrolling, page navigation |
| `@embedpdf/plugin-render` | Page rendering |
| `@embedpdf/plugin-zoom` | Zoom controls, marquee zoom, gestures |
| `@embedpdf/plugin-annotation` | Annotations (highlight, ink, shapes, stamps) |
| `@embedpdf/plugin-selection` | Text selection & copy |
| `@embedpdf/plugin-pan` | Hand tool |
| `@embedpdf/plugin-rotate` | Document rotation |
| `@embedpdf/plugin-spread` | Single/two-page layouts |
| `@embedpdf/plugin-thumbnail` | Thumbnail sidebar |
| `@embedpdf/plugin-tiling` | High-zoom performance tiling |
| `@embedpdf/plugin-capture` | Area screenshot/capture |
| `@embedpdf/plugin-redaction` | Content redaction |
| `@embedpdf/plugin-print` | Print dialog |
| `@embedpdf/plugin-export` | Download/export |
| `@embedpdf/plugin-commands` | Command registry & shortcuts |
| `@embedpdf/plugin-i18n` | Internationalization |
| `@embedpdf/plugin-view-manager` | Multi-view/split layouts |
| `@embedpdf/plugin-interaction-manager` | Pointer events, `PagePointerProvider`, `GlobalPointerProvider` |
| `@embedpdf/plugin-history` | Undo/redo (used with annotations) |
