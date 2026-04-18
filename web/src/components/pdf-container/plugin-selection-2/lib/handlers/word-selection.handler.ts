import { Position } from "@embedpdf/models"

import {
  EmbedPdfPointerEvent,
  PointerEventHandlersWithLifecycle,
} from "../../../plugin-interaction-manager-2"
import { glyphAt, wordBoundsAt } from "../utils"

import { TextSelectionHandlerOptions } from "./text-selection.handler"

/**
 * Word-snapped variant of the text selection handler.
 *
 * The public interface mirrors `createTextSelectionHandler` so it can be
 * wired into `SelectionPlugin.registerSelectionOnPage` as a drop-in
 * replacement for modes that require word-level snapping.
 *
 * Invariant: the committed range always starts on a word's first
 * non-separator glyph and ends on a word's last non-separator glyph.
 * Whitespace that the gesture crosses before the first word or after
 * the last word is trimmed; only the spaces *between* selected words
 * remain, which is intrinsic to the range being inclusive.
 */
export function createWordSelectionHandler(
  opts: TextSelectionHandlerOptions,
): PointerEventHandlersWithLifecycle<EmbedPdfPointerEvent> {
  type WordBounds = { start: number; end: number }

  let anchorWord: WordBounds | null = null
  let activeWord: WordBounds | null = null

  const resolveWord = (point: Position): WordBounds | null => {
    const geo = opts.getGeometry()
    if (!geo) return null

    const glyphIndex = glyphAt(geo, point)
    if (glyphIndex === -1) return null

    return wordBoundsAt(geo, glyphIndex)
  }

  const sameWord = (a: WordBounds | null, b: WordBounds | null) =>
    !!a && !!b && a.start === b.start && a.end === b.end

  const resetLocalState = () => {
    anchorWord = null
    activeWord = null
  }

  return {
    onPointerDown: (point, evt, modeId) => {
      if (evt.target === evt.currentTarget) {
        opts.onEmptySpaceClick?.(modeId)
      }

      if (!opts.isEnabled(modeId)) return

      opts.onClear(modeId)
      resetLocalState()

      const word = resolveWord(point)
      // Pressing on a space or empty area must not begin a selection —
      // otherwise the resulting range would pull in the leading space.
      if (!word) return

      anchorWord = word
      activeWord = word
      opts.onBegin(word.start, modeId)
      opts.onUpdate(word.end, modeId)
    },

    onPointerMove: (point, _evt, modeId) => {
      if (!opts.isEnabled(modeId)) return

      const word = resolveWord(point)
      opts.setCursor(word ? "text" : null)

      if (!opts.isSelecting() || !anchorWord) return
      // Pointer is hovering whitespace — hold the range at the last word
      // boundary instead of extending the tail into the space.
      if (!word) return
      if (sameWord(word, activeWord)) return

      activeWord = word
      opts.onUpdate(word.end, modeId)
    },

    onPointerUp: (_point, _evt, modeId) => {
      if (!opts.isEnabled(modeId)) return
      opts.onEnd(modeId)
      resetLocalState()
    },

    onHandlerActiveEnd: (modeId) => {
      if (!opts.isEnabled(modeId)) return
      opts.onClear(modeId)
      resetLocalState()
    },
  }
}
