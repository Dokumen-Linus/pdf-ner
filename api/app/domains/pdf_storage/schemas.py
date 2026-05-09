import re

from pydantic import BaseModel, Field, field_validator


class CreateBucketRequest(BaseModel):
    name: str = Field(min_length=1)
    region: str = "us-east-1"
    endpoint_url: str | None = None

    @field_validator("endpoint_url")
    @classmethod
    def validate_endpoint_url(cls, v: str | None) -> str | None:
        if v is None:
            return v
        allowed = [
            r"^https?://localhost(:\d+)?(/.*)?$",
            r"^https?://127\.0\.0\.1(:\d+)?(/.*)?$",
            r"^https://[\w.-]+\.amazonaws\.com(/.*)?$",
        ]
        if not any(re.match(p, v) for p in allowed):
            raise ValueError("endpoint_url must be localhost, 127.0.0.1, or *.amazonaws.com")
        return v


class UploadPdfResponse(BaseModel):
    pdf_id: str
    filepath: str
    bucket_name: str
