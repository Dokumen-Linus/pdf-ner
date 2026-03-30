from dataclasses import dataclass, field
import io

import pypdfium2


def find_text_objects(pdf, search_text: str, page_idx: int | None = None) -> list[dict]:
    """Find all occurrences of text and return their bounding boxes."""
    results: list[dict] = []
    pages_to_search = [page_idx] if page_idx is not None else range(len(pdf))

    for idx in pages_to_search:
        page = pdf[idx]
        textpage = page.get_textpage()

        searcher = textpage.search(search_text, index=0, match_case=False, match_whole_word=False)

        while True:
            result = searcher.get_next()
            if result is None:
                break
            char_index, char_count = result

            rects = []
            for i in range(char_count):
                try:
                    rect = textpage.get_charbox(char_index + i)
                    rects.append(rect)
                except Exception:
                    pass

            if rects:
                x_coords = [r[0] for r in rects] + [r[2] for r in rects]
                y_coords = [r[1] for r in rects] + [r[3] for r in rects]
                overall_bounds = (
                    min(x_coords),
                    min(y_coords),
                    max(x_coords),
                    max(y_coords),
                )
            else:
                overall_bounds = None

            matched_text = textpage.get_text_range(char_index, char_count)

            results.append(
                {
                    "page": idx,
                    "char_index": char_index,
                    "char_count": char_count,
                    "text": matched_text,
                    "char_rects": rects,
                    "overall_bounds": overall_bounds,
                }
            )

    return results


def parse_hex_color(hex_color: str) -> tuple[int, int, int]:
    """Parse a hex color string (e.g. '#FF0000' or 'FF0000') to (r, g, b)."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        raise ValueError(f"Invalid hex color: #{hex_color}")
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
    )


def draw_rect(
    page,
    bounds: tuple[float, float, float, float],
    color: tuple[int, int, int] = (255, 0, 0),
    alpha: int = 100,
) -> None:
    """Draw a rectangle on a PDF page for highlighting."""
    x1, y1, x2, y2 = bounds

    left = float(min(x1, x2))
    bottom = float(min(y1, y2))
    right = float(max(x1, x2))
    top = float(max(y1, y2))
    w = right - left
    h = top - bottom

    raw_rect = pypdfium2.raw.FPDFPageObj_CreateNewRect(left, bottom, w, h)

    pypdfium2.raw.FPDFPageObj_SetStrokeColor(raw_rect, *color, alpha)
    pypdfium2.raw.FPDFPageObj_SetStrokeWidth(raw_rect, 2.0)
    pypdfium2.raw.FPDFPath_SetDrawMode(raw_rect, 0, 1)  # no fill, stroke

    rect_obj = pypdfium2.PdfObject(raw_rect)
    page.insert_obj(rect_obj)


@dataclass
class PhraseHighlightResult:
    """Result for a single phrase highlight attempt."""

    phrase: str
    found: bool
    occurrences: int = 0
    pages: list[int] = field(default_factory=list)


def highlight_phrases(
    pdf_bytes: bytes,
    phrases: dict[str, str],
) -> tuple[bytes, list[PhraseHighlightResult]]:
    """Highlight phrases in a PDF with per-phrase colors, operating entirely in memory.

    Args:
        pdf_bytes: Raw PDF file bytes.
        phrases: Mapping of phrase -> hex color (e.g. {"hello": "#FF0000"}).

    Returns:
        Tuple of (output_pdf_bytes, list of PhraseHighlightResult).
    """
    pdf = pypdfium2.PdfDocument(pdf_bytes)

    results: list[PhraseHighlightResult] = []
    bounds_by_page: dict[
        int, list[tuple[tuple[float, float, float, float], tuple[int, int, int]]]
    ] = {}

    for phrase, hex_color in phrases.items():
        color_rgb = parse_hex_color(hex_color)
        matches = find_text_objects(pdf, phrase)

        if matches:
            pages_found = sorted({match["page"] for match in matches})

            for match in matches:
                if match["overall_bounds"]:
                    page_idx = match["page"]
                    bounds_by_page.setdefault(page_idx, []).append(
                        (match["overall_bounds"], color_rgb)
                    )

            results.append(
                PhraseHighlightResult(
                    phrase=phrase,
                    found=True,
                    occurrences=len(matches),
                    pages=[p + 1 for p in pages_found],
                )
            )
        else:
            results.append(
                PhraseHighlightResult(
                    phrase=phrase,
                    found=False,
                )
            )

    for page_idx, entries in bounds_by_page.items():
        page = pdf[page_idx]
        for bounds, color_rgb in entries:
            draw_rect(page, bounds, color=color_rgb)
        page.gen_content()

    buf = io.BytesIO()
    pdf.save(buf)
    pdf.close()
    output_bytes = buf.getvalue()

    return output_bytes, results
