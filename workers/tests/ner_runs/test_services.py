from app.domains.ner_runs.domain.entities import EntityTypeInfo
from app.domains.ner_runs.domain.services import (
    build_constraint_text,
    build_fallback_system_prompt,
    build_json_schema,
)


def test_build_json_schema_uses_entity_constraints():
    entity_types = [
        EntityTypeInfo(
            name="invoice_number",
            user_definition="Invoice identifier",
            user_examples=["INV-100"],
            user_format_description=None,
            datatype="alphanumeric",
            single_word=True,
            exact_length=None,
            unique=True,
            required=True,
        ),
        EntityTypeInfo(
            name="line_amounts",
            user_definition="Line item amounts",
            user_examples=[],
            user_format_description=None,
            datatype="float",
            single_word=False,
            exact_length=None,
            unique=False,
            required=False,
        ),
    ]

    schema = build_json_schema(entity_types)

    assert schema["required"] == ["invoice_number", "line_amounts"]
    assert schema["properties"]["invoice_number"]["type"] == "string"
    assert schema["properties"]["line_amounts"]["items"]["type"] == "number"
    assert schema["additionalProperties"] is False


def test_build_fallback_system_prompt_includes_project_and_fields():
    prompt = build_fallback_system_prompt(
        "Invoices",
        [
            EntityTypeInfo(
                name="vendor",
                user_definition="Vendor name",
                user_examples=["Acme"],
                user_format_description=None,
                datatype="alpha",
                single_word=False,
                exact_length=None,
                unique=True,
                required=True,
            )
        ],
    )

    assert "Invoices" in prompt
    assert "vendor" in prompt
    assert "Vendor name" in prompt


def test_build_constraint_text_with_all_fields():
    entity = EntityTypeInfo(
        name="test",
        user_definition=None,
        user_examples=[],
        user_format_description=None,
        datatype="alphanumeric",
        single_word=True,
        exact_length=10,
        unique=True,
        required=True,
        std_regex=r"^[A-Z]{3}\d{3}$",
    )

    result = build_constraint_text(entity)

    assert "datatype=alphanumeric" in result
    assert "single word only" in result
    assert "exactly 10 characters" in result
    assert "pattern: ^[A-Z]{3}\\d{3}$" in result


def test_build_constraint_text_no_constraints():
    entity = EntityTypeInfo(
        name="test",
        user_definition=None,
        user_examples=[],
        user_format_description=None,
        datatype=None,
        single_word=False,
        exact_length=None,
        unique=True,
        required=False,
    )

    assert build_constraint_text(entity) == ""
