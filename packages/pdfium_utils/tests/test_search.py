from unittest.mock import patch

import pytest

from pdfium_utils.search import find_text_objects


class TestFindTextObjects:
    def test_returns_empty_list_when_no_pages_specified_and_pdf_empty(self):
        mock_pdf = []
        result = find_text_objects(mock_pdf, "hello")
        assert result == []

    def test_searches_all_pages_by_default(self):
        def make_mock_page(textpage):
            return type("MockPage", (), {"get_textpage": lambda self: textpage})()

        def make_mock_textpage(texts):
            class MockSearcher:
                def __init__(self):
                    self._call_count = 0

                def get_next(self):
                    if self._call_count < len(texts):
                        result = texts[self._call_count]
                        self._call_count += 1
                        return result
                    return None

            return type(
                "MockTextPage",
                (),
                {
                    "search": lambda self, text, index=0, match_case=False, match_whole_word=False: (
                        MockSearcher()
                    ),
                    "get_charbox": lambda self, idx: (0.0, 0.0, 10.0, 10.0),
                    "get_text_range": lambda self, start, count: "test",
                },
            )()

        page0 = make_mock_page(make_mock_textpage([(0, 5), (10, 3)]))
        page1 = make_mock_page(make_mock_textpage([]))

        mock_pdf = [page0, page1]
        result = find_text_objects(mock_pdf, "test")

        assert len(result) == 2
        assert result[0]["page"] == 0
        assert result[1]["page"] == 0

    def test_searches_specific_page(self):
        searched = []

        class MockSearcher:
            def __init__(self):
                self.results = [(0, 5)]
                self._idx = 0

            def get_next(self):
                if self._idx < len(self.results):
                    r = self.results[self._idx]
                    self._idx += 1
                    return r
                return None

        textpage = type(
            "MockTextPage",
            (),
            {
                "search": lambda *a, **kw: MockSearcher(),
                "get_charbox": lambda self, idx: (1.0, 2.0, 3.0, 4.0),
                "get_text_range": lambda self, start, count: "found",
            },
        )()
        page = type("MockPage", (), {"get_textpage": lambda self: textpage})()
        mock_pdf = [type("MockPage", (), {"get_textpage": lambda self: None})(), page]

        result = find_text_objects(mock_pdf, "found", page_idx=1)

        assert len(result) == 1
        assert result[0]["page"] == 1
        assert result[0]["text"] == "found"
        assert result[0]["char_index"] == 0
        assert result[0]["char_count"] == 5

    def test_handles_charbox_exception_gracefully(self):
        class MockSearcher:
            def __init__(self):
                self._done = False

            def get_next(self):
                if not self._done:
                    self._done = True
                    return (0, 3)
                return None

        calls = []

        def charbox_that_fails(_self, idx):
            calls.append(idx)
            raise Exception("no charbox")

        textpage = type(
            "MockTextPage",
            (),
            {
                "search": lambda *a, **kw: MockSearcher(),
                "get_charbox": charbox_that_fails,
                "get_text_range": lambda self, start, count: "abc",
            },
        )()
        page = type("MockPage", (), {"get_textpage": lambda self: textpage})()
        mock_pdf = [page]

        result = find_text_objects(mock_pdf, "abc")

        assert len(result) == 1
        assert result[0]["char_rects"] == []
        assert result[0]["overall_bounds"] is None

    def test_computes_overall_bounds(self):
        class MockSearcher:
            def __init__(self):
                self._done = False

            def get_next(self):
                if not self._done:
                    self._done = True
                    return (0, 3)
                return None

        textpage = type(
            "MockTextPage",
            (),
            {
                "search": lambda *a, **kw: MockSearcher(),
                "get_charbox": lambda self, idx: [
                    (10.0, 20.0, 30.0, 25.0),
                    (30.0, 20.0, 50.0, 25.0),
                    (10.0, 25.0, 50.0, 30.0),
                ][idx],
                "get_text_range": lambda self, start, count: "abc",
            },
        )()
        page = type("MockPage", (), {"get_textpage": lambda self: textpage})()
        mock_pdf = [page]

        result = find_text_objects(mock_pdf, "abc")

        assert len(result[0]["char_rects"]) == 3
        assert result[0]["overall_bounds"] == (10.0, 20.0, 50.0, 30.0)
