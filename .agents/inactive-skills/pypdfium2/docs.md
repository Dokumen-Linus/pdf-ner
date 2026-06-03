# pypdfium2 Reference

Sources:

- https://pypdfium2.readthedocs.io/en/v4/python_api.html
- https://pypdfium2.readthedocs.io/en/stable/readme.html

pypdfium2 is an ABI-level Python binding to PDFium for PDF rendering, inspection, manipulation, and creation. It exposes both Python helper classes and the raw PDFium ctypes API.

## Installation

```bash
python -m pip install -U pypdfium2
```

PyPI wheels usually bundle the needed PDFium binary. If a wheel is unavailable for the platform, setup may search for system PDFium or attempt a source build.

For JavaScript/XFA-enabled PDFium builds:

```bash
PDFIUM_PLATFORM=auto-v8 pip install -v pypdfium2 --no-binary pypdfium2
```

Optional runtime packages are loaded lazily when needed:

- `Pillow`: image adapters and some CLI image saving.
- `NumPy`: bitmap-to-array adapters.
- `opencv-python`: rendering CLI image output.
- `tabulate`: prettier CLI tables.

## API Layers

pypdfium2 has three relevant layers:

- `pypdfium2`: support model helpers such as `PdfDocument`, `PdfPage`, `PdfTextPage`, and `PdfObject`.
- `pypdfium2.raw` or `pypdfium2_raw`: raw PDFium ctypes bindings.
- `pypdfium2.internal`: implementation utilities used by helpers.

Prefer the support model. It is safer and more Pythonic, though it covers only part of PDFium. Use raw APIs only when helpers do not expose the needed capability.

Helper objects expose `.raw` for the underlying ctypes handle and can often be passed directly to raw functions because wrappers resolve to their raw handle.

## Threading

PDFium is not thread-safe. Do not call PDFium functions simultaneously across multiple threads, even with different documents. If threaded code must use pypdfium2, guard all PDFium calls with a mutex. For expensive parallel work such as rendering, prefer processes.

## Memory Management

PDFium objects commonly own native resources and should be closed explicitly. Many pypdfium2 helper classes close on garbage collection, but explicit close is better for predictable file-handle and memory release.

Use context managers where available:

```python
import pypdfium2

with pypdfium2.PdfDocument("input.pdf") as pdf:
    page_count = len(pdf)
```

Or close in `finally`:

```python
pdf = pypdfium2.PdfDocument(pdf_bytes)
try:
    text = pdf[0].get_textpage().get_text_range()
finally:
    pdf.close()
```

Do not access helper objects after closing. Closing a parent object closes open children such as pages derived from a document. Do not detach raw handles from their wrappers.

## Document

`PdfDocument` loads an existing PDF or creates a new one.

```python
class PdfDocument:
    def __init__(
        self,
        input: str | Path | bytes | ctypes.Array | BinaryIO | FPDF_DOCUMENT,
        password: str | None = None,
        autoclose: bool = False,
    ): ...
```

Common operations:

```python
import pypdfium2

with pypdfium2.PdfDocument("input.pdf") as pdf:
    page_count = len(pdf)
    first_page = pdf[0]
    metadata = pdf.get_metadata_dict(skip_empty=True)
    pdf_version = pdf.get_version()
    page_size = pdf.get_page_size(0)
    label = pdf.get_page_label(0)
    toc_items = list(pdf.get_toc())
```

Useful methods:

- `PdfDocument.new() -> PdfDocument`: create an empty document.
- `len(pdf)`: page count.
- `pdf[index]` or `pdf.get_page(index)`: load a zero-indexed page.
- `pdf.new_page(width, height, index=None)`: insert a new page.
- `pdf.del_page(index)` or `del pdf[index]`: delete a page.
- `pdf.import_pages(other_pdf, pages=None, index=None)`: import pages from another document. `pages` may be a list of zero-based indices, a one-based page range string, or `None` for all pages.
- `pdf.save(dest, version=None, flags=...)`: save the current document state.
- `pdf.get_metadata_value(key)` / `pdf.get_metadata_dict(skip_empty=False)`: read metadata.
- `pdf.get_toc(max_depth=15)`: iterate bookmarks/table of contents.
- `pdf.init_forms(config=None)`: initialize forms; call right after document construction if form rendering is needed.

## Page

`PdfPage` represents one page. Page indices are zero-based.

Common geometry and metadata:

```python
page = pdf[0]

width = page.get_width()
height = page.get_height()
size = page.get_size()
rotation = page.get_rotation()
bbox = page.get_bbox()
media_box = page.get_mediabox()
crop_box = page.get_cropbox()
bleed_box = page.get_bleedbox()
trim_box = page.get_trimbox()
art_box = page.get_artbox()
```

Page mutation:

```python
page.set_rotation(90)
page.set_cropbox(left, bottom, right, top)
page.gen_content()
pdf.save("output.pdf")
```

Call `page.gen_content()` after inserting/removing/changing page objects before saving or reloading the page.

Useful methods:

- `page.get_textpage() -> PdfTextPage`: create a text page handle.
- `page.insert_obj(pageobj)`: insert a page object.
- `page.remove_obj(pageobj)`: remove a page object.
- `page.get_objects(filter=None, max_depth=...)`: iterate page objects.
- `page.flatten(flag=...)`: flatten form fields and annotations into page contents.
- `page.render(...) -> PdfBitmap`: rasterize the page.

## Text Page and Search

`PdfTextPage` extracts and searches searchable text from a page.

