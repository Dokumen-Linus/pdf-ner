from dataclasses import dataclass
from pathlib import Path
from typing import Any

type PdfSource = str | Path
type ImageArray = Any
type ImageBytes = bytes


@dataclass(slots=True)
class RenderConfig:
    scale: float = 2.0
    grayscale: bool = False
    rev_byteorder: bool = True


@dataclass(slots=True)
class OcrConfig:
    lang: str = "eng"
    config: str = "--oem 3 --psm 6"
    timeout: float | None = None


@dataclass(slots=True)
class PageTextResult:
    page_index: int
    text: str
