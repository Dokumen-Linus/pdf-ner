import io
from uuid import UUID

import pypdfium2
import pytest

from app.domains.pdf_utils.schemas import HighlightRequest

@pytest.fixture
def empty_pdf_bytes() -> bytes:
    """A valid single-page PDF with no searchable text."""
    doc = pypdfium2.PdfDocument.new()
    doc.new_page(612, 792)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


@pytest.fixture
def three_page_pdf_bytes() -> bytes:
    """A valid three-page PDF with no searchable text."""
    doc = pypdfium2.PdfDocument.new()
    for _ in range(3):
        doc.new_page(612, 792)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


@pytest.fixture
def sample_request() -> HighlightRequest:
    return HighlightRequest(
        pdf_id=UUID("12345678-1234-5678-1234-567812345678"),
        phrases={"hello": "#FF0000"},
        output_key="output/highlighted.pdf",
    )