```python
textpage = page.get_textpage()
char_count = textpage.count_chars()
text = textpage.get_text_range(0, char_count) if char_count else ""
bounded = textpage.get_text_bounded(left, bottom, right, top)
```

Important methods:

- `count_chars() -> int`: number of characters in the internal text page.
- `get_text_range(index=0, count=-1, errors="ignore", force_this=False) -> str`: extract text for a character range.
- `get_text_bounded(left=None, bottom=None, right=None, top=None, errors="ignore") -> str`: extract text in PDF coordinates.
- `get_charbox(index, loose=False) -> tuple[float, float, float, float]`: character bounding box as left, bottom, right, top.
- `count_rects(index=0, count=-1) -> int`: count text rectangles for a character range.
- `get_rect(index) -> tuple[float, float, float, float]`: get a text rectangle. Call `count_rects()` first due to PDFium API behavior.
- `get_index(x, y, x_tol, y_tol) -> int | None`: find a nearby character index by position.
- `search(text, index=0, match_case=False, match_whole_word=False, consecutive=False) -> PdfTextSearcher`.

Search pattern:

```python
searcher = textpage.search(
    "needle",
    index=0,
    match_case=False,
    match_whole_word=False,
)

while True:
    match = searcher.get_next()
    if match is None:
        break
    char_index, char_count = match
    matched_text = textpage.get_text_range(char_index, char_count)
```

`PdfTextSearcher.get_next()` returns `(start_char_index, count)` or `None`. `get_prev()` moves backward.

Text range caveat: returned string length may differ from the requested character count because PDFium may exclude or insert characters relative to its internal character list.

## Rendering and Bitmap Conversion

Render a page to a bitmap:

```python
bitmap = page.render(
    scale=2.0,
    rotation=0,
    may_draw_forms=True,
    grayscale=False,
    rev_byteorder=True,
)
```

Common conversions:

```python
pil_image = bitmap.to_pil()
array = bitmap.to_numpy()
```

The repo's preferred rendering wrapper normalizes NumPy arrays and PNG encoding in `packages/pdf_ocr_utils/pdf_ocr_utils/renderers/pdfium.py`.

Format selection notes for `page.render()`:

- Default format is `BGR`.
- `prefer_bgrx=True` uses `BGRx`.
- `grayscale=True` uses `L`.
- Transparency or alpha fill may produce `BGRA`.
- `force_bitmap_format=...` overrides with a supported PDFium bitmap format.
- `rev_byteorder=True` swaps `BGR{A/x}` to `RGB{A/x}`.

## Page Objects

`PdfObject` is the base helper for page objects.

Useful methods:

- `get_bounds() -> tuple[float, float, float, float]`: object bounds.
- `get_quad_points() -> tuple[tuple[float, float], ...]`: quadrilateral points.
- `get_matrix() -> PdfMatrix`: current transform matrix.
- `set_matrix(matrix)`: replace transform matrix.
- `transform(matrix)`: multiply current transform matrix.

To add raw rectangle highlights, the existing repo helper uses:

```python
raw_rect = pypdfium2.raw.FPDFPageObj_CreateNewRect(left, bottom, width, height)
pypdfium2.raw.FPDFPageObj_SetStrokeColor(raw_rect, red, green, blue, alpha)
pypdfium2.raw.FPDFPageObj_SetStrokeWidth(raw_rect, 2.0)
pypdfium2.raw.FPDFPath_SetDrawMode(raw_rect, 0, 1)
rect_obj = pypdfium2.PdfObject(raw_rect)
page.insert_obj(rect_obj)
page.gen_content()
```

For production highlighting, prefer `packages/pdfium_utils/pdfium_utils/annotate.py` and `packages/pdfium_utils/pdfium_utils/search_and_annotate.py`.

## Images, Text Objects, and Fonts

`PdfImage` extends `PdfObject` for image objects.

Useful methods:

- `PdfImage.new(pdf)`: create an empty image object.
- `get_metadata()`: retrieve image metadata.
- `get_px_size() -> tuple[int, int]`: image dimensions in pixels.
- `load_jpeg(source, pages=None, inline=False, autoclose=True)`: load JPEG content.
- `set_bitmap(bitmap, pages=None)`: set image content from a bitmap.
- `get_bitmap(render=False, scale_to_original=True)`: get image bitmap.
- `get_data(decode_simple=False)`: extract image stream data.
- `get_filters(skip_simple=False) -> list[str]`: image filters.
- `extract(dest, fb_format="png")`: extract to a file or byte stream.

`PdfTextObj` exposes text object details:

- `extract() -> str`: text content. Requires a text page association.
- `get_font() -> PdfFont`: font handle.
- `get_font_size() -> float`: font size in PDF canvas units.

`PdfFont` exposes:

- `is_embedded`: whether the font is embedded.
- `get_base_name(errors="replace")`.
- `get_family_name(errors="replace")`.

## Bookmarks and Destinations

`pdf.get_toc()` yields bookmark information. Bookmark helpers expose:

- `get_title() -> str`
- `get_count() -> int`
- `get_dest() -> PdfDest | None`

Destination helpers expose:

- `get_index() -> int | None`: zero-based target page index.
- `get_view(seqtype=list) -> tuple[int, list[float]]`: view mode and coordinates.

## Errors and Warnings

pypdfium2 may raise `PdfiumError` when a PDFium API signals failure. For document loading, `err_code` may identify the failure subtype. `PdfiumWarning` represents warning-level PDFium issues such as XFA form load failures.

Configure Python warnings appropriately if warning visibility matters in tests or CLI tools.
