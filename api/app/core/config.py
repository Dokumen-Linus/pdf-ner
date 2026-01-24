from enum import Enum
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    ENV: Environment = Environment.DEVELOPMENT

    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str
    GOOGLE_AI_API_KEY: str

    API_DATABASE_URL: str
    S3_BUCKET: str

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
