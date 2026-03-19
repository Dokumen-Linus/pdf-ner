# Plugin Annotation 2

## Redux-like Plugin Style

This plugin follows a Redux-like architecture pattern with a unidirectional data flow:

1. **State** (`state.ts`): Centralized immutable state managed by the plugin
2. **Actions** (`actions.ts`): Plain objects describing state changes, organized with action constants, interfaces, creators, and a reducer
3. **Reducer**: Pure function that takes current state and an action, returns new state
4. **Dispatch**: Method to send actions to the reducer to trigger state updates

This architecture ensures predictable state management, making the plugin easier to debug and test. The plugin extends `BasePlugin` which provides the core Redux-like infrastructure including `this.dispatch()` and `this.state` getter.

## Annotation Objects

Each PdfAnnotationSubtype from @embedpdf/models has an interface that extends PdfAnnotationObjectBase. PdfAnnotationObject is the union of all these interfaces. The only four PdfAnnotationSubtype that this plugin will render or create are HIGHLIGHT, UNDERLINE, STRIKEOUT, and SQUIGGLY.

```ts
interface PdfAnnotationObjectBase {
  id: string;
  type: PdfAnnotationSubtype;
  pageIndex: number;
  rect: Rect; // Rect is the bounding box of the annotation on the page
  author?: string;
  created?: Date; // Date is the JavaScript Date object
  modified?: Date; 
  blendMode?: PdfBlendMode; // blendMode is used when mutliple highlights overlap
  intent?: string; // not using intent
  flags?: PdfAnnotationFlagName[]; // not using flags
  contents?: string; // for text markup annotations, contents is the text
  custom?: any; // contains the entity type
}
```

```ts
export interface PdfHighlightAnnoObject extends PdfAnnotationObjectBase {
  type: PdfAnnotationSubtype.HIGHLIGHT;
  contents?: string;
  color: string;
  opacity: number;
  /** 
   * text markup annotations have segmentRects, a list of bounding boxes of each character
   * rect prop of PdfAnnotationObjectBase is the bounding box of all the segmentRects
   */
  segmentRects: Rect[];
}
```

Text markup annotations are highlight, underline, strikeout, or squiggly as defined in [pdf-text-markup-annotation-object.d.ts](lib/pdf-text-markup-annotation-object.d.ts) They all have color, opacity, segmentRects, and their contents equals the text of the annotation.

Using PdfTextMarkupAnnotationObject type allows consumers to write patches that change the PdfAnnotationSubtype, color, opacity, or segmentRects of the annotation.

```ts
// Example patch
import { PdfAnnotationSubtype } from "@embedpdf/models"
import { PdfTextMarkupAnnotationObject } from "pdf-text-markup-annotation-object"
import { subtypeToEnum } from "state"
const patch: Partial<PdfTextMarkupAnnotationObject> = {
  type: subtypeToEnum("highlight"),
  color: "#FF0000",
  opacity: 0.9
}
```

## Text Markup Annotations and use of SelectionPlugin and InteractionManagerPlugin

The AnnotationPlugin creates text markup annotations (highlight, underline, strikeout, squiggly) by integrating with two required plugins:

### SelectionPlugin Integration

- The SelectionPlugin provides text selection capabilities on the PDF
- AnnotationPlugin registers with the SelectionPlugin via `selection.enableForMode()` during initialization
- When a tool is active and text is selected, the `selection.onEndSelection()` callback fires
- The callback retrieves formatted selection data (rects, segmentRects, text) and creates an annotation using the active tool's defaults
- After creating the annotation, the selection is cleared via `selection.clear()`

### InteractionManagerPlugin Integration

- The InteractionManagerPlugin manages interaction modes across all plugins
- The InteractionManager's `onModeChange()` callback syncs the active mode back to the annotation plugin's state

### Workflow

1. User activates a tool (e.g., "highlight")
2. InteractionManager activates the corresponding mode
3. SelectionPlugin enables text selection for that mode
4. User selects text on the PDF
5. SelectionPlugin emits `onEndSelection` event
6. AnnotationPlugin creates annotation with active defaults and selection geometry
7. Optional: subtype is deactivated and/or annotation is selected based on config

## Capability Functions (exposed to all consumers with plugin-store)

The `AnnotationCapability` interface exposes the plugin's public API. All capability functions are built in `buildCapability()` and accessible via the plugin store.

### Event Hooks

- `onStateChange`: Subscribe to state changes

### Selection Functions

- `selectAnnotation(id)`: Select an annotation by ID
- `deselectAnnotation()`: Clear the current selection

### CRUD Operations - Single Items

- `createAnnotation(anno)`: Create an annotation and add to timeline
- `updateAnnotation(id, patch)`: Update annotation properties and add to timeline
- `deleteAnnotation(id)`: Delete an annotation and add to timeline

### CRUD Operations - Batch

- `createAnnotations(items)`: Batch create annotations
- `updateAnnotations(items)`: Batch update annotations
- `deleteAnnotations(ids)`: Batch delete annotations

### Timeline Operations

