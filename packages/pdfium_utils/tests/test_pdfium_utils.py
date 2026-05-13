from unittest.mock import patch

import pypdfium2
from pypdfium2 import raw
from pdfium_utils.annotate import (
    TextMarkupAnnotationRequest,
    create_text_markup_annotations,
    extract_text,
    extract_text_by_page,
    normalize_hex_color,
    parse_hex_color,
)
from pdfium_utils.search_and_annotate import highlight_phrases
import pytest


class TestParseHexColor:
    def test_with_hash_prefix(self):
        assert parse_hex_color("#FF0000") == (255, 0, 0)

    def test_lowercase_normalizes(self):
        assert normalize_hex_color("#ff8800") == "#FF8800"
        assert parse_hex_color("#ff8800") == (255, 136, 0)

    def test_black(self):
        assert parse_hex_color("#000000") == (0, 0, 0)

    def test_white(self):
        assert parse_hex_color("#FFFFFF") == (255, 255, 255)

    def test_too_short_raises(self):
        with pytest.raises(ValueError, match="Invalid #RRGGBB color"):
            parse_hex_color("#FFF")

    def test_without_hash_raises(self):
        with pytest.raises(ValueError, match="Invalid #RRGGBB color"):
            parse_hex_color("FF0000")

    def test_too_long_raises(self):
        with pytest.raises(ValueError, match="Invalid #RRGGBB color"):
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
            "pdfium_utils.search_and_annotate.find_text_objects",
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
            "pdfium_utils.search_and_annotate.find_text_objects",
            return_value=fake_matches,
        ):
            _, results = highlight_phrases(three_page_pdf_bytes, {"hello": "#0000FF"})

        assert results[0].pages == [1, 3]  # sorted, 1-indexed
        assert results[0].occurrences == 2

    def test_invalid_hex_raises_value_error(self, empty_pdf_bytes):
        """An invalid hex color raises ValueError before any PDF processing."""
        with pytest.raises(ValueError, match="Invalid #RRGGBB color"):
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

        with patch("pdfium_utils.search_and_annotate.find_text_objects", side_effect=_mock_find):
            _, results = highlight_phrases(empty_pdf_bytes, {"yes": "#FF0000", "no": "#00FF00"})

        yes_result = next(r for r in results if r.phrase == "yes")
        no_result = next(r for r in results if r.phrase == "no")

        assert yes_result.found is True
        assert no_result.found is False


class TestExtractText:
    def test_extract_text_by_page_uses_pdfium_text_pages(self):
        first_textpage = type(
            "MockTextPage",
            (),
            {
                "count_chars": lambda self: 5,
                "get_text_range": lambda self, index, count: f"first:{index}:{count}",
            },
        )()
        second_textpage = type(
            "MockTextPage",
            (),
            {
                "count_chars": lambda self: 6,
                "get_text_range": lambda self, index, count: f"second:{index}:{count}",
            },
        )()
        mock_pages = [
            type("MockPage", (), {"get_textpage": lambda self: first_textpage})(),
            type("MockPage", (), {"get_textpage": lambda self: second_textpage})(),
        ]
        mock_pdf = type(
            "MockPdf",
            (),
            {
                "__len__": lambda self: len(mock_pages),
                "__getitem__": lambda self, index: mock_pages[index],
                "close": lambda self: None,
            },
        )()

        with patch("pdfium_utils.annotate.pypdfium2.PdfDocument", return_value=mock_pdf):
            result = extract_text_by_page(b"pdf-bytes")

        assert result == [
            {"page_index": 0, "text": "first:0:5"},
            {"page_index": 1, "text": "second:0:6"},
        ]

    def test_extract_text_joins_trimmed_page_text(self):
        with patch(
            "pdfium_utils.annotate.extract_text_by_page",
            return_value=[
                {"page_index": 0, "text": " first\n"},
                {"page_index": 1, "text": "second  "},
            ],
        ):
            result = extract_text(b"pdf-bytes")

        assert result == "first\n\nsecond"


