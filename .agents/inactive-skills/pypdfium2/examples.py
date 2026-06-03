"""Reference-only pypdfium2 examples.

These snippets cover more pypdfium2 functions than the current
`packages/pdfium_utils` helpers, but they are not the production source of
truth. Prefer the repo helpers for search, annotation, and highlighting, and
adapt these examples only when the helper package does not cover the task.
"""

import logging
from pathlib import Path

import pypdfium2


def extract_text_from_pdf(pdf_path):
    try:
        pdf = pypdfium2.PdfDocument(pdf_path)
        text = ""
        for page in pdf:
            text += page.get_textpage().get_text_range()
        logging.info(f"Successfully extracted text from {pdf_path}")
        return text
    except Exception as e:
        logging.error(f"Error extracting text from {pdf_path}: {e}")
        return None


def extract_bookmarks_from_pdf(pdf_path):
    try:
        pdf = pypdfium2.PdfDocument(pdf_path)
        bookmarks = pdf.get_toc()
        logging.info(f"Successfully extracted bookmarks from {pdf_path}")
        return bookmarks
    except Exception as e:
        logging.error(f"Error extracting bookmarks from {pdf_path}: {e}")
        return None


def get_page_count(pdf_path):
    try:
        pdf = pypdfium2.PdfDocument(pdf_path)
        page_count = len(pdf)
        logging.info(f"{pdf_path} has {page_count} pages.")
        return page_count
    except Exception as e:
        logging.error(f"Error getting page count from {pdf_path}: {e}")
        return None


def get_page_metadata(pdf_path, page_idx):
    try:
        pdf = pypdfium2.PdfDocument(pdf_path)
        page = pdf.get_page(page_idx)
        metadata = {
            "width": page.get_width(),
            "height": page.get_height(),
            "rotation": page.get_rotation(),  # Clockwise page rotation in degrees
            "bleed_box": page.get_bleedbox(),  # Area including bleed margins for printing
            "crop_box": page.get_cropbox(),  # Visible area after cropping
            "media_box": page.get_mediabox(),  # Full physical page size (default box)
            "trim_box": page.get_trimbox(),  # Final intended page size after trimming
        }
        logging.info(
            f"Successfully retrieved the following metadata from {pdf_path} at page {page_idx}: {metadata}"
        )
        return metadata
    except Exception as e:
        logging.error(f"Error retrieving metadata from {pdf_path}: {e}")
        return None


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


def draw_rect(page, bounds: tuple[float, float, float, float]) -> None:
    """Draw a rectangle on a PDF page for highlighting."""
    x1, y1, x2, y2 = bounds

    l = float(min(x1, x2))
    b = float(min(y1, y2))
    r = float(max(x1, x2))
    t = float(max(y1, y2))
    w = r - l
    h = t - b

    raw_rect = pypdfium2.raw.FPDFPageObj_CreateNewRect(l, b, w, h)

    pypdfium2.raw.FPDFPageObj_SetStrokeColor(raw_rect, 255, 0, 0, 100)
    pypdfium2.raw.FPDFPageObj_SetStrokeWidth(raw_rect, 2.0)
    pypdfium2.raw.FPDFPath_SetDrawMode(raw_rect, 0, 1)  # no fill, stroke

    rect_obj = pypdfium2.PdfObject(raw_rect)
    page.insert_obj(rect_obj)


class PhraseHighlightResult:
    """Result for a single phrase highlight attempt."""

    phrase: str
    found: bool
    occurrences: int = 0
    pages: list[int]


def highlight_phrases_in_pdf(
    pdf_path: str,
    phrases: list[str],
    output_path: str | None = None,
) -> dict:
    """Highlight multiple phrases in a PDF and save to a new file."""
    pdf_file = Path(pdf_path)
    if not pdf_file.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    if output_path is None:
        output_path = str(pdf_file.parent / f"{pdf_file.stem}_highlighted.pdf")

    try:
        pdf = pypdfium2.PdfDocument(pdf_path)

        results: list[PhraseHighlightResult] = []
        all_bounds_by_page: dict[int, list[tuple[float, float, float, float]]] = {}

        for phrase in phrases:
            matches = find_text_objects(pdf, phrase)

            if matches:
                pages_found = list(set(match["page"] for match in matches))

                for match in matches:
                    if match["overall_bounds"]:
                        page_idx = match["page"]
                        if page_idx not in all_bounds_by_page:
                            all_bounds_by_page[page_idx] = []
                        all_bounds_by_page[page_idx].append(match["overall_bounds"])

                results.append(
                    PhraseHighlightResult(
                        phrase=phrase,
                        found=True,
                        occurrences=len(matches),
                        pages=[p + 1 for p in pages_found],
                    )
                )
                logging.info(f"Found '{phrase}' {len(matches)} times in {pdf_path}")
            else:
                results.append(
                    PhraseHighlightResult(
                        phrase=phrase,
                        found=False,
                        occurrences=0,
                        pages=[],
                    )
                )
                logging.info(f"Phrase '{phrase}' not found in {pdf_path}")

        for page_idx, bounds_list in all_bounds_by_page.items():
            page = pdf[page_idx]
            for bounds in bounds_list:
                draw_rect(page, bounds)
            page.gen_content()

        pdf.save(output_path)
        pdf.close()

        successfully_highlighted = sum(1 for r in results if r.found)
        logging.info(
            f"Successfully highlighted {successfully_highlighted}/{len(phrases)} phrases. "
            f"Saved to {output_path}"
        )

        return {
            "pdf_path": pdf_path,
            "output_path": output_path,
            "total_phrases": len(phrases),
            "successfully_highlighted": successfully_highlighted,
            "results": results,
        }

    except Exception as e:
        logging.error(f"Error highlighting phrases in {pdf_path}: {e}")
        raise
