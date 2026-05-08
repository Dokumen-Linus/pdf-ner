from dataclasses import dataclass, field

import io

import pypdfium2

from .annotate import draw_rect, parse_hex_color
from .search import find_text_objects


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
