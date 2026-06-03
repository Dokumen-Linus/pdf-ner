---
name: tesseract
description: Use when planning or writing Python code with pytesseract for OCR, image-to-text extraction, bounding box detection, orientation/script detection, searchable PDF generation, HOCR/ALTO XML output, or Tesseract engine configuration (OEM/PSM modes).
---

# pytesseract / Tesseract OCR

Use this skill for Python OCR work backed by pytesseract (the Python wrapper around Google's Tesseract OCR engine).

## Repo Defaults

- For OCR rendering of PDF pages to images before pytesseract, prefer the existing pattern in `packages/pdf_ocr_utils/pdf_ocr_utils/renderers/pdfium.py`.
- Treat `examples.py` as broader reference snippets, not production-quality code.

## Workflow

1. Search the repo for an existing OCR helper before adding new pytesseract code.
2. Read `docs.md` when you need details on Tesseract engine modes, page segmentation modes, output formats, configuration flags, image preprocessing tips, or the pytesseract Python API.
3. Read `examples.py` only when the existing repo helpers do not cover the shape you need.
4. Always pass images as PIL `Image` objects or file paths. If using OpenCV, convert BGR → RGB before passing to pytesseract.
5. Use the `config` parameter to pass Tesseract flags like `--oem` and `--psm` rather than environment variables.

## Key Concepts

### OCR Engine Modes (OEM)

| Value | Mode |
|-------|------|
| 0 | Legacy Tesseract only |
| 1 | LSTM neural net only (default) |
| 2 | Legacy + LSTM |
| 3 | Default, based on what is available |

### Page Segmentation Modes (PSM)

| Value | Mode |
|-------|------|
| 0 | Orientation and script detection (OSD) only |
| 1 | Automatic page segmentation with OSD |
| 2 | Automatic page segmentation, no OSD or OCR |
| 3 | Fully automatic page segmentation, no OSD (default) |
| 4 | Assume a single column of text of variable sizes |
| 5 | Assume a single uniform block of vertically aligned text |
| 6 | Assume a single uniform block of text |
| 7 | Treat the image as a single text line |
| 8 | Treat the image as a single word |
| 9 | Treat the image as a single word in a circle |
| 10 | Treat the image as a single character |
| 11 | Sparse text. Find as much text as possible in no particular order |
| 12 | Sparse text with OSD |
| 13 | Raw line. Treat the image as a single text line, bypassing hacks specific to a Tesseract page |

## Safety Notes

- Tesseract requires the `tesseract` binary installed on the system. In Docker, install via `apt-get install tesseract-ocr`. On macOS, use `brew install tesseract`.
- Language data files (`.traineddata`) must be present in the tessdata directory. Set `TESSDATA_PREFIX` or pass `--tessdata-dir` in config.
- pytesseract shells out to the `tesseract` CLI under the hood — it is **not** thread-safe for the same process. Guard concurrent calls or use process-level parallelism.
- For best OCR accuracy, ensure input images are at least 300 DPI. Pre-process with binarization, deskewing, and noise removal when quality is poor.
- Use `timeout` parameter to prevent pytesseract from hanging on corrupt or very large images.

## Quick Reference Links

- [pytesseract GitHub](https://github.com/madmaze/pytesseract)
- [Tesseract User Manual](https://tesseract-ocr.github.io/tessdoc/)
- [Tesseract CLI Usage](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html)
- [Improving OCR Quality](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html)
- [Tesseract TSV Output](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html)
