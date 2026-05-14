from unittest.mock import MagicMock, patch

from app.core.messaging import celery_client, celery_message_headers


class TestCeleryMessageHeaders:
    def test_returns_headers_from_logging(self):
        with patch(
            "app.core.messaging.build_celery_headers", return_value={"x-request-id": "abc"}
        ) as mock_build:
            result = celery_message_headers({"existing": "val"})
            assert result == {"x-request-id": "abc"}
            mock_build.assert_called_once_with({"existing": "val"})

    def test_no_headers(self):
        with patch("app.core.messaging.build_celery_headers", return_value={}) as mock_build:
            result = celery_message_headers()
            assert result == {}
            mock_build.assert_called_once_with(None)


class TestCeleryClient:
    def test_client_is_configured(self):
        assert celery_client.conf.broker_url is not None
