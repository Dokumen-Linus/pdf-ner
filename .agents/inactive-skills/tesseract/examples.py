"""Reference-only pytesseract examples.

These snippets cover the pytesseract Python API surface for OCR tasks.
They are not the production source of truth. Prefer existing repo helpers
and adapt these examples only when the helper package does not cover the task.
"""

import logging
from pathlib import Path

from PIL import Image

import pytesseract


# ---------------------------------------------------------------------------
# Basic text extraction
# ---------------------------------------------------------------------------


def image_to_text(image_path: str, lang: str = "eng") -> str | None:
    """Extract plain text from an image using Tesseract OCR."""
    try:
        text = pytesseract.image_to_string(Image.open(image_path), lang=lang)
        logging.info(f"Extracted text from {image_path}")
        return text
    except Exception as e:
        logging.error(f"Error extracting text from {image_path}: {e}")
        return None


def image_to_text_with_config(image_path: str) -> str | None:
    """Extract text with custom OEM and PSM configuration.

    --oem 3 : Default, based on what is available
    --psm 6 : Assume a single uniform block of text
    """
    try:
        custom_config = r"--oem 3 --psm 6"
        text = pytesseract.image_to_string(Image.open(image_path), config=custom_config)
        logging.info(f"Extracted text from {image_path} with custom config")
        return text
    except Exception as e:
        logging.error(f"Error extracting text from {image_path}: {e}")
        return None


def image_to_text_multilang(image_path: str, langs: str = "eng+fra") -> str | None:
    """Extract text using multiple languages simultaneously.

    lang codes are joined with '+', e.g. 'eng+fra+deu'.
    """
    try:
        text = pytesseract.image_to_string(Image.open(image_path), lang=langs)
        logging.info(f"Extracted multilingual text from {image_path}")
        return text
    except Exception as e:
        logging.error(f"Error extracting multilingual text from {image_path}: {e}")
        return None


def image_to_text_with_timeout(image_path: str, timeout: int = 5) -> str | None:
    """Extract text with a timeout to prevent hanging on large/corrupt images."""
    try:
        text = pytesseract.image_to_string(image_path, timeout=timeout)
        logging.info(f"Extracted text from {image_path} within {timeout}s")
        return text
    except RuntimeError as timeout_error:
        logging.error(f"Tesseract timed out on {image_path}: {timeout_error}")
        return None
    except Exception as e:
        logging.error(f"Error extracting text from {image_path}: {e}")
        return None


# ---------------------------------------------------------------------------
# Bounding boxes and structured data
# ---------------------------------------------------------------------------


def image_to_boxes(image_path: str, lang: str = "eng") -> str | None:
    """Get character-level bounding boxes from an image.

    Returns one line per character with format:
        char left bottom right top page_num
    """
    try:
        boxes = pytesseract.image_to_boxes(Image.open(image_path), lang=lang)
        logging.info(f"Extracted character boxes from {image_path}")
        return boxes
    except Exception as e:
        logging.error(f"Error extracting boxes from {image_path}: {e}")
        return None


def image_to_data_string(image_path: str, lang: str = "eng") -> str | None:
    """Get verbose TSV data including boxes, confidences, line/page numbers.

    Requires Tesseract 3.05+. Returns tab-separated values with columns:
        level, page_num, block_num, par_num, line_num, word_num,
        left, top, width, height, conf, text
    """
    try:
        data = pytesseract.image_to_data(Image.open(image_path), lang=lang)
        logging.info(f"Extracted TSV data from {image_path}")
        return data
    except Exception as e:
        logging.error(f"Error extracting data from {image_path}: {e}")
        return None


def image_to_data_dataframe(image_path: str, lang: str = "eng"):
    """Get structured OCR data as a pandas DataFrame.

    Useful for filtering by confidence, grouping by line/block, etc.
    """
    try:
        import pandas as pd

        df = pytesseract.image_to_data(
            Image.open(image_path),
            lang=lang,
            output_type=pytesseract.Output.DATAFRAME,
        )
        # Filter out rows with no recognized text
        df = df[df["conf"] != -1]
        logging.info(f"Extracted DataFrame with {len(df)} words from {image_path}")
        return df
    except Exception as e:
        logging.error(f"Error extracting DataFrame from {image_path}: {e}")
        return None


def image_to_data_dict(image_path: str, lang: str = "eng") -> dict | None:
    """Get structured OCR data as a dict of lists (one key per column)."""
    try:
        data = pytesseract.image_to_data(
            Image.open(image_path),
            lang=lang,
            output_type=pytesseract.Output.DICT,
        )
        logging.info(f"Extracted dict data from {image_path}")
        return data
    except Exception as e:
        logging.error(f"Error extracting dict data from {image_path}: {e}")
        return None


# ---------------------------------------------------------------------------
# Orientation and script detection (OSD)
# ---------------------------------------------------------------------------


