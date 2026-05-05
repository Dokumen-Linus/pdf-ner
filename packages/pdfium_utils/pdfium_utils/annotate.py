import pypdfium2


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


def extract_text_by_page(pdf_bytes: bytes) -> list[dict[str, str | int]]:
    """Extract searchable PDF text as zero-indexed page results."""
    pdf = pypdfium2.PdfDocument(pdf_bytes)
    try:
        results: list[dict[str, str | int]] = []
        for page_index in range(len(pdf)):
            page = pdf[page_index]
            textpage = page.get_textpage()
            char_count = textpage.count_chars()
            text = textpage.get_text_range(0, char_count) if char_count else ""
            results.append({"page_index": page_index, "text": text})
        return results
    finally:
        pdf.close()


def extract_text(pdf_bytes: bytes, separator: str = "\n\n") -> str:
    """Extract searchable PDF text and join pages with a blank line."""
    page_texts = [str(page["text"]).strip() for page in extract_text_by_page(pdf_bytes)]
    return separator.join(page_texts).strip()


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