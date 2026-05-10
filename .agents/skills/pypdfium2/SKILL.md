---
name: pypdfium2
description: Use when planning or writing Python code with pypdfium2, PDFium-backed rendering, PDF text extraction, text search, annotations/highlighting, page metadata, bookmarks/TOC, or raw PDFium helper APIs.
---

# pypdfium2

Use this skill for Python PDF work backed by pypdfium2/PDFium.

## Repo Defaults

- For text search, rectangle drawing, and phrase highlighting, prefer the production helpers in `packages/pdfium_utils` before adapting snippets from this skill.
- For rendering pages to arrays or PNG bytes, prefer the existing pattern in `packages/pdf_ocr_utils/pdf_ocr_utils/renderers/pdfium.py`.
- For worker-facing reexports, check `workers/app/shared/infrastructure/pdfium.py` before introducing a second import surface.
- Treat `examples.py` as broader reference snippets, not production-quality code.

## Workflow

1. Search the repo for an existing helper before adding new pypdfium2 code.
2. Read `docs.md` when you need API details for documents, pages, text pages, rendering, page objects, or raw PDFium access.
3. Read `examples.py` only when the existing repo helpers do not cover the shape you need.
4. Keep pypdfium2 objects short-lived. Prefer `with pypdfium2.PdfDocument(...) as pdf:` where supported, or call `pdf.close()` in a `finally`.
5. After inserting, removing, or changing page objects, call `page.gen_content()` before saving.

## Safety Notes

- PDFium is not thread-safe. Do not call PDFium concurrently from multiple threads, even on different documents. Use process-level parallelism for expensive rendering, or guard all PDFium calls with a mutex.
- Closed helper objects must not be reused. Do not detach raw handles from their wrappers.
- Raw PDFium APIs under `pypdfium2.raw` use ctypes-level ownership rules; prefer support-model helpers unless the repo has no suitable helper.
- pypdfium2 can load from paths, bytes, byte streams, ctypes arrays, or raw document handles. Choose bytes for in-memory pipelines and paths for file-based utility scripts.
