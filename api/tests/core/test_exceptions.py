from unittest.mock import MagicMock

import pytest

from app.core.exceptions import (
    unhandled_exception_handler,
)


class TestUnhandledExceptionHandler:
    @pytest.mark.anyio
    async def test_returns_500_json(self):
        request = MagicMock()
        request.method = "GET"
        request.url.path = "/test"

        response = await unhandled_exception_handler(request, ValueError("boom"))

        assert response.status_code == 500
        body = response.body.decode()
        assert "Internal server error" in body
