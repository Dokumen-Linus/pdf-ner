import json

from app.core import config


class FakeSecretsClient:
    def get_secret_value(self, *, SecretId: str):
        payloads = {
            "prod/api": {
                "SecretString": json.dumps(
                    {
                        "API_DATABASE_URL": "postgres://api-secret/db",
                        "REDIS_URL": "redis://api-secret/0",
                        "API_KEY": "api-secret",
                        "CORS_ORIGINS": ["https://app.example"],
                        "ALLOWED_HOSTS": ["app.example"],
                        "ANTHROPIC_API_KEY": "anthropic-secret",
                        "OPENAI_API_KEY": "openai-secret",
                        "GOOGLE_AI_API_KEY": "google-secret",
                        "AVATARS_S3_BUCKET_NAME": "avatars-secret",
                        "AVATARS_AWS_ACCESS_KEY_ID": "avatar-key",
                        "AVATARS_AWS_SECRET_ACCESS_KEY": "avatar-secret",
                    }
                )
            },
            "prod/runpod": {
                "SecretString": json.dumps(
                    {
                        "OCR_MODEL": "olm-ocr2",
                        "RUNPOD_API_KEY": "runpod-secret",
                        "OCR_RUNPOD_TIMEOUT_SECONDS": 12.5,
                        "OCR_RUNPOD_RETRIES": 2,
                    }
                )
            },
        }
        return payloads[SecretId]


def test_api_settings_load_from_aws_secrets(monkeypatch):
    from dokumen_aws_secrets import config as secrets_config

    secrets_config._CACHE.clear()
    config.get_settings.cache_clear()
    monkeypatch.setenv("SECRETS_STAGE", "prod")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setattr(secrets_config, "_client", lambda region: FakeSecretsClient())

    settings = config.get_settings()

    assert settings.API_DATABASE_URL == "postgres://api-secret/db"
    assert settings.RUNPOD_API_KEY == "runpod-secret"
    assert settings.OCR_MODEL == "olm-ocr2"

    config.get_settings.cache_clear()
    secrets_config._CACHE.clear()