- `undo()`: Undo the last command in the timeline
- `redo()`: Redo the next command in the timeline

Reactivity to user PointerEvents are handled by the Single Items CRUD operations. User actions need support for undo/redo. Batch CRUD operations bypass the timeline system and should only be used by consumer programs.

### Annotations Storage

- `byUid`: Maps annotation UIDs to `TrackedAnnotation` objects containing commit state and annotation data
- `byPage`: Maps page indices to arrays of annotation UIDs for fast page-based lookups
- `byEntityType`: Maps entity types to arrays of annotation UIDs for fast entity-based lookups

### Selection

- `selectedUid`: ID of the currently selected annotation (null if none selected)


### Active Create Annotation Defaults

- `activeColor`: Default color for new annotations
- `activeOpacity`: Default opacity for new annotations
- `activeSubtype`: Default annotation subtype (tool)
- `activeEntityType`: Default entity type string

### Timeline Tracking

- `canUndo`/`canRedo`: Flags controlled by timeline position, can be used to enable/disable undo/redo buttons

### State Access

Consumers access state via:

1. `capability.onStateChange()` event hook for reactive updates
2. Direct state access through the plugin store (read-only)

All state mutations occur through actions dispatched to the reducer, ensuring immutability and predictability.

## Plugin Class Properties (not exposed to consumers)

The `AnnotationPlugin` class maintains several private properties for internal state management:

### Configuration

- `config: AnnotationPluginConfig`: Plugin configuration including `author`, `deactivateToolAfterCreate`, and `selectAfterCreate`

### Plugin Dependencies

- `selection: SelectionCapability | null`: Reference to SelectionPlugin capability
- `interactionManager: InteractionManagerCapability | null`: Reference to InteractionManagerPlugin capability

These are retrieved from the plugin registry during construction and used throughout the plugin lifecycle.

### Timeline (Undo/Redo System)

- `timeline: Command[]`: Array of undoable commands (create, update, delete, clear)
- `timelineIndex: number`: Current position in timeline (-1 means no commands executed)

Each user action (not batch operations) creates a `Command` with `execute()` and `undo()` methods. The timeline enables full undo/redo support for annotation operations.

Commands are objects implementing:

```ts
interface Command {
  execute(): void  // Performs the action
  undo(): void     // Reverses the action  
}
```

When a command is added to the timeline, any commands after the current index are discarded (standard undo/redo behavior).

Only Capability Functions intended for users (not consumer programs) are added to the timeline which is a list of commands. This allows for undo/redo functionality.

## Plugin Class Methods (not exposed to consumers)

The `AnnotationPlugin` class implements several private and protected methods:

### Lifecycle Methods

**`initialize(): Promise<void>`**

- Registers interaction modes for all tools with InteractionManager
- Enables text selection for tools via SelectionPlugin
- Sets up event listeners for mode changes and selection completion
- Creates annotations when text selection completes with an active tool

### Core Methods

**`buildCapability(): AnnotationCapability`**

- Constructs the public capability interface
- Maps capability functions to internal methods
- Returns the capability object exposed via plugin store

**`onStoreUpdated(prev, next): void`**

- Called after every state change in the parent EmbedPDF store
- Emits state changes to `state$` emitter
- Emits active tool changes when tool state changes

### Annotation Operations

**`createAnnotation(anno): void`**

- Creates command with execute/undo logic
- Adds author and creation timestamp
- Emits create events (uncommitted and committed)
- Adds command to timeline with `commitWithTimeline()`

**`createAnnotations(items): void`**

- Public method for batch creation
- Queues items if initial load incomplete
- Otherwise calls `batchCreateAnnotations()`

**`batchCreateAnnotations(items): void`**

- Creates multiple annotations without timeline support
- Used for programmatic/initial loading
- Immediately commits to PDF

**`updateAnnotation(id, patch): void`**

- Creates command that patches annotation and emits events
- Stores original values for undo operation
- Adds modified timestamp and author

**`updateAnnotations(items): void`**

- Batch update multiple annotations
- No timeline support, immediately commits

**`deleteAnnotation(id): void`**

- Creates command that marks annotation as deleted
- Stores original annotation for undo
- Deselects if currently selected

**`deleteAnnotations(ids): void`**

- Batch delete multiple annotations
- No timeline support, immediately commits

### Commit Operations

**`commitWithTimeline(command): void`**

- Adds command to timeline (clearing any forward history)
- Executes the command
- Calls commit
- Updates undo/redo state flags

**`commit(): Task<boolean, PdfErrorReason>`**

- Processes all pending commits
- Creates PDFium tasks for each operation type
- Returns task that resolves when all operations complete

## Actions (not exposed to consumers)

Actions follow a standard Redux pattern with constants, interfaces, creators, and a reducer defined in `actions.ts`. All state changes must be through dispatching an action, not `annotation-plugin.ts` modifying state directly.

### Immutability

All state updates create new objects using spread operators, ensuring the previous state remains unchanged. This enables:

- Predictable state updates
- Easy debugging via state history
- Efficient change detection in React components
- Reliable undo/redo functionality
