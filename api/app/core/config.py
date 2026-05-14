from enum import Enum
from functools import lru_cache

from dokumen_aws_secrets import load_stage_groups
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    ENV: Environment = Environment.DEVELOPMENT
    APP_VERSION: str = "0.0.0"

    API_DATABASE_URL: str
    REDIS_URL: str
    API_KEY: str
    HEALTHCHECK_TOKEN: str | None = None
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    ALLOWED_HOSTS: list[str] = ["localhost", "127.0.0.1"]

    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str
    GOOGLE_AI_API_KEY: str

    AVATARS_S3_BUCKET_NAME: str
    AVATARS_AWS_REGION: str = "us-east-1"
    AVATARS_AWS_ENDPOINT_URL: str | None = None

    OCR_MODEL: str = "deepseek-ocr"
    DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL: str | None = None
    OLM_OCR2_RUNPOD_ENDPOINT_URL: str | None = None
    OCR_RUNPOD_HTTP_TOKEN: str | None = None
    OCR_RUNPOD_TIMEOUT_SECONDS: float = 60.0
    OCR_RUNPOD_RETRIES: int = 0

    model_config = SettingsConfigDict(
        frozen=True,
        env_file=".env",
        extra="ignore",
    )

    @property
    def is_production(self) -> bool:
        return self.ENV is Environment.PRODUCTION


@lru_cache
def get_settings() -> Settings:
    secret_values = load_stage_groups(groups=["api", "runpod"])
    return Settings(**secret_values)


settings = get_settings()
