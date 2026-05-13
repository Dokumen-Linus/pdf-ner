from __future__ import annotations

from collections.abc import Iterable
import json
import re
import unicodedata

from .entities import EvaluationSummary, JudgeResult, PageEvaluation, PageOcrText, SimilarityMetrics

MIN_USABLE_ALNUM_CHARS = 80
HIGH_SIMILARITY_THRESHOLD = 0.90
MIN_TOKEN_OVERLAP = 0.80
MAX_LENGTH_MISMATCH = 0.35


def normalize_for_similarity(text: str | None) -> str:
    normalized = unicodedata.normalize("NFKC", text or "").lower()
    return "".join(ch for ch in normalized if ch.isalnum())


def normalized_tokens(text: str | None) -> list[str]:
    normalized = unicodedata.normalize("NFKC", text or "").lower()
    return re.findall(r"[^\W_]+", normalized, flags=re.UNICODE)


def score_tesseract_against_selected(
    tesseract_text: str,
    selected_ocr_text: str | None,
) -> SimilarityMetrics:
    tesseract_norm = normalize_for_similarity(tesseract_text)
    selected_norm = normalize_for_similarity(selected_ocr_text)
    tesseract_blank = len(tesseract_norm) < MIN_USABLE_ALNUM_CHARS
    selected_blank = len(selected_norm) < MIN_USABLE_ALNUM_CHARS

    if selected_blank:
        return SimilarityMetrics(
            normalized_tesseract_length=len(tesseract_norm),
            normalized_selected_length=len(selected_norm),
            character_similarity=None,
            token_overlap=None,
            length_ratio=None,
            tesseract_blank=tesseract_blank,
            selected_blank=True,
            score=None,
            status="selected_ocr_unavailable",
        )

    if tesseract_blank:
        return SimilarityMetrics(
            normalized_tesseract_length=len(tesseract_norm),
            normalized_selected_length=len(selected_norm),
            character_similarity=0.0,
            token_overlap=0.0,
            length_ratio=0.0,
            tesseract_blank=True,
            selected_blank=False,
            score=0.0,
            status="tesseract_blank",
        )

    char_similarity = _levenshtein_similarity(tesseract_norm, selected_norm)
    token_overlap = _token_overlap(
        normalized_tokens(tesseract_text),
        normalized_tokens(selected_ocr_text),
    )
    length_ratio = min(len(tesseract_norm), len(selected_norm)) / max(
        len(tesseract_norm),
        len(selected_norm),
    )
    length_penalty = max(0.0, 1.0 - min(abs(1.0 - length_ratio), 1.0))
    score = (char_similarity * 0.60) + (token_overlap * 0.30) + (length_penalty * 0.10)
    status = (
        "similar"
        if is_tesseract_similar_to_selected(score, token_overlap, length_ratio)
        else "different"
    )

    return SimilarityMetrics(
        normalized_tesseract_length=len(tesseract_norm),
        normalized_selected_length=len(selected_norm),
        character_similarity=char_similarity,
        token_overlap=token_overlap,
        length_ratio=length_ratio,
        tesseract_blank=False,
        selected_blank=False,
        score=score,
        status=status,
    )


def score_tesseract_against_olm(tesseract_text: str, olm_text: str | None) -> SimilarityMetrics:
    return score_tesseract_against_selected(tesseract_text, olm_text)


def is_pdfium_usable(text: str | None) -> bool:
    return len(normalize_for_similarity(text)) >= MIN_USABLE_ALNUM_CHARS


def is_tesseract_similar_to_selected(
    score: float | None,
    token_overlap: float | None,
    length_ratio: float | None,
) -> bool:
    if score is None or token_overlap is None or length_ratio is None:
        return False
    return (
        score >= HIGH_SIMILARITY_THRESHOLD
        and token_overlap >= MIN_TOKEN_OVERLAP
        and (1.0 - length_ratio) <= MAX_LENGTH_MISMATCH
    )


def is_tesseract_similar_to_olm(
    score: float | None,
    token_overlap: float | None,
    length_ratio: float | None,
) -> bool:
    return is_tesseract_similar_to_selected(score, token_overlap, length_ratio)


