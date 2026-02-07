"""Service layer for PDF text extraction operations."""

import logging
from pathlib import Path

import pypdfium2

from .schemas import (
    BookmarkItem,
    BookmarksResponse,
    PhraseHighlightResult,
    SearchTextResponse,
)

logger = logging.getLogger(__name__)


def extract_bookmarks_from_pdf(pdf_path: str) -> BookmarksResponse:
    """Extract bookmarks from a PDF file."""
    pdf_file = Path(pdf_path)
    if not pdf_file.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    try:
        pdf = pypdfium2.PdfDocument(pdf_path)
        bookmarks = pdf.get_toc()

        bookmark_items: list[BookmarkItem] = []
        for bookmark in bookmarks:
            dest = bookmark.get_dest()
            page_idx = dest.get_index() if dest else 0

            bookmark_items.append(
                BookmarkItem(
                    title=bookmark.get_title(),
                    page=page_idx + 1,  # Convert to 1-indexed
                    level=bookmark.level,
                    count=bookmark.get_count(),
                )
            )

        pdf.close()
        logger.info(f"Successfully extracted {len(bookmark_items)} bookmarks from {pdf_path}")

        return BookmarksResponse(
            pdf_path=pdf_path,
            bookmarks=bookmark_items,
            total_count=len(bookmark_items),
        )

    except Exception as e:
        logger.error(f"Error extracting bookmarks from {pdf_path}: {e}")
        raise


def search_text_in_pdf(pdf_path: str, search_text: str) -> SearchTextResponse:
    """Search for text in a PDF file, returning early if found on first page."""
    pdf_file = Path(pdf_path)
    if not pdf_file.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    try:
        pdf = pypdfium2.PdfDocument(pdf_path)

        if len(pdf) > 0:
            page = pdf[0]
            textpage = page.get_textpage()
            searcher = textpage.search(search_text, index=0, match_case=False, match_whole_word=False)

            result = searcher.get_next()
            if result is not None:
                pdf.close()
                logger.info(f"Found '{search_text}' on first page of {pdf_path}")
                return SearchTextResponse(
                    pdf_path=pdf_path,
                    search_text=search_text,
                    found=True,
                    page_found=1,
                    message="Text found on page 1",
                )

        for page_idx in range(1, len(pdf)):
            page = pdf[page_idx]
            textpage = page.get_textpage()
            searcher = textpage.search(search_text, index=0, match_case=False, match_whole_word=False)

            result = searcher.get_next()
            if result is not None:
                pdf.close()
                logger.info(f"Found '{search_text}' on page {page_idx + 1} of {pdf_path}")
                return SearchTextResponse(
                    pdf_path=pdf_path,
                    search_text=search_text,
                    found=True,
                    page_found=page_idx + 1,
                    message=f"Text found on page {page_idx + 1}",
                )

        pdf.close()
        logger.info(f"Text '{search_text}' not found in {pdf_path}")
        return SearchTextResponse(
            pdf_path=pdf_path,
            search_text=search_text,
            found=False,
            page_found=None,
            message="Text not found in document",
        )

    except Exception as e:
        logger.error(f"Error searching text in {pdf_path}: {e}")
        raise


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
                logger.info(f"Found '{phrase}' {len(matches)} times in {pdf_path}")
            else:
                results.append(
                    PhraseHighlightResult(
                        phrase=phrase,
                        found=False,
                        occurrences=0,
                        pages=[],
                    )
                )
                logger.info(f"Phrase '{phrase}' not found in {pdf_path}")

        for page_idx, bounds_list in all_bounds_by_page.items():
            page = pdf[page_idx]
            for bounds in bounds_list:
                draw_rect(page, bounds)
            page.gen_content()

        pdf.save(output_path)
        pdf.close()

        successfully_highlighted = sum(1 for r in results if r.found)
        logger.info(
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
        logger.error(f"Error highlighting phrases in {pdf_path}: {e}")
        raise
