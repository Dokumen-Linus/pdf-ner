"""Schemas for PDF text extraction domain."""

from pydantic import BaseModel, Field


class BookmarkItem(BaseModel):
    """Single bookmark entry."""
    title: str
    page: int
    level: int
    count: int = Field(description="Number of children (-1 if no children)")


class BookmarksResponse(BaseModel):
    """Response containing PDF bookmarks."""
    pdf_path: str
    bookmarks: list[BookmarkItem]
    total_count: int


class SearchTextRequest(BaseModel):
    """Request to search for text in a PDF."""
    pdf_path: str
    search_text: str


class SearchTextResponse(BaseModel):
    """Response indicating if text was found."""
    pdf_path: str
    search_text: str
    found: bool
    page_found: int | None = Field(None, description="Page number where text was found (if found)")
    message: str


class HighlightPhrasesRequest(BaseModel):
    """Request to highlight phrases in a PDF."""
    pdf_path: str
    phrases: list[str] = Field(min_length=1, description="List of phrases to highlight")
    output_path: str | None = Field(None, description="Output path for highlighted PDF. If not provided, will generate one.")


class PhraseHighlightResult(BaseModel):
    """Result for a single phrase highlight attempt."""
    phrase: str
    found: bool
    occurrences: int = 0
    pages: list[int] = Field(default_factory=list, description="Pages where phrase was found")


class HighlightPhrasesResponse(BaseModel):
    """Response containing highlight results."""
    pdf_path: str
    output_path: str
    total_phrases: int
    successfully_highlighted: int
    results: list[PhraseHighlightResult]
