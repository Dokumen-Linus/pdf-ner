from dataclasses import dataclass
import ctypes
import io
import re

import pypdfium2

from .search import find_text_objects

_HEX_COLOR_RE = re.compile(r"^#[0-9A-F]{6}$")

_SUBTYPE_TO_PDFIUM = {
    "highlight": pypdfium2.raw.FPDF_ANNOT_HIGHLIGHT,
    "underline": pypdfium2.raw.FPDF_ANNOT_UNDERLINE,
    "squiggly": pypdfium2.raw.FPDF_ANNOT_SQUIGGLY,
    "strikeout": pypdfium2.raw.FPDF_ANNOT_STRIKEOUT,
}


@dataclass(frozen=True)
class TextMarkupAnnotationRequest:
    request_id: str
    contents: str
    subtype: str
    color: str
    opacity: float
    author: str = "Dokumen AI"
    blend_mode: str | None = None


@dataclass(frozen=True)
class TextMarkupAnnotationAttributes:
    rect: dict
    segment_rects: list[dict]
    page_index: int
    contents: str
    author: str
    blend_mode: str | None


@dataclass(frozen=True)
class TextMarkupAnnotationResult:
    request_id: str
    found: bool
    occurrences: int = 0
    attributes: TextMarkupAnnotationAttributes | None = None


def normalize_hex_color(hex_color: str) -> str:
    """Normalize and validate a strict #RRGGBB color for PDF/web annotations."""
    if not isinstance(hex_color, str):
        raise ValueError("Color must be a string")
    normalized = hex_color.upper()
    if not _HEX_COLOR_RE.fullmatch(normalized):
        raise ValueError(f"Invalid #RRGGBB color: {hex_color}")
    return normalized


def parse_hex_color(hex_color: str) -> tuple[int, int, int]:
    """Parse a strict #RRGGBB color string to (r, g, b)."""
    hex_color = normalize_hex_color(hex_color).lstrip("#")
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


def create_text_markup_annotations(
    pdf_bytes: bytes,
    requests: list[TextMarkupAnnotationRequest],
) -> tuple[bytes, list[TextMarkupAnnotationResult]]:
    """Create PDF text-markup annotations and return DB-ready attributes.

    Each request annotates the first matching occurrence of its contents in document
    order. Existing generated annotations with the same request_id are not duplicated.
    """
    pdf = pypdfium2.PdfDocument(pdf_bytes)
    try:
        existing_request_ids = _collect_existing_annotation_ids(pdf)
        results: list[TextMarkupAnnotationResult] = []
        touched_pages: set[int] = set()

        for request in requests:
            color = normalize_hex_color(request.color)
            matches = [
                match
                for match in find_text_objects(pdf, request.contents)
                if match["overall_bounds"]
            ]
            if not matches:
                results.append(
                    TextMarkupAnnotationResult(request_id=request.request_id, found=False)
                )
                continue

            match = matches[0]
            page_index = int(match["page"])
            page = pdf[page_index]
            attributes = _match_to_attributes(
                match,
                page_height=float(page.get_height()),
                contents=request.contents,
                author=request.author,
                blend_mode=request.blend_mode,
            )

            if request.request_id not in existing_request_ids:
                _create_pdfium_text_markup_annotation(page, request, match, color)
                touched_pages.add(page_index)
                existing_request_ids.add(request.request_id)

            results.append(
                TextMarkupAnnotationResult(
                    request_id=request.request_id,
                    found=True,
                    occurrences=len(matches),
                    attributes=attributes,
                )
            )

        for page_index in touched_pages:
            pdf[page_index].gen_content()

        buf = io.BytesIO()
        pdf.save(buf)
        return buf.getvalue(), results
    finally:
        pdf.close()


