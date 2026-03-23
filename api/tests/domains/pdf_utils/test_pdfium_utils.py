from unittest.mock import patch

import pytest

from api.app.domains.pdf_utils.pdfium_utils import (
    highlight_phrases,
    parse_hex_color,
)


class TestParseHexColor:
    def test_with_hash_prefix(self):
        assert parse_hex_color("#FF0000") == (255, 0, 0)

    def test_without_hash_prefix(self):
        assert parse_hex_color("FF0000") == (255, 0, 0)

    def test_black(self):
        assert parse_hex_color("#000000") == (0, 0, 0)

    def test_white(self):
        assert parse_hex_color("#FFFFFF") == (255, 255, 255)

    def test_lowercase_accepted(self):
        assert parse_hex_color("#ff8800") == (255, 136, 0)

    def test_too_short_raises(self):
        with pytest.raises(ValueError, match="Invalid hex color"):
            parse_hex_color("#FFF")

    def test_too_long_raises(self):
        with pytest.raises(ValueError, match="Invalid hex color"):
            parse_hex_color("#FFFFFFF")


class TestHighlightPhrases:
    def test_not_found_returns_false_result(self, empty_pdf_bytes):
        """Phrase absent from the PDF produces found=False with zero occurrences."""
        _, results = highlight_phrases(empty_pdf_bytes, {"nonexistent": "#FF0000"})

        assert len(results) == 1
        assert results[0].found is False
        assert results[0].occurrences == 0
        assert results[0].pages == []

    def test_returns_valid_pdf_bytes(self, empty_pdf_bytes):
        """Output bytes are non-empty and begin with the PDF magic number."""
        output_bytes, _ = highlight_phrases(empty_pdf_bytes, {"absent": "#00FF00"})

        assert len(output_bytes) > 0
        assert output_bytes.startswith(b"%PDF")

    def test_result_count_matches_phrase_count(self, empty_pdf_bytes):
        """One PhraseHighlightResult is produced per input phrase."""
        _, results = highlight_phrases(
            empty_pdf_bytes,
            {"first": "#FF0000", "second": "#00FF00", "third": "#0000FF"},
        )

        assert len(results) == 3

    def test_found_phrase_sets_found_true(self, empty_pdf_bytes):
        """When find_text_objects returns a match, result.found is True with correct metadata."""
        fake_match = {
            "page": 0,
            "char_index": 0,
            "char_count": 5,
            "text": "hello",
            "char_rects": [(10.0, 10.0, 50.0, 20.0)],
            "overall_bounds": (10.0, 10.0, 50.0, 20.0),
        }
        with patch(
            "app.domains.pdf_utils.pdf_utils.find_text_objects",
            return_value=[fake_match],
        ):
            _, results = highlight_phrases(empty_pdf_bytes, {"hello": "#FF0000"})

        assert results[0].found is True
        assert results[0].occurrences == 1
        assert results[0].pages == [1]  # 0-indexed page becomes 1-indexed

    def test_found_phrase_on_multiple_pages(self, three_page_pdf_bytes):
        """Pages list de-duplicates and sorts page numbers (1-indexed)."""
        fake_matches = [
            {
                "page": 2,
                "char_index": 0,
                "char_count": 5,
                "text": "hello",
                "char_rects": [(10.0, 10.0, 50.0, 20.0)],
                "overall_bounds": (10.0, 10.0, 50.0, 20.0),
            },
            {
                "page": 0,
                "char_index": 10,
                "char_count": 5,
                "text": "hello",
                "char_rects": [(20.0, 20.0, 60.0, 30.0)],
                "overall_bounds": (20.0, 20.0, 60.0, 30.0),
            },
        ]
        with patch(
            "app.domains.pdf_utils.pdf_utils.find_text_objects",
            return_value=fake_matches,
        ):
            _, results = highlight_phrases(three_page_pdf_bytes, {"hello": "#0000FF"})

        assert results[0].pages == [1, 3]  # sorted, 1-indexed
        assert results[0].occurrences == 2

    def test_invalid_hex_raises_value_error(self, empty_pdf_bytes):
        """An invalid hex color raises ValueError before any PDF processing."""
        with pytest.raises(ValueError, match="Invalid hex color"):
            highlight_phrases(empty_pdf_bytes, {"hello": "#GGG"})

    def test_mixed_found_and_not_found(self, empty_pdf_bytes):
        """Found and missing phrases are both recorded in the correct positions."""
        fake_match = {
            "page": 0,
            "char_index": 0,
            "char_count": 3,
            "text": "yes",
            "char_rects": [(5.0, 5.0, 25.0, 15.0)],
            "overall_bounds": (5.0, 5.0, 25.0, 15.0),
        }

        def _mock_find(pdf, phrase, *args, **kwargs):
            return [fake_match] if phrase == "yes" else []

        with patch("app.domains.pdf_utils.pdf_utils.find_text_objects", side_effect=_mock_find):
            _, results = highlight_phrases(empty_pdf_bytes, {"yes": "#FF0000", "no": "#00FF00"})

        yes_result = next(r for r in results if r.phrase == "yes")
        no_result = next(r for r in results if r.phrase == "no")

        assert yes_result.found is True
        assert no_result.found is False
