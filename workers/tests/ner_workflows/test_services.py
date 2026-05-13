from app.domains.ner_workflows.domain.value_objects import (
    PageText,
    has_usable_text,
    join_page_text,
)


def test_text_helpers_join_and_detect_content():
    pages = [PageText(page_index=0, text=" Hello "), PageText(page_index=1, text="World")]

    assert join_page_text(pages) == "Hello\n\nWorld"
    assert has_usable_text(" text ")
    assert not has_usable_text("   ")