def _create_pdfium_text_markup_annotation(page, request, match: dict, color: str) -> None:
    subtype = _SUBTYPE_TO_PDFIUM.get(request.subtype)
    if subtype is None:
        raise ValueError(f"Unsupported annotation subtype: {request.subtype}")
    if not 0 <= request.opacity <= 1:
        raise ValueError(f"Opacity must be between 0 and 1, got {request.opacity}")

    annot = pypdfium2.raw.FPDFPage_CreateAnnot(page.raw, subtype)
    if not annot:
        raise RuntimeError("Failed to create PDF annotation")

    try:
        bounds = _normal_pdf_bounds(match["overall_bounds"])
        rect = pypdfium2.raw.FS_RECTF(bounds[0], bounds[3], bounds[2], bounds[1])
        if not pypdfium2.raw.FPDFAnnot_SetRect(annot, ctypes.byref(rect)):
            raise RuntimeError("Failed to set PDF annotation rect")

        rects = match.get("char_rects") or [match["overall_bounds"]]
        for raw_rect in rects:
            left, bottom, right, top = _normal_pdf_bounds(raw_rect)
            quad = pypdfium2.raw.FS_QUADPOINTSF(
                left,
                top,
                right,
                top,
                left,
                bottom,
                right,
                bottom,
            )
            pypdfium2.raw.FPDFAnnot_AppendAttachmentPoints(annot, ctypes.byref(quad))

        red, green, blue = parse_hex_color(color)
        alpha = int(round(request.opacity * 255))
        pypdfium2.raw.FPDFAnnot_SetColor(
            annot,
            pypdfium2.raw.FPDFANNOT_COLORTYPE_Color,
            red,
            green,
            blue,
            alpha,
        )
        pypdfium2.raw.FPDFAnnot_SetFlags(annot, pypdfium2.raw.FPDF_ANNOT_FLAG_PRINT)
        _set_annotation_string(annot, "NM", request.request_id)
        _set_annotation_string(annot, "Contents", request.contents)
        _set_annotation_string(annot, "T", request.author)
    finally:
        pypdfium2.raw.FPDFPage_CloseAnnot(annot)


def _match_to_attributes(
    match: dict,
    *,
    page_height: float,
    contents: str,
    author: str,
    blend_mode: str | None,
) -> TextMarkupAnnotationAttributes:
    segment_rects = [
        _pdf_bounds_to_stored_rect(bounds, page_height)
        for bounds in (match.get("char_rects") or [match["overall_bounds"]])
    ]
    return TextMarkupAnnotationAttributes(
        rect=_pdf_bounds_to_stored_rect(match["overall_bounds"], page_height),
        segment_rects=segment_rects,
        page_index=int(match["page"]),
        contents=contents,
        author=author,
        blend_mode=blend_mode,
    )


def _pdf_bounds_to_stored_rect(
    bounds: tuple[float, float, float, float],
    page_height: float,
) -> dict:
    left, bottom, right, top = _normal_pdf_bounds(bounds)
    return {
        "origin": {"x": left, "y": page_height - top},
        "size": {"width": right - left, "height": top - bottom},
    }


def _normal_pdf_bounds(
    bounds: tuple[float, float, float, float],
) -> tuple[float, float, float, float]:
    x1, y1, x2, y2 = bounds
    left = float(min(x1, x2))
    bottom = float(min(y1, y2))
    right = float(max(x1, x2))
    top = float(max(y1, y2))
    return left, bottom, right, top


def _collect_existing_annotation_ids(pdf) -> set[str]:
    existing: set[str] = set()
    for page_index in range(len(pdf)):
        page = pdf[page_index]
        annot_count = pypdfium2.raw.FPDFPage_GetAnnotCount(page.raw)
        for annot_index in range(annot_count):
            annot = pypdfium2.raw.FPDFPage_GetAnnot(page.raw, annot_index)
            if not annot:
                continue
            try:
                value = _get_annotation_string(annot, "NM")
                if value:
                    existing.add(value)
            finally:
                pypdfium2.raw.FPDFPage_CloseAnnot(annot)
    return existing


def _set_annotation_string(annot, key: str, value: str) -> None:
    key_bytes = key.encode("ascii")
    value_bytes = (value + "\x00").encode("utf-16-le")
    buffer = (ctypes.c_ushort * (len(value_bytes) // 2)).from_buffer_copy(value_bytes)
    pypdfium2.raw.FPDFAnnot_SetStringValue(annot, key_bytes, buffer)


def _get_annotation_string(annot, key: str) -> str | None:
    key_bytes = key.encode("ascii")
    required = pypdfium2.raw.FPDFAnnot_GetStringValue(annot, key_bytes, None, 0)
    if required <= 2:
        return None
    buffer = (ctypes.c_ushort * (required // 2))()
    actual = pypdfium2.raw.FPDFAnnot_GetStringValue(annot, key_bytes, buffer, required)
    if actual <= 2:
        return None
    raw_bytes = ctypes.string_at(buffer, actual)
    return raw_bytes.decode("utf-16-le").rstrip("\x00") or None