def detect_orientation(image_path: str) -> str | None:
    """Detect page orientation, script, and rotation angle.

    Returns information like:
        Page number: 0
        Orientation in degrees: 0
        Rotate: 0
        Orientation confidence: ...
        Script: Latin
        Script confidence: ...
    """
    try:
        osd = pytesseract.image_to_osd(Image.open(image_path))
        logging.info(f"Detected orientation for {image_path}")
        return osd
    except Exception as e:
        logging.error(f"Error detecting orientation in {image_path}: {e}")
        return None


# ---------------------------------------------------------------------------
# PDF and HOCR output
# ---------------------------------------------------------------------------


def image_to_searchable_pdf(image_path: str, output_path: str) -> None:
    """Create a searchable PDF from an image.

    The output PDF embeds the recognized text as an invisible text layer
    over the original image, making it searchable and copy-pasteable.
    """
    try:
        pdf_bytes = pytesseract.image_to_pdf_or_hocr(image_path, extension="pdf")
        Path(output_path).write_bytes(pdf_bytes)
        logging.info(f"Created searchable PDF at {output_path}")
    except Exception as e:
        logging.error(f"Error creating searchable PDF from {image_path}: {e}")
        raise


def image_to_hocr(image_path: str) -> bytes | None:
    """Get HOCR (HTML-based OCR) output with word-level bounding boxes.

    HOCR embeds positional metadata in HTML span elements, useful for
    document reconstruction or overlay rendering.
    """
    try:
        hocr = pytesseract.image_to_pdf_or_hocr(image_path, extension="hocr")
        logging.info(f"Extracted HOCR from {image_path}")
        return hocr
    except Exception as e:
        logging.error(f"Error extracting HOCR from {image_path}: {e}")
        return None


def image_to_alto_xml(image_path: str) -> bytes | None:
    """Get ALTO XML output (Analyzed Layout and Text Object).

    ALTO is a standardized XML schema for OCR output used in digital
    libraries and document archives.
    """
    try:
        xml = pytesseract.image_to_alto_xml(image_path)
        logging.info(f"Extracted ALTO XML from {image_path}")
        return xml
    except Exception as e:
        logging.error(f"Error extracting ALTO XML from {image_path}: {e}")
        return None


# ---------------------------------------------------------------------------
# Multiple output formats in one call
# ---------------------------------------------------------------------------


def get_multiple_outputs(image_path: str) -> tuple | None:
    """Get text and bounding boxes in a single Tesseract invocation.

    Saves compute time by only calling the Tesseract binary once.
    Supported extensions: 'txt', 'pdf', 'hocr', 'box', 'tsv'.
    """
    try:
        text, boxes = pytesseract.run_and_get_multiple_output(image_path, extensions=["txt", "box"])
        logging.info(f"Extracted multiple outputs from {image_path}")
        return text, boxes
    except Exception as e:
        logging.error(f"Error extracting multiple outputs from {image_path}: {e}")
        return None


# ---------------------------------------------------------------------------
# OpenCV integration
# ---------------------------------------------------------------------------


def ocr_from_opencv_image(image_path: str) -> str | None:
    """Extract text from an image loaded with OpenCV.

    OpenCV loads images in BGR format, but pytesseract expects RGB.
    Always convert before passing to pytesseract.
    """
    try:
        import cv2

        img_bgr = cv2.imread(image_path)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        text = pytesseract.image_to_string(img_rgb)
        logging.info(f"Extracted text from OpenCV image {image_path}")
        return text
    except Exception as e:
        logging.error(f"Error with OpenCV OCR on {image_path}: {e}")
        return None


# ---------------------------------------------------------------------------
# Preprocessing for better OCR quality
# ---------------------------------------------------------------------------


def ocr_with_preprocessing(image_path: str) -> str | None:
    """Apply common preprocessing steps before OCR for improved accuracy.

    Steps: grayscale → threshold → OCR with single-block PSM.
    """
    try:
        import cv2

        img = cv2.imread(image_path)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Apply Otsu's binarization
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        # Convert to PIL for pytesseract
        pil_img = Image.fromarray(thresh)
        text = pytesseract.image_to_string(pil_img, config="--psm 6")
        logging.info(f"Extracted text with preprocessing from {image_path}")
        return text
    except Exception as e:
        logging.error(f"Error with preprocessed OCR on {image_path}: {e}")
        return None


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------


def get_available_languages() -> list[str]:
    """Return list of languages Tesseract has traineddata files for."""
    return pytesseract.get_languages(config="")


def get_tesseract_version() -> str:
    """Return the installed Tesseract version string."""
    return pytesseract.get_tesseract_version()


def set_tesseract_path(path: str) -> None:
    """Set the path to the Tesseract executable if not in PATH.

    Example: set_tesseract_path(r'/usr/local/bin/tesseract')
    """
    pytesseract.pytesseract.tesseract_cmd = path
