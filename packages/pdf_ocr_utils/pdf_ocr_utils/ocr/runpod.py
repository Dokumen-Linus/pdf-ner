from collections.abc import Mapping
from dataclasses import dataclass
import time
from typing import Any, Literal

import httpx

from pdf_ocr_utils.exceptions import OcrExecutionError
from pdf_ocr_utils.types import ImageBytes

RemoteOcrModel = Literal["deepseek-ocr", "olm-ocr2"]
SUPPORTED_REMOTE_OCR_MODELS: tuple[RemoteOcrModel, ...] = ("deepseek-ocr", "olm-ocr2")


@dataclass(frozen=True, slots=True)
class RunpodOcrEndpointConfig:
    model: RemoteOcrModel
    endpoint_url: str | None
    api_key: str | None = None
    timeout: float | httpx.Timeout = 60.0
    retries: int = 0
    extra_headers: Mapping[str, str] | None = None


class RunpodOcrClient:
    def __init__(
        self,
        endpoint_url: str,
        api_key: str | None = None,
        timeout: float | httpx.Timeout = 60.0,
        retries: int = 0,
        extra_headers: Mapping[str, str] | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        if not endpoint_url:
            raise ValueError("endpoint_url is required")
        if retries < 0:
            raise ValueError("retries must be greater than or equal to 0")

        self.endpoint_url = endpoint_url
        self.api_key = api_key
        self.timeout = timeout
        self.retries = retries
        self.extra_headers = dict(extra_headers or {})
        self._client = client or httpx.Client(timeout=timeout)
        self._owns_client = client is None

    def extract_text_from_image_bytes(self, image: ImageBytes) -> str:
        if not isinstance(image, bytes):
            raise TypeError("image must be bytes")
        if not image:
            raise ValueError("image must not be empty")

        response = self._post_png(image)
        payload = self._parse_json(response)
        text = payload.get("text")
        if not isinstance(text, str):
            raise OcrExecutionError("OCR endpoint response is missing string field 'text'")

        return text

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> "RunpodOcrClient":
        return self

    def __exit__(self, exc_type: object, exc_val: object, exc_tb: object) -> None:
        self.close()

    def _post_png(self, image: bytes) -> httpx.Response:
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                response = self._client.post(
                    self.endpoint_url,
                    content=image,
                    headers=self._headers(),
                    timeout=self.timeout,
                )
                if response.status_code >= 500 and attempt < self.retries:
                    self._sleep_before_retry(attempt)
                    continue

                response.raise_for_status()
                return response
            except httpx.HTTPStatusError as exc:
                raise OcrExecutionError(
                    "OCR endpoint returned "
                    f"{exc.response.status_code}: {self._response_excerpt(exc.response)}"
                ) from exc
            except httpx.TimeoutException as exc:
                last_error = exc
                if attempt < self.retries:
                    self._sleep_before_retry(attempt)
                    continue
                raise OcrExecutionError("OCR endpoint request timed out") from exc
            except httpx.RequestError as exc:
                last_error = exc
                if attempt < self.retries:
                    self._sleep_before_retry(attempt)
                    continue
                raise OcrExecutionError(f"OCR endpoint request failed: {exc}") from exc

        raise OcrExecutionError(f"OCR endpoint request failed: {last_error}")

    def _headers(self) -> dict[str, str]:
        headers = dict(self.extra_headers)
        headers["Accept"] = "application/json"
        headers["Content-Type"] = "image/png"
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    @staticmethod
    def _parse_json(response: httpx.Response) -> dict[str, Any]:
        try:
            payload = response.json()
        except ValueError as exc:
            raise OcrExecutionError("OCR endpoint response is not valid JSON") from exc

        if not isinstance(payload, dict):
            raise OcrExecutionError("OCR endpoint response must be a JSON object")

        return payload

    @staticmethod
    def _response_excerpt(response: httpx.Response, limit: int = 500) -> str:
        return response.text[:limit]

    @staticmethod
    def _sleep_before_retry(attempt: int) -> None:
        time.sleep(min(0.25 * (2**attempt), 2.0))


def make_runpod_ocr_client(
    model: str,
    endpoint_configs: Mapping[str, RunpodOcrEndpointConfig],
    *,
    client: httpx.Client | None = None,
) -> RunpodOcrClient:
    if model not in SUPPORTED_REMOTE_OCR_MODELS:
        supported = ", ".join(SUPPORTED_REMOTE_OCR_MODELS)
        raise ValueError(f"Unsupported remote OCR model '{model}'. Expected one of: {supported}")

    endpoint_config = endpoint_configs.get(model)
    if endpoint_config is None or not endpoint_config.endpoint_url:
        raise ValueError(f"Missing Runpod OCR endpoint URL for model '{model}'")
    if endpoint_config.model != model:
        raise ValueError(
            f"Runpod OCR endpoint config for '{model}' has model '{endpoint_config.model}'"
        )

    return RunpodOcrClient(
        endpoint_url=endpoint_config.endpoint_url,
        api_key=endpoint_config.api_key,
        timeout=endpoint_config.timeout,
        retries=endpoint_config.retries,
        extra_headers=endpoint_config.extra_headers,
        client=client,
    )


def extract_text_from_runpod_image_bytes(
    image: ImageBytes,
    *,
    endpoint_url: str,
    api_key: str | None = None,
    timeout: float | httpx.Timeout = 60.0,
    retries: int = 0,
    extra_headers: Mapping[str, str] | None = None,
) -> str:
    with RunpodOcrClient(
        endpoint_url=endpoint_url,
        api_key=api_key,
        timeout=timeout,
        retries=retries,
        extra_headers=extra_headers,
    ) as client:
        return client.extract_text_from_image_bytes(image)
