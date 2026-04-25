class PdfOcrError(Exception):
    """Base exception for PDF OCR failures."""


class PdfRenderError(PdfOcrError):
    """Raised when a PDF page cannot be rendered to an image."""


class OcrExecutionError(PdfOcrError):
    """Raised when OCR execution fails."""
