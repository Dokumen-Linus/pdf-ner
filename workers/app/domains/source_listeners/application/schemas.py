from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.domains.source_watchers.application.schemas import MaterializedDocumentPayload


class ListenerProvisioningPayload(BaseModel):
    provider_subscription_id: str | None = None
    callback_url: str | None = None
    secret_ref: str | None = None
    expires_at: datetime | None = None
    renew_after: datetime | None = None
    provider_payload: dict = Field(default_factory=dict)


class ListenerEventPayload(BaseModel):
    listener_subscription_id: UUID
    documents: list[MaterializedDocumentPayload] = Field(default_factory=list)
    raw_event: dict = Field(default_factory=dict)
