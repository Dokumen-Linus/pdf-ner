import base64
from collections.abc import Callable
from io import BytesIO
import re

from fastapi import HTTPException, Request, status
from PIL import Image, UnidentifiedImageError


async def read_png_image(
    request: Request,
    transform: Callable[[Image.Image], Image.Image] | None = None,
) -> Image.Image:
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type != "image/png":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Expected Content-Type: image/png",
        )

    body = await request.body()
    if not body:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request body must contain PNG image bytes",
        )

    try:
        with Image.open(BytesIO(body)) as image:
            prepared = image.convert("RGB")
            if transform is not None:
                prepared = transform(prepared)
            return prepared
    except (OSError, UnidentifiedImageError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request body is not a valid PNG image",
        ) from exc


def resize_longest_dimension(image: Image.Image, target_longest_dimension: int) -> Image.Image:
    longest = max(image.size)
    if longest <= target_longest_dimension:
        return image

    scale = target_longest_dimension / longest
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def image_to_base64_png(image: Image.Image) -> str:
    output = BytesIO()
    image.save(output, format="PNG")
    return base64.b64encode(output.getvalue()).decode("utf-8")


def split_yaml_front_matter(text: str) -> tuple[dict[str, str], str]:
    match = re.match(r"^---\s*\n(?P<metadata>.*?)\n---\s*\n(?P<body>.*)$", text.strip(), re.S)
    if not match:
        return {}, text

    metadata: dict[str, str] = {}
    for line in match.group("metadata").splitlines():
        key, separator, value = line.partition(":")
        if separator:
            metadata[key.strip()] = value.strip()

    return metadata, match.group("body")
