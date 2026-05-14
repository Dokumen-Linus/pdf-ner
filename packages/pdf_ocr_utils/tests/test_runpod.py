from unittest.mock import patch

import httpx
import pytest

from pdf_ocr_utils import (
    RunpodOcrClient,
    RunpodOcrEndpointConfig,
    extract_text_from_runpod_image_bytes,
    make_runpod_ocr_client,
)
from pdf_ocr_utils.exceptions import OcrExecutionError


class TestRunpodAdditional:
    def test_init_rejects_empty_endpoint_url(self):
        with pytest.raises(ValueError, match="endpoint_url is required"):
            RunpodOcrClient(endpoint_url="")

    def test_init_rejects_negative_retries(self):
        with pytest.raises(ValueError, match="retries must be greater than or equal to 0"):
            RunpodOcrClient(endpoint_url="https://test/ocr", retries=-1)

    def test_rejects_non_bytes_image(self):
        client = RunpodOcrClient(
            "https://test/ocr",
            client=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200))),
        )
        with pytest.raises(TypeError, match="image must be bytes"):
            client.extract_text_from_image_bytes("not-bytes")

    def test_rejects_empty_bytes_image(self):
        client = RunpodOcrClient(
            "https://test/ocr",
            client=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200))),
        )
        with pytest.raises(ValueError, match="image must not be empty"):
            client.extract_text_from_image_bytes(b"")

    def test_context_manager_closes_client(self):
        transport = httpx.MockTransport(lambda r: httpx.Response(200, json={"text": "hi"}))
        with RunpodOcrClient(
            "https://test/ocr", client=httpx.Client(transport=transport)
        ) as client:
            result = client.extract_text_from_image_bytes(b"test")
            assert result == "hi"

    def test_close_does_nothing_when_using_external_client(self):
        transport = httpx.MockTransport(lambda r: httpx.Response(200, json={"text": "hi"}))
        external = httpx.Client(transport=transport)
        client = RunpodOcrClient("https://test/ocr", client=external)
        client.close()
        assert not external.is_closed
        external.close()

    def test_headers_includes_api_key_when_set(self):
        transport = httpx.MockTransport(lambda r: httpx.Response(200, json={"text": "ok"}))
        client = RunpodOcrClient(
            "https://test/ocr", api_key="secret", client=httpx.Client(transport=transport)
        )
        client.extract_text_from_image_bytes(b"data")
        assert client._headers()["Authorization"] == "Bearer secret"

    def test_timeout_exception_with_retries(self):
        call_count = 0

        def handler(request):
            nonlocal call_count
            call_count += 1
            raise httpx.TimeoutException("timeout", request=request)

        transport = httpx.MockTransport(handler)
        client = RunpodOcrClient(
            "https://test/ocr", retries=2, client=httpx.Client(transport=transport)
        )

        with pytest.raises(OcrExecutionError, match="timed out"):
            client.extract_text_from_image_bytes(b"data")
        assert call_count == 3

    def test_request_error_with_retries(self):
        call_count = 0

        def handler(request):
            nonlocal call_count
            call_count += 1
            raise httpx.ConnectError("refused", request=request)

        transport = httpx.MockTransport(handler)
        client = RunpodOcrClient(
            "https://test/ocr", retries=1, client=httpx.Client(transport=transport)
        )

        with pytest.raises(OcrExecutionError, match="request failed"):
            client.extract_text_from_image_bytes(b"data")
        assert call_count == 2

    def test_retry_on_server_error(self):
        call_count = 0

        def handler(request):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                return httpx.Response(502, text="bad gateway")
            return httpx.Response(200, json={"text": "success"})

        transport = httpx.MockTransport(handler)
        client = RunpodOcrClient(
            "https://test/ocr", retries=2, client=httpx.Client(transport=transport)
        )

        result = client.extract_text_from_image_bytes(b"data")
        assert result == "success"
        assert call_count == 3

    def test_http_status_error_no_retry_on_4xx(self):
        def handler(request):
            return httpx.Response(400, text="bad request")

        transport = httpx.MockTransport(handler)
        client = RunpodOcrClient(
            "https://test/ocr", retries=2, client=httpx.Client(transport=transport)
        )

        with pytest.raises(OcrExecutionError, match="400"):
            client.extract_text_from_image_bytes(b"data")

    def test_make_runpod_ocr_client_model_mismatch(self):
        with pytest.raises(ValueError, match="has model"):
            make_runpod_ocr_client(
                "deepseek-ocr",
                {
                    "deepseek-ocr": RunpodOcrEndpointConfig(
                        model="olm-ocr2",
                        endpoint_url="https://test/ocr",
                    ),
                },
            )

    def test_extract_text_from_runpod_image_bytes_helper(self):
        def handler(request):
            return httpx.Response(200, json={"text": "hello"})

        with patch(
            "pdf_ocr_utils.ocr.runpod.RunpodOcrClient",
            return_value=RunpodOcrClient(
                "https://test/ocr",
                client=httpx.Client(transport=httpx.MockTransport(handler)),
            ),
        ):
            result = extract_text_from_runpod_image_bytes(b"data", endpoint_url="https://test/ocr")
            assert result == "hello"

    def test_extract_text_from_runpod_image_bytes_error(self):
        with patch("pdf_ocr_utils.ocr.runpod.RunpodOcrClient") as mock_client_cls:
            mock_client = mock_client_cls.return_value.__enter__.return_value
            mock_client.extract_text_from_image_bytes.side_effect = OcrExecutionError("fail")

            with pytest.raises(OcrExecutionError, match="fail"):
                extract_text_from_runpod_image_bytes(b"data", endpoint_url="https://test/ocr")
