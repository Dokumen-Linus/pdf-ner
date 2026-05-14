from uuid import uuid4

from app.shared.domain.prompts import PromptEntityMetadata, form_prompt_text


def test_form_prompt_text_replaces_supported_placeholders_with_json_arrays():
    entity_id = uuid4()

    rendered = form_prompt_text(
        (
            "<PROJECT_DESCRIPTION>|<ENTITY_TYPES>|<DEFINITIONS>|<EXAMPLE_VALUES>|"
            "<EXAMPLE_FINDS>|<REGEX>|<IS_REQUIRED>|<IS_UNIQUE>|<CONSTRAINTS>"
        ),
        project_description="Invoices",
        entity_types=[
            PromptEntityMetadata(
                entity_type_id=entity_id,
                name="invoice_id",
                definition="Invoice identifier",
                example_values=["INV-1"],
                example_finds=[{"value": "INV-1", "context": "Invoice INV-1"}],
                regex=r"INV-\d+",
                required=True,
                unique=False,
            )
        ],
    )

    assert "<PROJECT_DESCRIPTION>" not in rendered
    assert "<CONSTRAINTS>" not in rendered
    assert "Invoices" in rendered
    assert '["invoice_id"]' in rendered
    assert '["Invoice identifier"]' in rendered
    assert '[["INV-1"]]' in rendered
    assert '"value": "INV-1"' in rendered
    assert "[true]" in rendered
    assert "[false]" in rendered


def test_form_prompt_text_does_not_append_pdf_text():
    rendered = form_prompt_text(
        "Fields: <ENTITY_TYPES>",
        project_description=None,
        entity_types=[
            PromptEntityMetadata(
                entity_type_id=uuid4(),
                name="name",
                definition=None,
            )
        ],
    )

    assert "PDF text" not in rendered
    assert "user message" not in rendered