def build_judge_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "best_method": {"type": "string"},
            "tesseract_usable": {"type": "boolean"},
            "selected_ocr_usable": {"type": "boolean"},
            "confidence": {"type": "number"},
            "quality_scores": {
                "type": "object",
                "properties": {
                    "tesseract": {"type": "number"},
                    "selected_ocr": {"type": "number"},
                },
                "required": ["tesseract", "selected_ocr"],
                "additionalProperties": False,
            },
            "rationale": {"type": "string"},
        },
        "required": [
            "best_method",
            "tesseract_usable",
            "selected_ocr_usable",
            "confidence",
            "quality_scores",
            "rationale",
        ],
        "additionalProperties": False,
    }


def build_judge_prompt(page: PageOcrText, metrics: SimilarityMetrics) -> tuple[str, str]:
    system_prompt = (
        "You judge OCR text quality for downstream data extraction. Compare Tesseract and "
        f"{page.selected_ocr_method} text for coherence, typos, garbling, and whether "
        "differences are meaningful. "
        "Return only JSON."
    )
    user_prompt = "\n\n".join(
        [
            f"Page index: {page.page_index}",
            "Deterministic metrics:",
            json.dumps(similarity_metrics_payload(metrics), sort_keys=True),
            "Return JSON matching this schema:",
            json.dumps(build_judge_schema(), sort_keys=True),
            "Tesseract OCR excerpt:",
            excerpt(page.tesseract_text, limit=3000),
            f"{page.selected_ocr_method} OCR excerpt:",
            excerpt(page.selected_ocr_text or "", limit=3000),
            (
                f"Decide whether Tesseract is good enough compared with {page.selected_ocr_method}. "
                f"Use best_method as one of: tesseract, {page.selected_ocr_method}, manual_review."
            ),
        ]
    )
    return system_prompt, user_prompt


def parse_judge_result(raw_text: str, selected_ocr_method: str = "olm-ocr2") -> JudgeResult:
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError("Judge response was not valid JSON") from exc

    quality_scores = payload.get("quality_scores")
    if not isinstance(quality_scores, dict):
        raise ValueError("Judge response missing quality_scores object")

    best_method = str(payload.get("best_method", "manual_review"))
    if best_method == "olm":
        best_method = "olm-ocr2"
    if best_method not in {"tesseract", selected_ocr_method, "manual_review"}:
        best_method = "manual_review"

    selected_usable = payload.get("selected_ocr_usable", payload.get("olm_usable"))
    selected_quality = quality_scores.get("selected_ocr", quality_scores.get("olm", 0.0))
    return JudgeResult(
        best_method=best_method,
        tesseract_usable=bool(payload.get("tesseract_usable")),
        selected_ocr_usable=bool(selected_usable),
        confidence=_clamp(float(payload.get("confidence", 0.0))),
        tesseract_quality=_clamp(float(quality_scores.get("tesseract", 0.0))),
        selected_ocr_quality=_clamp(float(selected_quality)),
        rationale=str(payload.get("rationale", "")),
    )


def recommend_page_method(
    pdfium_text: str,
    similarity: SimilarityMetrics,
    judge_result: JudgeResult | None,
    selected_ocr_method: str = "olm-ocr2",
) -> str:
    if is_pdfium_usable(pdfium_text):
        return "pdfium"
    if judge_result is not None:
        if judge_result.best_method == "tesseract" and judge_result.tesseract_usable:
            return "tesseract"
        if judge_result.best_method == selected_ocr_method and judge_result.selected_ocr_usable:
            return selected_ocr_method
    if is_tesseract_similar_to_selected(
        similarity.score,
        similarity.token_overlap,
        similarity.length_ratio,
    ):
        return "tesseract"
    if not similarity.selected_blank:
        return selected_ocr_method
    return "manual_review"


