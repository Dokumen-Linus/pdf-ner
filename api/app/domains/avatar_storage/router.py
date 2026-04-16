from urllib.parse import unquote

from fastapi import APIRouter, HTTPException, Request

from app.domains.avatar_storage import service

router = APIRouter(prefix="/avatar-storage", tags=["avatar_storage"])

_MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2 MB
_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.post("/avatars")
async def upload_avatar(request: Request):
    """Upload a profile image to the avatars S3 bucket.

    Credentials come from env vars (AVATARS_*). No DB interaction.

    Contract:
      * header  Content-Type : image/jpeg | image/png | image/webp | image/gif
      * header  X-Filename   : url-encoded original filename (optional)
      * body    raw image bytes (not multipart)
    """
    content_type = (request.headers.get("content-type") or "").split(";")[0].strip().lower()
    if content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Content-Type must be image/jpeg, image/png, image/webp, or image/gif",
        )

    cl_header = request.headers.get("content-length")
    if cl_header is not None:
        try:
            if int(cl_header) > _MAX_AVATAR_SIZE:
                raise HTTPException(status_code=413, detail="Image exceeds 2 MB limit")
        except ValueError:
            pass

    raw_filename = request.headers.get("x-filename") or "avatar.jpg"
    filename = unquote(raw_filename)

    data = await request.body()
    if len(data) > _MAX_AVATAR_SIZE:
        raise HTTPException(status_code=413, detail="Image exceeds 2 MB limit")

    return await service.upload_avatar(filename, content_type, data)
