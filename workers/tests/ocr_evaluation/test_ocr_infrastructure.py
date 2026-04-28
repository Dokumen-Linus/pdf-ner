from app.domains.ocr_evaluation.infrastructure.ocr import _sample_page_indexes


def test_sample_page_indexes_keeps_first_middle_last():
    assert _sample_page_indexes(10, 3) == [0, 5, 9]
    assert _sample_page_indexes(10, 2) == [0, 9]
    assert _sample_page_indexes(2, 5) == [0, 1]
