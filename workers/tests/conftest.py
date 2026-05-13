import os
from pathlib import Path
import sys

# Set required env vars before any app imports
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("WORKERS_DATABASE_URL", "postgres://localhost/dokumen_test?sslmode=disable")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("GOOGLE_AI_API_KEY", "test-key")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("ENV", "development")

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "packages" / "pdfium_utils"))

from datetime import UTC, datetime
from uuid import UUID

import pytest

from app.domains.context_engineering.domain.entities import (
    EntityTypeInfo,
    LabeledAnnotation,
    LabeledPdf,
)

# ─── Reusable IDs ────────────────────────────────────────────────────────

PROJECT_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
PDF_ID_1 = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
PDF_ID_2 = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
PDF_ID_3 = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
PROMPT_ID = UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
ENTITY_TYPE_ID_1 = UUID("11111111-1111-1111-1111-111111111111")
ENTITY_TYPE_ID_2 = UUID("22222222-2222-2222-2222-222222222222")
ENTITY_TYPE_ID_3 = UUID("33333333-3333-3333-3333-333333333333")


# ─── Entity Type Fixtures ────────────────────────────────────────────────


@pytest.fixture
def name_entity_type() -> EntityTypeInfo:
    return EntityTypeInfo(
        name="full_name",
        user_definition="The person's full legal name",
        user_examples=["John Smith", "Jane Doe"],
        user_format_description="First Last",
        datatype="alpha",
        single_word=False,
        exact_length=None,
        unique=True,
        required=True,
        std_definition="A person's complete name",
        std_examples=["Alice Johnson"],
        std_format_description=None,
        std_regex=None,
        entity_type_id=ENTITY_TYPE_ID_1,
    )


@pytest.fixture
def ssn_entity_type() -> EntityTypeInfo:
    return EntityTypeInfo(
        name="ssn",
        user_definition=None,
        user_examples=[],
        user_format_description=None,
        datatype="alphanumeric",
        single_word=True,
        exact_length=11,
        unique=True,
        required=False,
        std_definition="Social Security Number",
        std_examples=["123-45-6789"],
        std_format_description="XXX-XX-XXXX",
        std_regex=r"\d{3}-\d{2}-\d{4}",
        entity_type_id=ENTITY_TYPE_ID_2,
    )


@pytest.fixture
def phone_entity_type() -> EntityTypeInfo:
    return EntityTypeInfo(
        name="phone_numbers",
        user_definition="Contact phone numbers",
        user_examples=["555-1234"],
        user_format_description=None,
        datatype="alphanumeric",
        single_word=False,
        exact_length=None,
        unique=False,
        required=False,
        entity_type_id=ENTITY_TYPE_ID_3,
    )


@pytest.fixture
def amount_entity_type() -> EntityTypeInfo:
    return EntityTypeInfo(
        name="amount",
        user_definition="Dollar amount",
        user_examples=["100.50"],
        user_format_description="decimal number",
        datatype="float",
        single_word=True,
        exact_length=None,
        unique=True,
        required=True,
        entity_type_id=UUID("44444444-4444-4444-4444-444444444444"),
    )


@pytest.fixture
def count_entity_type() -> EntityTypeInfo:
    return EntityTypeInfo(
        name="item_count",
        user_definition="Number of items",
        user_examples=["5"],
        user_format_description=None,
        datatype="int",
        single_word=True,
        exact_length=None,
        unique=True,
        required=True,
        entity_type_id=UUID("55555555-5555-5555-5555-555555555555"),
    )


@pytest.fixture
def entity_types(name_entity_type, ssn_entity_type, phone_entity_type) -> list[EntityTypeInfo]:
    return [name_entity_type, ssn_entity_type, phone_entity_type]


# ─── Labeled PDF Fixtures ────────────────────────────────────────────────


