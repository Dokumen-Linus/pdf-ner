### example setting up auth for an external API with PAT

# from fastapi import HTTPException, status

# from .config import get_settings


# def get_api_auth_headers():
#     settings = get_settings()

#     if not settings.api_pat:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="API credentials not configured",
#         )

#     return {
#         "Authorization": f"Bearer {settings.api_pat}",
#         "Content-Type": "application/json",
#     }
