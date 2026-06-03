# Tesseract OCR & pytesseract API Reference

Consolidated reference from the [pytesseract docs](https://github.com/madmaze/pytesseract),
the [Tesseract User Manual](https://tesseract-ocr.github.io/tessdoc/),
[Command-Line Usage](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html),
and [Improving OCR Quality](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html).

---

## 1. What is pytesseract?

Python-tesseract is an OCR tool for Python. It wraps
[Google's Tesseract-OCR Engine](https://github.com/tesseract-ocr/tesseract) and
can read all image types supported by Pillow and Leptonica (jpeg, png, gif, bmp,
tiff, etc.).

---

## 2. Installation

### System dependency (Tesseract engine)

```bash
# macOS
brew install tesseract

# Debian/Ubuntu
apt-get install tesseract-ocr

# Additional language packs
apt-get install tesseract-ocr-fra tesseract-ocr-deu
```

### Python package

```bash
pip install pytesseract
```

Requires Python 3.6+ and [Pillow](https://pypi.org/project/Pillow/).

If `tesseract` is not in your PATH, set it explicitly:

```python
pytesseract.pytesseract.tesseract_cmd = r'/usr/local/bin/tesseract'
```

---

## 3. pytesseract Functions

### `get_languages(config='')`

Returns all currently supported languages by the installed Tesseract.

### `get_tesseract_version()`

Returns the Tesseract version installed in the system.

### `image_to_string(image, lang=None, config='', nice=0, output_type=Output.STRING, timeout=0)`

Returns unmodified output as string from Tesseract OCR processing.

### `image_to_boxes(image, lang=None, config='', nice=0, output_type=Output.STRING, timeout=0)`

Returns result containing recognized characters and their box boundaries.
Output format per line: `char left bottom right top page_num`.

### `image_to_data(image, lang=None, config='', nice=0, output_type=Output.STRING, timeout=0, pandas_config=None)`

Returns verbose TSV data including boxes, confidences, line and page numbers.
Requires Tesseract 3.05+.

TSV columns: `level`, `page_num`, `block_num`, `par_num`, `line_num`,
`word_num`, `left`, `top`, `width`, `height`, `conf`, `text`.

### `image_to_osd(image, lang=None, config='', nice=0, output_type=Output.STRING, timeout=0)`

Returns orientation and script detection information.

### `image_to_pdf_or_hocr(image, lang=None, config='', nice=0, extension='pdf', timeout=0)`

Returns bytes for a searchable PDF (`extension='pdf'`) or HOCR HTML
(`extension='hocr'`).

### `image_to_alto_xml(image, lang=None, config='', nice=0, timeout=0)`

Returns result in ALTO XML format (Analyzed Layout and Text Object).

### `run_and_get_output(image, extension='txt', lang=None, config='', nice=0, timeout=0)`

Returns the raw output from Tesseract. Gives more control over parameters.

### `run_and_get_multiple_output(image, extensions=['txt', 'box'], lang=None, config='', nice=0, timeout=0)`

Like `run_and_get_output` but accepts a list of extensions and returns
corresponding outputs from a single Tesseract call. Saves compute time when
multiple output formats are needed. Supported extensions: `txt`, `pdf`,
`hocr`, `box`, `tsv`.

---

## 4. Common Parameters

| Parameter | Type | Description |
|---|---|---|
| `image` | PIL Image, NumPy array, or str | Image to process. Strings are treated as file paths. Objects are auto-converted to RGB. |
| `lang` | str | Tesseract language code. Default: `eng`. Multiple: `'eng+fra'`. |
| `config` | str | Additional CLI flags, e.g. `'--psm 6 --oem 1'`. |
| `nice` | int | Unix process priority modifier. Not supported on Windows. |
| `output_type` | Output class | Output format: `Output.STRING` (default), `Output.BYTES`, `Output.DICT`, `Output.DATAFRAME`. |
| `timeout` | int/float | Max seconds before killing Tesseract. Raises `RuntimeError` on timeout. |
| `pandas_config` | dict | Custom kwargs for `pandas.read_csv` when using `Output.DATAFRAME`. |

---

## 5. OCR Engine Modes (OEM)

Set via `--oem N` in the `config` parameter.

| Value | Mode | Notes |
|-------|------|-------|
| 0 | Legacy Tesseract only | Uses pattern matching. Requires `tessdata` repo traineddata. |
| 1 | LSTM neural net only | Default in Tesseract 5. Best accuracy for most use cases. |
| 2 | Legacy + LSTM combined | |
| 3 | Default, based on what is available | Picks best available engine. |

---

## 6. Page Segmentation Modes (PSM)

Set via `--psm N` in the `config` parameter.

| Value | Mode |
|-------|------|
| 0 | Orientation and script detection (OSD) only |
| 1 | Automatic page segmentation with OSD |
| 2 | Automatic page segmentation, no OSD or OCR |
| 3 | Fully automatic page segmentation, no OSD (**default**) |
| 4 | Assume a single column of text of variable sizes |
| 5 | Assume a single uniform block of vertically aligned text |
| 6 | Assume a single uniform block of text |
| 7 | Treat the image as a single text line |
| 8 | Treat the image as a single word |
| 9 | Treat the image as a single word in a circle |
| 10 | Treat the image as a single character |
| 11 | Sparse text — find as much text as possible in no particular order |
| 12 | Sparse text with OSD |
| 13 | Raw line — treat as single text line, bypassing Tesseract page hacks |

### Choosing a PSM

- **Full page OCR**: Use PSM 3 (default) or PSM 1 (with OSD).
- **Single column/paragraph**: PSM 4 or PSM 6.
- **Single line** (e.g. license plate, captcha): PSM 7.
- **Single word**: PSM 8.
- **Single character**: PSM 10.
- **Scattered text** (stamps, labels): PSM 11.

---

## 7. Tesseract CLI Usage

```bash
# Basic invocation
tesseract imagename outputbase

# With language and PSM
tesseract --tessdata-dir /usr/share imagename outputbase -l eng --psm 3

# With LSTM engine
tesseract input.tiff output --oem 1 -l eng

# Multiple languages
tesseract input.png output -l eng+fra+deu

# Searchable PDF output
tesseract input.png output pdf

# TSV output
tesseract input.png output tsv

# HOCR output
tesseract input.png output hocr

# ALTO XML output
tesseract input.png output alto

# Multiple output formats
tesseract input.png output pdf txt hocr

# Print available parameters
tesseract --print-parameters
```

---

## 8. Improving OCR Quality

### Input Requirements

- **DPI**: Tesseract works best at **300 DPI** or higher. Rescale low-resolution images.
- **Text color**: Use **dark text on light background**. Invert images if needed (especially for Tesseract 4.x+).
- **Optimal capital letter height**: ~20–50 pixels for best results.

### Preprocessing Steps

1. **Rescaling**: Upscale to at least 300 DPI.
2. **Binarization**: Convert to black and white. Tesseract uses Otsu internally, but external binarization (adaptive threshold, Sauvola) may improve results on uneven backgrounds.
3. **Noise removal**: Apply median or Gaussian blur to remove scanning artifacts.
4. **Dilation/Erosion**: Thicken or thin strokes for better character segmentation.
5. **Deskewing**: Straighten rotated scans.
6. **Border removal**: Remove dark borders that confuse page segmentation.
7. **Alpha channel**: Remove transparency; flatten to white background.

### Tesseract 5 Binarization Options

Tesseract 5.0.0 added two new Leptonica-based binarization methods:
- **Adaptive Otsu**
- **Sauvola**

View parameters: `tesseract --print-parameters | grep thresholding_`

### Preprocessing with OpenCV (Python)

```python
import cv2
from PIL import Image

img = cv2.imread("scan.png")
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Otsu binarization
_, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

# Noise removal
denoised = cv2.medianBlur(thresh, 3)

# Deskewing
coords = cv2.findNonZero(cv2.bitwise_not(denoised))
angle = cv2.minAreaRect(coords)[-1]
if angle < -45:
    angle = -(90 + angle)
else:
    angle = -angle
(h, w) = denoised.shape[:2]
M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
rotated = cv2.warpAffine(denoised, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

# Pass to pytesseract
pil_img = Image.fromarray(rotated)
```

---

## 9. Language Support

### Common language codes

| Code | Language |
|------|----------|
| `eng` | English |
| `fra` | French |
| `deu` | German |
| `spa` | Spanish |
| `ita` | Italian |
| `por` | Portuguese |
| `chi_sim` | Chinese (Simplified) |
| `chi_tra` | Chinese (Traditional) |
| `jpn` | Japanese |
| `kor` | Korean |
| `ara` | Arabic |
| `hin` | Hindi |

### Traineddata repositories

| Repository | Description |
|---|---|
| [tessdata](https://github.com/tesseract-ocr/tessdata) | Both Legacy and LSTM models |
| [tessdata_best](https://github.com/tesseract-ocr/tessdata_best) | Best quality LSTM models (slower) |
| [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) | Fast integer LSTM models |

Set the tessdata directory:

```python
pytesseract.image_to_string(
    image,
    lang="chi_sim",
    config=r'--tessdata-dir "/path/to/tessdata"',
)
```

---

## 10. Output Formats

| Format | Extension | pytesseract function | Description |
|--------|-----------|---------------------|-------------|
| Plain text | `txt` | `image_to_string()` | Raw recognized text |
| Character boxes | `box` | `image_to_boxes()` | Per-character bounding boxes |
| TSV data | `tsv` | `image_to_data()` | Word-level boxes, confidence, hierarchy |
| Searchable PDF | `pdf` | `image_to_pdf_or_hocr(extension='pdf')` | Invisible text layer over image |
| HOCR | `hocr` | `image_to_pdf_or_hocr(extension='hocr')` | HTML with positional metadata |
| ALTO XML | `alto` | `image_to_alto_xml()` | Standardized XML for digital libraries |
| OSD | — | `image_to_osd()` | Orientation and script detection |

---

## 11. TSV Output Format

The TSV output from `image_to_data()` has these columns:

| Column | Description |
|--------|-------------|
| `level` | Hierarchy level: 1=page, 2=block, 3=paragraph, 4=line, 5=word |
| `page_num` | Page number (1-indexed) |
| `block_num` | Block number within the page |
| `par_num` | Paragraph number within the block |
| `line_num` | Line number within the paragraph |
| `word_num` | Word number within the line |
| `left` | X coordinate of the bounding box (top-left) |
| `top` | Y coordinate of the bounding box (top-left) |
| `width` | Width of the bounding box |
| `height` | Height of the bounding box |
| `conf` | Confidence score (0–100). `-1` means no text recognized. |
| `text` | Recognized text for this element |

---

## 12. Configuration Variables

Tesseract has many configurable parameters. List them with:

```bash
tesseract --print-parameters
```

### Commonly used variables

| Variable | Default | Description |
|----------|---------|-------------|
| `tessedit_char_whitelist` | (empty) | Only recognize these characters |
| `tessedit_char_blacklist` | (empty) | Never recognize these characters |
| `tessedit_write_images` | false | Write intermediate processed images |
| `tessedit_pageseg_mode` | 3 | Page segmentation mode |
| `tessedit_ocr_engine_mode` | 1 | OCR engine mode |
| `preserve_interword_spaces` | 0 | Set to 1 to keep spaces between words |
| `user_defined_dpi` | 0 | Override DPI detection. Useful for images without DPI metadata. |

Pass as config flags:

```python
pytesseract.image_to_string(
    image,
    config="-c tessedit_char_whitelist=0123456789 --psm 7",
)
```
