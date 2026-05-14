from app.core.config import Settings


def test_ocr_settings_have_safe_defaults(monkeypatch):
    monkeypatch.delenv("SECRETS_STAGE", raising=False)
    monkeypatch.delenv("OCR_MODEL", raising=False)
    monkeypatch.delenv("DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL", raising=False)
    monkeypatch.delenv("OLM_OCR2_RUNPOD_ENDPOINT_URL", raising=False)
    monkeypatch.delenv("OCR_RUNPOD_HTTP_TOKEN", raising=False)
    monkeypatch.delenv("OCR_RUNPOD_TIMEOUT_SECONDS", raising=False)
    monkeypatch.delenv("OCR_RUNPOD_RETRIES", raising=False)

    settings = Settings()

    assert settings.OCR_MODEL == "deepseek-ocr"
    assert settings.DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL is None
    assert settings.OLM_OCR2_RUNPOD_ENDPOINT_URL is None
    assert settings.OCR_RUNPOD_HTTP_TOKEN is None
    assert settings.OCR_RUNPOD_TIMEOUT_SECONDS == 60.0
    assert settings.OCR_RUNPOD_RETRIES == 0


def test_ocr_settings_read_env_vars(monkeypatch):
    monkeypatch.delenv("SECRETS_STAGE", raising=False)
    monkeypatch.setenv("OCR_MODEL", "olm-ocr2")
    monkeypatch.setenv("DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL", "https://deepseek.test/ocr")
    monkeypatch.setenv("OLM_OCR2_RUNPOD_ENDPOINT_URL", "https://olm.test/ocr")
    monkeypatch.setenv("OCR_RUNPOD_HTTP_TOKEN", "test-key")
    monkeypatch.setenv("OCR_RUNPOD_TIMEOUT_SECONDS", "12.5")
    monkeypatch.setenv("OCR_RUNPOD_RETRIES", "2")

    settings = Settings()

    assert settings.OCR_MODEL == "olm-ocr2"
    assert settings.DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL == "https://deepseek.test/ocr"
    assert settings.OLM_OCR2_RUNPOD_ENDPOINT_URL == "https://olm.test/ocr"
    assert settings.OCR_RUNPOD_HTTP_TOKEN == "test-key"
    assert settings.OCR_RUNPOD_TIMEOUT_SECONDS == 12.5
    assert settings.OCR_RUNPOD_RETRIES == 2
