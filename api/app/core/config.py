from enum import Enum
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    ENV: Environment = Environment.DEVELOPMENT

    API_DATABASE_URL: str
    REDIS_URL: str
    API_KEY: str
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    ALLOWED_HOSTS: list[str] = ["localhost", "127.0.0.1"]

    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str
    GOOGLE_AI_API_KEY: str

    STRIPE_SECRET_KEY: str

    AVATARS_BUCKET: str
    AVATARS_AWS_ACCESS_KEY_ID: str
    AVATARS_AWS_SECRET_ACCESS_KEY: str
    AVATARS_AWS_REGION: str = "us-east-1"
    AVATARS_AWS_ENDPOINT_URL: str | None = None

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