class TestCreateTextMarkupAnnotations:
    def test_creates_real_pdf_annotation_and_db_attributes(self, empty_pdf_bytes):
        fake_match = {
            "page": 0,
            "char_index": 0,
            "char_count": 5,
            "text": "hello",
            "char_rects": [(10.0, 10.0, 30.0, 20.0), (30.0, 10.0, 50.0, 20.0)],
            "overall_bounds": (10.0, 10.0, 50.0, 20.0),
        }
        request = TextMarkupAnnotationRequest(
            request_id="entity-value-1",
            contents="hello",
            subtype="highlight",
            color="#ffff00",
            opacity=0.6,
        )

        with patch("pdfium_utils.annotate.find_text_objects", return_value=[fake_match]):
            output_bytes, results = create_text_markup_annotations(empty_pdf_bytes, [request])

        assert output_bytes.startswith(b"%PDF")
        assert results[0].found is True
        assert results[0].occurrences == 1
        assert results[0].attributes is not None
        assert results[0].attributes.page_index == 0
        assert results[0].attributes.rect == {
            "origin": {"x": 10.0, "y": 772.0},
            "size": {"width": 40.0, "height": 10.0},
        }
        assert results[0].attributes.segment_rects == [
            {"origin": {"x": 10.0, "y": 772.0}, "size": {"width": 20.0, "height": 10.0}},
            {"origin": {"x": 30.0, "y": 772.0}, "size": {"width": 20.0, "height": 10.0}},
        ]

        pdf = pypdfium2.PdfDocument(output_bytes)
        try:
            page = pdf[0]
            assert raw.FPDFPage_GetAnnotCount(page.raw) == 1
            annot = raw.FPDFPage_GetAnnot(page.raw, 0)
            try:
                assert raw.FPDFAnnot_GetSubtype(annot) == raw.FPDF_ANNOT_HIGHLIGHT
            finally:
                raw.FPDFPage_CloseAnnot(annot)
        finally:
            pdf.close()

    @pytest.mark.parametrize(
        ("subtype", "pdfium_subtype"),
        [
            ("highlight", raw.FPDF_ANNOT_HIGHLIGHT),
            ("underline", raw.FPDF_ANNOT_UNDERLINE),
            ("squiggly", raw.FPDF_ANNOT_SQUIGGLY),
            ("strikeout", raw.FPDF_ANNOT_STRIKEOUT),
        ],
    )
    def test_supports_text_markup_subtypes(self, empty_pdf_bytes, subtype, pdfium_subtype):
        fake_match = {
            "page": 0,
            "char_index": 0,
            "char_count": 5,
            "text": "hello",
            "char_rects": [(10.0, 10.0, 50.0, 20.0)],
            "overall_bounds": (10.0, 10.0, 50.0, 20.0),
        }
        request = TextMarkupAnnotationRequest(
            request_id=f"entity-value-{subtype}",
            contents="hello",
            subtype=subtype,
            color="#FF0000",
            opacity=0.5,
        )

        with patch("pdfium_utils.annotate.find_text_objects", return_value=[fake_match]):
            output_bytes, _results = create_text_markup_annotations(empty_pdf_bytes, [request])

        pdf = pypdfium2.PdfDocument(output_bytes)
        try:
            annot = raw.FPDFPage_GetAnnot(pdf[0].raw, 0)
            try:
                assert raw.FPDFAnnot_GetSubtype(annot) == pdfium_subtype
            finally:
                raw.FPDFPage_CloseAnnot(annot)
        finally:
            pdf.close()

    def test_is_idempotent_for_same_request_id(self, empty_pdf_bytes):
        fake_match = {
            "page": 0,
            "char_index": 0,
            "char_count": 5,
            "text": "hello",
            "char_rects": [(10.0, 10.0, 50.0, 20.0)],
            "overall_bounds": (10.0, 10.0, 50.0, 20.0),
        }
        request = TextMarkupAnnotationRequest(
            request_id="entity-value-1",
            contents="hello",
            subtype="highlight",
            color="#FFFF00",
            opacity=0.5,
        )

        with patch("pdfium_utils.annotate.find_text_objects", return_value=[fake_match]):
            once_bytes, _results = create_text_markup_annotations(empty_pdf_bytes, [request])
            twice_bytes, twice_results = create_text_markup_annotations(once_bytes, [request])

        assert twice_results[0].found is True
        pdf = pypdfium2.PdfDocument(twice_bytes)
        try:
            assert raw.FPDFPage_GetAnnotCount(pdf[0].raw) == 1
        finally:
            pdf.close()

    def test_not_found_does_not_create_annotation(self, empty_pdf_bytes):
        request = TextMarkupAnnotationRequest(
            request_id="entity-value-1",
            contents="missing",
            subtype="highlight",
            color="#FFFF00",
            opacity=0.5,
        )

        with patch("pdfium_utils.annotate.find_text_objects", return_value=[]):
            output_bytes, results = create_text_markup_annotations(empty_pdf_bytes, [request])

        assert results[0].found is False
        pdf = pypdfium2.PdfDocument(output_bytes)
        try:
            assert raw.FPDFPage_GetAnnotCount(pdf[0].raw) == 0
        finally:
            pdf.close()
