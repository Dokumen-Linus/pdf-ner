from enum import Enum
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    ENV: Environment = Environment.DEVELOPMENT
    APP_VERSION: str = "0.0.0"

    REDIS_URL: str
    WORKERS_DATABASE_URL: str

    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str
    GOOGLE_AI_API_KEY: str

    STRIPE_SECRET_KEY: str

    OCR_MODEL: str = "deepseek-ocr"
    DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL: str | None = None
    OLM_OCR2_RUNPOD_ENDPOINT_URL: str | None = None
    RUNPOD_API_KEY: str | None = None
    OCR_RUNPOD_TIMEOUT_SECONDS: float = 60.0
    OCR_RUNPOD_RETRIES: int = 0

    @property
    def CELERY_BROKER_URL(self) -> str:
        return self.REDIS_URL

    @property
    def CELERY_RESULT_BACKEND(self) -> str:
        return self.REDIS_URL

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
    return Settings()


settings = get_settings()
