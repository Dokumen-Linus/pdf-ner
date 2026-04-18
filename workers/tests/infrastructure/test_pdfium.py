from app.shared.infrastructure.pdfium import (
    PhraseHighlightResult,
    draw_rect,
    find_text_objects,
    highlight_phrases,
    parse_hex_color,
)


class TestPdfiumModule:
    def test_reexports_shared_pdfium_symbols(self):
        assert PhraseHighlightResult.__name__ == "PhraseHighlightResult"
        assert callable(draw_rect)
        assert callable(find_text_objects)
        assert callable(highlight_phrases)
        assert callable(parse_hex_color)
