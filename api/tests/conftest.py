from unittest.mock import AsyncMock, MagicMock
import pytest


@pytest.fixture
def mock_anthropic_client():
    client = AsyncMock()
    client.messages.create = AsyncMock(
        return_value=MagicMock(content=[MagicMock(text='{"field1": "value1"}')])
    )
    return client


@pytest.fixture
def mock_openai_client():
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(
        return_value=MagicMock(
            choices=[MagicMock(message=MagicMock(content='{"field1": "value1"}'))]
        )
    )
    return client


@pytest.fixture
def mock_google_client():
    client = MagicMock()
    client.aio.models.generate_content = AsyncMock(
        return_value=MagicMock(text='{"field1": "value1"}')
    )
    return client


@pytest.fixture
def mock_clients(mock_anthropic_client, mock_openai_client, mock_google_client):
    return {
        "anthropic": mock_anthropic_client,
        "openai": mock_openai_client,
        "gemini": mock_google_client,
    }


@pytest.fixture
def sample_entity_types():
    """Sample entity type records for testing."""
    return [
        {
            "name": "company_name",
            "page1_definition": "The name of the company",
            "page1_examples": ["Acme Corp", "TechStart Inc"],
            "page1_datatype": "string",
            "unique": True,
            "required": True,
        },
        {
            "name": "invoice_number",
            "page1_definition": "The invoice identifier",
            "page1_examples": ["INV-001", "INV-002"],
            "page1_datatype": "string",
            "unique": True,
            "required": True,
        },
    ]


@pytest.fixture
def sample_template():
    """Sample template record for testing."""
    return {
        "id": 1,
        "txt": """Extract the following fields:
<PROJECT_DESCRIPTION>
Fields: <ENTITY_TYPES>
Definitions: <DEFINITIONS>
Examples: <EXAMPLE_VALUES>
Constraints: <CONSTRAINTS>
Required: <IS_REQUIRED>
Unique: <IS_UNIQUE>
Document:""",
        "inserts": [
            "<PROJECT_DESCRIPTION>",
            "<ENTITY_TYPES>",
            "<DEFINITIONS>",
            "<EXAMPLE_VALUES>",
            "<CONSTRAINTS>",
            "<IS_REQUIRED>",
            "<IS_UNIQUE>",
        ],
        "document_at_end": True,
    }
