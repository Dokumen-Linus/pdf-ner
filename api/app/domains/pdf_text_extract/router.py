"""Router for PDF text extraction endpoints."""

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, status

from .schemas import (
    BookmarksResponse,
    HighlightPhrasesRequest,
    HighlightPhrasesResponse,
    SearchTextRequest,
    SearchTextResponse,
)
from .service import (
    extract_bookmarks_from_pdf,
    highlight_phrases_in_pdf,
    search_text_in_pdf,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pdf-text-extract", tags=["pdf-text-extract"])


@router.get("/bookmarks", response_model=BookmarksResponse)
async def get_bookmarks(pdf_path: str) -> BookmarksResponse:
    """
    Extract bookmarks from a PDF file.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        BookmarksResponse containing all bookmarks with their page numbers and hierarchy
        
    Raises:
        404: If PDF file not found
        500: If PDF processing fails
    """
    try:
        result = extract_bookmarks_from_pdf(pdf_path)
        return result
        
    except FileNotFoundError as e:
        logger.error(f"PDF file not found: {pdf_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error processing PDF {pdf_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract bookmarks: {str(e)}",
        )


@router.post("/search-text", response_model=SearchTextResponse)
async def search_text(request: SearchTextRequest) -> SearchTextResponse:
    """
    Search for text in a PDF file. Returns early if found on first page.
    
    Args:
        request: SearchTextRequest with pdf_path and search_text
        
    Returns:
        SearchTextResponse indicating if text was found and on which page
        
    Raises:
        404: If PDF file not found
        500: If PDF processing fails
    """
    try:
        result = search_text_in_pdf(request.pdf_path, request.search_text)
        return result
        
    except FileNotFoundError as e:
        logger.error(f"PDF file not found: {request.pdf_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error searching text in PDF {request.pdf_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search text: {str(e)}",
        )


@router.post("/highlight-phrases", response_model=HighlightPhrasesResponse)
async def highlight_phrases(request: HighlightPhrasesRequest) -> HighlightPhrasesResponse:
    """
    Highlight multiple phrases in a PDF and save to a new file.
    
    Args:
        request: HighlightPhrasesRequest with pdf_path, phrases list, and optional output_path
        
    Returns:
        HighlightPhrasesResponse with results for each phrase and output file location
        
    Raises:
        404: If PDF file not found
        500: If PDF processing fails
    """
    try:
        result = highlight_phrases_in_pdf(
            request.pdf_path,
            request.phrases,
            request.output_path,
        )
        
        return HighlightPhrasesResponse(**result)
        
    except FileNotFoundError as e:
        logger.error(f"PDF file not found: {request.pdf_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error highlighting phrases in PDF {request.pdf_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to highlight phrases: {str(e)}",
        )
