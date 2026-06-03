from pydantic import BaseModel, Field, field_validator

ACCOUNT_TYPES = {"individual", "organization"}


class AccountRequest(BaseModel):
    account_type: str = Field(min_length=1)
    account_id: str = Field(min_length=1)

    @field_validator("account_type")
    @classmethod
    def validate_account_type(cls, value: str) -> str:
        if value not in ACCOUNT_TYPES:
            raise ValueError("account_type must be individual or organization")
        return value


class DirectPaymentRequest(AccountRequest):
    amount_cents: int = Field(default=100, ge=50, le=50000)


class CurrentCycleRequest(AccountRequest):
    pass


class DueAccountsRequest(BaseModel):
    limit: int = Field(default=100, ge=1, le=500)
