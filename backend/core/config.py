from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    API_DATABASE_URL: str
    S3_BUCKET: str

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