def summarize_evaluations(
    evaluations: list[PageEvaluation],
    *,
    sampled_pdf_count: int,
    input_tokens: int,
    output_tokens: int,
    cost_usd,
) -> EvaluationSummary:
    sampled_page_count = len(evaluations)
    if sampled_page_count == 0:
        return EvaluationSummary(
            recommendation="manual_review",
            confidence=0.0,
            sampled_pdf_count=sampled_pdf_count,
            sampled_page_count=0,
            pdfium_usable_page_ratio=0.0,
            average_tesseract_vs_olm_score=None,
            average_judge_confidence=None,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
            details={"reason": "no_pages_evaluated"},
        )

    pdfium_ratio = _ratio(1 for page in evaluations if is_pdfium_usable(page.pdfium_text)) / (
        sampled_page_count
    )
    similarity_scores = [
        page.similarity.score for page in evaluations if page.similarity.score is not None
    ]
    judge_confidences = [
        page.judge_result.confidence for page in evaluations if page.judge_result is not None
    ]
    method_counts = _counts(page.recommended_method for page in evaluations)

    if pdfium_ratio >= 0.80:
        recommendation = "pdfium"
        confidence = min(0.95, pdfium_ratio)
    else:
        recommendation, confidence = _recommend_ocr_method(evaluations, method_counts)

    return EvaluationSummary(
        recommendation=recommendation,
        confidence=confidence,
        sampled_pdf_count=sampled_pdf_count,
        sampled_page_count=sampled_page_count,
        pdfium_usable_page_ratio=pdfium_ratio,
        average_tesseract_vs_olm_score=_average(similarity_scores),
        average_judge_confidence=_average(judge_confidences),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
        details={
            "method_counts": method_counts,
            "pdfium_usable_page_ratio": pdfium_ratio,
            "average_tesseract_vs_olm_score": _average(similarity_scores),
            "average_judge_confidence": _average(judge_confidences),
        },
    )


def similarity_metrics_payload(metrics: SimilarityMetrics) -> dict:
    return {
        "normalized_tesseract_length": metrics.normalized_tesseract_length,
        "normalized_selected_length": metrics.normalized_selected_length,
        "character_similarity": metrics.character_similarity,
        "token_overlap": metrics.token_overlap,
        "length_ratio": metrics.length_ratio,
        "tesseract_blank": metrics.tesseract_blank,
        "selected_blank": metrics.selected_blank,
        "score": metrics.score,
        "status": metrics.status,
    }


def judge_result_payload(result: JudgeResult | None) -> dict | None:
    if result is None:
        return None
    return {
        "best_method": result.best_method,
        "tesseract_usable": result.tesseract_usable,
        "selected_ocr_usable": result.selected_ocr_usable,
        "confidence": result.confidence,
        "quality_scores": {
            "tesseract": result.tesseract_quality,
            "selected_ocr": result.selected_ocr_quality,
        },
        "rationale": result.rationale,
    }


def excerpt(text: str | None, *, limit: int = 1000) -> str:
    clean = (text or "").strip()
    if len(clean) <= limit:
        return clean
    return clean[:limit].rstrip()


def _levenshtein_similarity(left: str, right: str) -> float:
    if left == right:
        return 1.0
    if not left or not right:
        return 0.0
    if len(left) < len(right):
        left, right = right, left

    previous = list(range(len(right) + 1))
    for i, left_ch in enumerate(left, start=1):
        current = [i]
        for j, right_ch in enumerate(right, start=1):
            insert_cost = current[j - 1] + 1
            delete_cost = previous[j] + 1
            replace_cost = previous[j - 1] + (left_ch != right_ch)
            current.append(min(insert_cost, delete_cost, replace_cost))
        previous = current
    distance = previous[-1]
    return max(0.0, 1.0 - (distance / max(len(left), len(right))))


def _token_overlap(left_tokens: list[str], right_tokens: list[str]) -> float:
    if not right_tokens:
        return 0.0
    left = set(left_tokens)
    right = set(right_tokens)
    if not left:
        return 0.0
    return len(left & right) / len(right)


def _recommend_ocr_method(
    evaluations: list[PageEvaluation],
    method_counts: dict[str, int],
) -> tuple[str, float]:
    total = len(evaluations)
    tesseract_votes = method_counts.get("tesseract", 0)
    selected_votes_by_method = {
        page.selected_ocr_method: method_counts.get(page.selected_ocr_method, 0)
        for page in evaluations
    }

    if tesseract_votes / total >= 0.60:
        return "tesseract", tesseract_votes / total
    for method, votes in selected_votes_by_method.items():
        if votes / total >= 0.60:
            return method, votes / total

    similarity_scores = [
        page.similarity.score for page in evaluations if page.similarity.score is not None
    ]
    avg_similarity = _average(similarity_scores)
    if avg_similarity is not None and avg_similarity >= HIGH_SIMILARITY_THRESHOLD:
        return "tesseract", min(0.85, avg_similarity)

    return "manual_review", max(method_counts.values(), default=0) / max(total, 1)


def _counts(values: Iterable[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return counts


def _average(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)


def _ratio(values: Iterable[object]) -> int:
    return sum(1 for _ in values)


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))
