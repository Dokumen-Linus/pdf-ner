from decimal import Decimal
from uuid import uuid4

from app.domains.ocr_evaluation.domain.entities import (
    JudgeResult,
    PageEvaluation,
)
from app.domains.ocr_evaluation.domain.services import (
    is_pdfium_usable,
    normalize_for_similarity,
    parse_judge_result,
    recommend_page_method,
    score_tesseract_against_olm,
    summarize_evaluations,
)


def test_normalize_for_similarity_ignores_whitespace_and_symbols():
    assert normalize_for_similarity("Invoice #123 - ACME, LLC") == "invoice123acmellc"
    assert normalize_for_similarity("Invoice\n\t123!!!") == "invoice123"


def test_similarity_treats_punctuation_only_differences_as_match():
    tesseract = "Invoice #123\nTotal: $45.67\nVendor: ACME LLC " * 6
    olm = "Invoice 123 Total 45 67 Vendor ACME LLC " * 6

    metrics = score_tesseract_against_olm(tesseract, olm)

    assert metrics.status == "similar"
    assert metrics.score is not None
    assert metrics.score > 0.90


def test_similarity_penalizes_truncation():
    olm = "Patient name John Smith date of service January 12 2026 diagnosis code A123 " * 8
    tesseract = "Patient name John Smith"

    metrics = score_tesseract_against_olm(tesseract, olm)

    assert metrics.status == "tesseract_blank"
    assert metrics.score == 0.0


def test_similarity_is_inconclusive_when_olm_is_blank():
    metrics = score_tesseract_against_olm("some tesseract text " * 10, "")

    assert metrics.status == "olm_unavailable"
    assert metrics.score is None
    assert metrics.olm_blank is True


def test_pdfium_usability_uses_alphanumeric_content():
    assert is_pdfium_usable("This page has readable embedded text. " * 5)
    assert not is_pdfium_usable("---- ////   \n\n")


def test_parse_judge_result_normalizes_unknown_best_method():
    result = parse_judge_result(
        """
        {
          "best_method": "unknown",
          "tesseract_usable": true,
          "olm_usable": true,
          "confidence": 1.5,
          "quality_scores": {"tesseract": 0.9, "olm": 0.8},
          "rationale": "close"
        }
        """
    )

    assert result.best_method == "manual_review"
    assert result.confidence == 1.0


def test_recommend_page_prefers_pdfium_when_embedded_text_is_usable():
    metrics = score_tesseract_against_olm("bad", "better text " * 10)

    assert recommend_page_method("embedded readable text " * 5, metrics, None) == "pdfium"


def test_recommend_page_uses_judge_when_tesseract_differs_from_olm():
    metrics = score_tesseract_against_olm("bad", "better text " * 10)
    judge = JudgeResult(
        best_method="olm",
        tesseract_usable=False,
        olm_usable=True,
        confidence=0.9,
        tesseract_quality=0.2,
        olm_quality=0.9,
        rationale="olm is coherent",
    )

    assert recommend_page_method("", metrics, judge) == "olm"


def test_summarize_recommends_tesseract_when_pages_match_olm():
    pdf_id = uuid4()
    metrics = score_tesseract_against_olm(
        "Invoice 123 Total 45 " * 10, "Invoice 123 Total 45 " * 10
    )
    evaluations = [
        PageEvaluation(
            pdf_id=pdf_id,
            page_index=i,
            pdfium_text="",
            tesseract_text="Invoice 123 Total 45",
            olm_text="Invoice 123 Total 45",
            similarity=metrics,
            judge_result=None,
            recommended_method="tesseract",
        )
        for i in range(3)
    ]

    summary = summarize_evaluations(
        evaluations,
        sampled_pdf_count=1,
        input_tokens=0,
        output_tokens=0,
        cost_usd=Decimal("0"),
    )

    assert summary.recommendation == "tesseract"
    assert summary.confidence == 1.0
