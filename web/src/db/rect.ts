import type { Rect } from "@embedpdf/models"
import type { StoredRect } from "./types"

// Normalizes a `StoredRect` (the JSONB persistence shape — nested or flat,
// all fields optional) into the strict `Rect` the EmbedPDF plugin consumes
// (both `origin` and `size` required, all numeric).
//
// Precedence: prefer the nested `{ origin, size }` form when present;
// otherwise fall back to the flat `{ x, y, width, height }` form. Missing
// fields default to 0 — a bad row renders as a zero-size rect at the page
// origin rather than crashing the viewer. A `console.warn` surfaces the
// fault without blocking the editor.
export function toEmbedRect(stored: StoredRect): Rect {
  const x = stored.origin?.x ?? stored.x
  const y = stored.origin?.y ?? stored.y
  const width = stored.size?.width ?? stored.width
  const height = stored.size?.height ?? stored.height

  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    console.warn("[db/rect] StoredRect missing fields, defaulting to 0", stored)
  }

  return {
    origin: { x: x ?? 0, y: y ?? 0 },
    size: { width: width ?? 0, height: height ?? 0 },
  }
}

export function toEmbedRects(stored: StoredRect[]): Rect[] {
  return stored.map(toEmbedRect)
}