@pytest.fixture
def labeled_annotation_1() -> LabeledAnnotation:
    return LabeledAnnotation(
        pdf_id=PDF_ID_1,
        entity_type_name="full_name",
        labeled_text="John Smith",
        page_index=0,
        entity_type_id=ENTITY_TYPE_ID_1,
    )


@pytest.fixture
def labeled_annotation_2() -> LabeledAnnotation:
    return LabeledAnnotation(
        pdf_id=PDF_ID_1,
        entity_type_name="ssn",
        labeled_text="123-45-6789",
        page_index=1,
        entity_type_id=ENTITY_TYPE_ID_2,
    )


@pytest.fixture
def labeled_annotation_3() -> LabeledAnnotation:
    return LabeledAnnotation(
        pdf_id=PDF_ID_1,
        entity_type_name="phone_numbers",
        labeled_text="555-1234",
        page_index=0,
        entity_type_id=ENTITY_TYPE_ID_3,
    )


@pytest.fixture
def labeled_annotation_4() -> LabeledAnnotation:
    return LabeledAnnotation(
        pdf_id=PDF_ID_1,
        entity_type_name="phone_numbers",
        labeled_text="555-5678",
        page_index=1,
        entity_type_id=ENTITY_TYPE_ID_3,
    )


@pytest.fixture
def labeled_pdf_1(
    labeled_annotation_1, labeled_annotation_2, labeled_annotation_3, labeled_annotation_4
) -> LabeledPdf:
    return LabeledPdf(
        pdf_id=PDF_ID_1,
        full_text="John Smith\nSSN: 123-45-6789\nPhone: 555-1234, 555-5678",
        text_by_page=None,
        annotations=[
            labeled_annotation_1,
            labeled_annotation_2,
            labeled_annotation_3,
            labeled_annotation_4,
        ],
    )


@pytest.fixture
def labeled_pdf_2() -> LabeledPdf:
    return LabeledPdf(
        pdf_id=PDF_ID_2,
        full_text="Jane Doe\nSSN: 987-65-4321\nPhone: 555-0000",
        text_by_page=None,
        annotations=[
            LabeledAnnotation(
                pdf_id=PDF_ID_2,
                entity_type_name="full_name",
                labeled_text="Jane Doe",
                page_index=0,
                entity_type_id=ENTITY_TYPE_ID_1,
            ),
            LabeledAnnotation(
                pdf_id=PDF_ID_2,
                entity_type_name="ssn",
                labeled_text="987-65-4321",
                page_index=0,
                entity_type_id=ENTITY_TYPE_ID_2,
            ),
            LabeledAnnotation(
                pdf_id=PDF_ID_2,
                entity_type_name="phone_numbers",
                labeled_text="555-0000",
                page_index=0,
                entity_type_id=ENTITY_TYPE_ID_3,
            ),
        ],
    )


@pytest.fixture
def labeled_pdf_3() -> LabeledPdf:
    return LabeledPdf(
        pdf_id=PDF_ID_3,
        full_text="Alice Johnson\nSSN: 111-22-3333",
        text_by_page=None,
        annotations=[
            LabeledAnnotation(
                pdf_id=PDF_ID_3,
                entity_type_name="full_name",
                labeled_text="Alice Johnson",
                page_index=0,
                entity_type_id=ENTITY_TYPE_ID_1,
            ),
            LabeledAnnotation(
                pdf_id=PDF_ID_3,
                entity_type_name="ssn",
                labeled_text="111-22-3333",
                page_index=0,
                entity_type_id=ENTITY_TYPE_ID_2,
            ),
        ],
    )


@pytest.fixture
def labeled_pdfs(labeled_pdf_1, labeled_pdf_2, labeled_pdf_3) -> list[LabeledPdf]:
    return [labeled_pdf_1, labeled_pdf_2, labeled_pdf_3]


# ─── Other Fixtures ──────────────────────────────────────────────────────


@pytest.fixture
def frozen_now() -> datetime:
    return datetime(2026, 3, 28, 12, 0, 0, tzinfo=UTC)
