import pypdfium2


def find_text_objects(pdf, search_text: str, page_idx: int | None = None) -> list[dict]:
    """Find all occurrences of text and return their bounding boxes."""
    results: list[dict] = []
    pages_to_search = [page_idx] if page_idx is not None else range(len(pdf))

    for idx in pages_to_search:
        page = pdf[idx]
        textpage = page.get_textpage()

        searcher = textpage.search(search_text, index=0, match_case=False, match_whole_word=False)

        while True:
            result = searcher.get_next()
            if result is None:
                break
            char_index, char_count = result

            rects = []
            for i in range(char_count):
                try:
                    rect = textpage.get_charbox(char_index + i)
                    rects.append(rect)
                except Exception:
                    pass

            if rects:
                x_coords = [r[0] for r in rects] + [r[2] for r in rects]
                y_coords = [r[1] for r in rects] + [r[3] for r in rects]
                overall_bounds = (
                    min(x_coords),
                    min(y_coords),
                    max(x_coords),
                    max(y_coords),
                )
            else:
                overall_bounds = None

            matched_text = textpage.get_text_range(char_index, char_count)

            results.append(
                {
                    "page": idx,
                    "char_index": char_index,
                    "char_count": char_count,
                    "text": matched_text,
                    "char_rects": rects,
                    "overall_bounds": overall_bounds,
                }
            )

    return results
