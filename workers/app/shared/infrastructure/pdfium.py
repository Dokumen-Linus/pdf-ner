from pdfium_utils.annotate import draw_rect, parse_hex_color
from pdfium_utils.search import find_text_objects
from pdfium_utils.search_and_annotate import PhraseHighlightResult, highlight_phrases

__all__ = [
    "PhraseHighlightResult",
    "draw_rect",
    "find_text_objects",
    "highlight_phrases",
    "parse_hex_color",
]
