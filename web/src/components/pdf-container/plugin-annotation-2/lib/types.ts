import {
  PdfAnnotationSubtype,
  PdfHighlightAnnoObject,
  PdfSquigglyAnnoObject,
  PdfStrikeOutAnnoObject,
  PdfUnderlineAnnoObject,
} from "@embedpdf/models"

export type PdfTextMarkupAnnotationObject =
  | PdfHighlightAnnoObject
  | PdfUnderlineAnnoObject
  | PdfStrikeOutAnnoObject
  | PdfSquigglyAnnoObject

export interface Command {
  execute(): void
  undo(): void
}

export enum CommitType {
  Create = 0,
  Update = 1,
  Delete = 2,
}

export interface Commit {
  type: CommitType
  anno: PdfTextMarkupAnnotationObject
}

export type Subtype = "highlight" | "underline" | "strikeout" | "squiggly"

export function subtypeToEnum(subtype: Subtype): PdfAnnotationSubtype {
  switch (subtype) {
    case "highlight":
      return PdfAnnotationSubtype.HIGHLIGHT
    case "underline":
      return PdfAnnotationSubtype.UNDERLINE
    case "strikeout":
      return PdfAnnotationSubtype.STRIKEOUT
    case "squiggly":
      return PdfAnnotationSubtype.SQUIGGLY
    default:
      throw new Error(`Invalid subtype: ${subtype}`)
  }
}

// check a Subtype instead of an annotation object
export function isValidActiveSubtype(subtype: PdfAnnotationSubtype | null): boolean {
  if (subtype === null) return true
  return [
    PdfAnnotationSubtype.HIGHLIGHT,
    PdfAnnotationSubtype.UNDERLINE,
    PdfAnnotationSubtype.STRIKEOUT,
    PdfAnnotationSubtype.SQUIGGLY,
  ].includes(subtype)
}

// ─────────────────────────────────────────────────────────
// Subtype Predicates
// ─────────────────────────────────────────────────────────

// generic subtype-to-object mapper
type AnnoOf<S extends PdfAnnotationSubtype> = Extract<PdfTextMarkupAnnotationObject, { type: S }>

// type guards
export function isHighlight(
  a: PdfTextMarkupAnnotationObject,
): a is AnnoOf<PdfAnnotationSubtype.HIGHLIGHT> {
  return a.type === PdfAnnotationSubtype.HIGHLIGHT
}

export function isUnderline(
  a: PdfTextMarkupAnnotationObject,
): a is AnnoOf<PdfAnnotationSubtype.UNDERLINE> {
  return a.type === PdfAnnotationSubtype.UNDERLINE
}

export function isStrikeout(
  a: PdfTextMarkupAnnotationObject,
): a is AnnoOf<PdfAnnotationSubtype.STRIKEOUT> {
  return a.type === PdfAnnotationSubtype.STRIKEOUT
}

export function isSquiggly(
  a: PdfTextMarkupAnnotationObject,
): a is AnnoOf<PdfAnnotationSubtype.SQUIGGLY> {
  return a.type === PdfAnnotationSubtype.SQUIGGLY
}
