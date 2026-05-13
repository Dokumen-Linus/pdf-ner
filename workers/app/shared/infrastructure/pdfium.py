from pdfium_utils.annotate import (
    TextMarkupAnnotationAttributes,
    TextMarkupAnnotationRequest,
    TextMarkupAnnotationResult,
    create_text_markup_annotations,
    draw_rect,
    normalize_hex_color,
    parse_hex_color,
)
from pdfium_utils.search import find_text_objects
from pdfium_utils.search_and_annotate import PhraseHighlightResult, highlight_phrases

__all__ = [
    "PhraseHighlightResult",
    "TextMarkupAnnotationAttributes",
    "TextMarkupAnnotationRequest",
    "TextMarkupAnnotationResult",
    "create_text_markup_annotations",
    "draw_rect",
    "find_text_objects",
    "highlight_phrases",
    "normalize_hex_color",
    "parse_hex_color",
]
