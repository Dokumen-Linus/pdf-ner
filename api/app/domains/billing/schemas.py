from uuid import UUID

from pydantic import BaseModel


class UsageByModel(BaseModel):
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_usd: float
    call_count: int


class DailyUsage(BaseModel):
    date: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    call_count: int


class UsageSummary(BaseModel):
    period_days: int
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    total_cost_usd: float
    call_count: int
    by_model: list[UsageByModel]
    by_day: list[DailyUsage]


class StripeCustomerResponse(BaseModel):
    stripe_customer_id: str
    stripe_subscription_id: str | None
    has_active_subscription: bool


class CreateCustomerRequest(BaseModel):
    user_id: UUID
    email: str
    name: str | None = None


class CreateSubscriptionRequest(BaseModel):
    user_id: UUID
    price_id: str


class CancelSubscriptionRequest(BaseModel):
    user_id: UUID
