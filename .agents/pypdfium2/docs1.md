# Python API
## Preface
### Incompatibility with Threading
PDFium is inherently not thread-safe. It is not allowed to call pdfium functions simultaneously across different threads, not even with different documents. 1 However, you may still use pdfium in a threaded context if it is ensured that only a single pdfium call can be made at a time (e.g. via mutex). It is fine to do pdfium work in one thread and other work in other threads.
The same applies to pypdfium2’s helpers, or any wrapper calling pdfium, whether directly or indirectly, unless protected by mutex.
To parallelize expensive pdfium tasks such as rendering, consider processes instead of threads.
[1]
Doing so would crash or corrupt the process.
## API layers
pypdfium2 provides multiple API layers:
- The raw PDFium API, to be used with ctypes (pypdfium2.raw or pypdfium2_raw 2).
- The support model API, which is a set of Python helper classes around the raw API (pypdfium2).
- Additionally, there is the internal API, which contains various utilities that aid with using the raw API and are accessed by helpers, but do not fit in the support model namespace itself (pypdfium2.internal).
Wrapper objects provide a raw attribute to access the underlying ctypes object. In addition, helpers automatically resolve to raw if used as C function parameter. 3 This allows to conveniently use helpers where available, while the raw API can still be accessed as needed.
The raw API is quite stable and provides a high level of backwards compatibility (seeing as PDFium is well-tested and relied on by popular projects), but it can be difficult to use, and special care needs to be taken with memory management.
The support model API is still in beta stage. It only covers a subset of pdfium features. Backwards incompatible changes may be applied occasionally, although we try to contain them within major releases. On the other hand, it is supposed to be safer and easier to use (“pythonic”), abstracting the finnicky interaction with C functions.
[2]
The latter does not automatically initialize pdfium on import.
[3]
Implemented via ctypes hook _as_parameter_
## Memory management
Note:
This section covers the support model. It is not applicable to the raw API alone!
PDFium objects commonly need to be closed by the caller to release allocated memory. 4 Where necessary, pypdfium2’s helper classes implement automatic closing on garbage collection using weakref.finalize. Additionally, they provide close() methods that can be used to release memory explicitly.
It may be advantageous to close objects explicitly instead of relying on Python garbage collection behaviour, to release allocated memory and acquired file handles immediately. 5
Closed objects must not be accessed anymore. Closing an object sets the underlying raw attribute to None, which should prevent illegal use of closed raw handles, though. Attempts to re-close an already closed object are silently ignored. Closing a parent object will automatically close any open children (e.g. pages derived from a pdf).
Raw objects must not be detached from their wrappers. Accessing a raw object after it was closed, whether explicitly or on garbage collection of the wrapper, is illegal (use after free). Due to limitations in weakref, finalizers can only be attached to wrapper objects, although they logically belong to the raw object.
[4]
Only objects owned by the caller of PDFium need to be closed. For instance, pageobjects that belong to a page are automatically freed by PDFium, while the caller is responsible for loose pageobjects.
[5]
Python does not know how many resources an opaque C object might bind.
## Version
### PYPDFIUM_INFO= 5.8.0
pypdfium2 helpers version.
It is suggested to compare against api_tag and possibly also beta (see below).
**Parameters:**
- `version` (str): Joined tag and desc, forming the full version.
- `tag` (str): Version ciphers joined as str, including possible beta.
- `desc` (str): Non-cipher descriptors represented as str.
- `api_tag` (tuple[int]): Version ciphers joined as tuple, excluding possible beta.
- `major` (int): Major cipher.
- `minor` (int): Minor cipher.
- `patch` (int): Patch cipher.
- `beta` (int | None): Beta cipher, or None if not a beta version.
- `n_commits` (int): Number of commits after tag at install time. 0 for release.
- `hash` (str | None): Hash of head commit (prefixed with 'g') if n_commits > 0, None otherwise.
- `dirty` (bool): True if there were uncommitted changes at install time.
- `data_source` (str): Source of this version info. Possible values: git, given, record.
- `is_editable` (bool | None): True for editable install, False otherwise.
### PDFIUM_INFO= 149.0.7825.0
PDFium version.
It is suggested to compare against build (see below).
**Parameters:**
- `version` (str): Joined tag and desc, forming the full version.
- `tag` (str): Version ciphers joined as string.
- `desc` (str): Descriptors (origin, flags) as string.
- `api_tag` (tuple[int]): Version ciphers grouped as tuple.
- `major` (int): Chromium major cipher.
- `minor` (int): Chromium minor cipher.
- `build` (int): Chromium/pdfium build cipher.
- `patch` (int): Chromium patch cipher.
- `n_commits` (int): Number of commits after tag at install time.
- `hash` (str | None): Hash of head commit.
- `origin` (str): The pdfium binary's origin.
- `flags` (tuple[str]): Tuple of pdfium feature flags.
## Errors and Warnings
```py
class PdfiumError(RuntimeError):
    """An error from the (Py)PDFium library.
    When a PDFium API indicates failure (as detected by function return code), this exception will be raised.
    """
    def __init__(self, msg, err_code=None):
        super().__init__(msg)
        self.err_code = err_code
```
**err_code**: PDFium error code, for programmatic handling of error subtypes, if provided by the API in question. Currently, only document loading distinguishes between different errors, whereas most APIs just return error or success, in which case this field will be None.
Type: `int | None`
```py
class PdfiumWarning(Warning):
    """A warning from the (Py)PDFium library.
    This is intended for error conditions that do not strictly necessitate raising an exception, 
    but should still be exposed programmatically.
    """
    def __init__(self, msg, err_code=None):
        super().__init__(msg)
        self.err_code = err_code
```
**err_code**: PDFium error code, for programmatic handling of error subtypes, if provided by the API in question. None otherwise. Currently, only XFA forms load failure provides this extra information.
Type: `int | None`
Make sure you have configured the right warning level – otherwise, warnings might be hidden.
Document
```py
class PdfDocument(AutoCloseable):
    """Document helper class."""
    def __init__(self, input: str | Path | bytes | ctypes.Array | BinaryIO | FPDF_DOCUMENT, 
                 password: str | None = None, autoclose: bool = False):
        """
        Parameters
        ----------
        input : str | pathlib.Path | bytes | ctypes.Array | BinaryIO | FPDF_DOCUMENT
            The input PDF given as file path, bytes, ctypes array, byte stream, or raw PDFium document handle.
        password : str | None
            A password to unlock the PDF, if encrypted.
        autoclose : bool
            Whether byte stream input should be automatically closed on finalization.
        Raises
        ------
        PdfiumError
            Raised if the document failed to load.
        FileNotFoundError
            Raised if an invalid or non-existent file path was given.
        """
```
**Hint**: Documents may be used in a `with`-block, closing the document on context manager exit.
- `len(doc)` may be called to get a document's number of pages.
- Pages may be loaded using list index access (`doc[0]`).
- Looping over a document will yield its pages from beginning to end.
- The `del` keyword and list index access may be used to delete pages.
**raw**: The underlying PDFium document handle. Type: `FPDF_DOCUMENT`
**formenv**: Form env, if the document has forms and `init_forms()` was called. Type: `PdfFormEnv | None`
**parent** (property)
```py
@classmethod
def new(cls) -> "PdfDocument":
    """Returns a new, empty document."""
```
```py
def init_forms(self, config: FPDF_FORMFILLINFO | None = None) -> None:
    """Initialize a form env, if the document has forms.
    If PDFium was built with XFA support and the PDF has XFA forms, 
    it will be attempted to load these as well.
    Attention: If form rendering is desired, this method shall be called 
    right after document construction, before getting document length or page handles.
    Parameters
    ----------
    config : FPDF_FORMFILLINFO | None
        Custom form config interface to use (optional).
    Raises
    ------
    PdfiumWarning
        When an attempt to load XFA forms was made and it failed.
    """
```
```py
def get_formtype(self) -> int:
    """Returns PDFium form type that applies to the document (FORMTYPE_*)."""
```
```py
def get_identifier(self, type=pdfium_c.FILEIDTYPE_PERMANENT) -> bytes:
    """Returns unique file identifier from the PDF's trailer dictionary.
    Parameters
    ----------
    type : int
        The identifier type to retrieve (FILEIDTYPE_*).
    """
```
```py
def get_version(self) -> int | None:
    """Returns the PDF version of the document."""
```
```py
def get_metadata_value(self, key: str) -> str:
    """Returns value of the given key in the PDF's metadata dictionary."""
```
**METADATA_KEYS**: `('Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate')`
```py
def get_metadata_dict(self, skip_empty: bool = False) -> dict:
    """Get the document's metadata as dictionary.
    Parameters
    ----------
    skip_empty : bool
        If True, skip items whose value is an empty string.
    """
```
```py
def count_attachments(self) -> int:
    """Returns the number of embedded files in the document."""
```
```py
def get_attachment(self, index: int) -> PdfAttachment:
    """Returns the attachment at given index (zero-based)."""
```
```py
def new_attachment(self, name: str) -> PdfAttachment:
    """Add a new attachment to the document.
    Parameters
    ----------
    name : str
        The name the attachment shall have.
    """
```
```py
def del_attachment(self, index: int) -> None:
    """Unlink the attachment at given index (zero-based)."""
```
```py
def get_page(self, index: int) -> PdfPage:
    """Returns the page at given index (zero-based)."""
```
Note: This calls `FORM_OnAfterLoadPage()` if the document has an active form env.
```py
def new_page(self, width: float, height: float, index: int | None = None) -> PdfPage:
    """Insert a new, empty page into the document."""
```
```py
def del_page(self, index: int) -> None:
    """Remove the page at given index (zero-based)."""
```
```py
def import_pages(self, pdf: "PdfDocument", pages: list[int] | str | None = None, index: int | None = None) -> None:
    """Import pages from a foreign document."""
```
```py
def get_page_size(self, index: int) -> tuple[float, float]:
    """Returns width and height of the page at given index."""
```
```py
def get_page_label(self, index: int) -> str:
    """Returns label of the page at given index."""
```
```py
def page_as_xobject(self, index: int, dest_pdf: "PdfDocument") -> PdfXObject:
    """Capture a page as XObject and attach it to a document's resources."""
```
```py
def get_toc(self, max_depth: int = 15, parent=None, level: int = 0, seen=None):
    """Iterate through the bookmarks in the document's table of contents (TOC)."""
```
## Form Environment
```py
class PdfFormEnv(AutoCloseable):
    """Form environment helper class."""
    @property
    def raw(self) -> FPDF_FORMHANDLE:
        """The underlying PDFium form env handle."""
    @property
    def config(self) -> FPDF_FORMFILLINFO:
        """Accompanying form configuration interface."""
    @property
    def pdf(self) -> "PdfDocument":
        """Parent document this form env belongs to."""
    @property
    def parent(self):
        """Parent property."""
```
## XObject
```py
class PdfXObject(AutoCloseable):
    """XObject helper class."""
    @property
    def raw(self) -> FPDF_XOBJECT:
        """The underlying PDFium XObject handle."""
    @property
    def pdf(self) -> "PdfDocument":
        """Reference to the document this XObject belongs to."""
    @property
    def parent(self):
        """Parent property."""
    def as_pageobject(self) -> "PdfObject":
        """Returns an independent pageobject representation of the XObject."""
```
## Bookmark
```py
class PdfBookmark(AutoCastable):
    """Bookmark helper class."""
    @property
    def raw(self) -> FPDF_BOOKMARK:
        """The underlying PDFium bookmark handle."""
    @property
    def pdf(self) -> "PdfDocument":
        """Reference to the document."""
    @property
    def level(self) -> int:
        """The bookmark's nesting level."""
    def get_title(self) -> str:
        """Returns the bookmark's title string."""
    def get_count(self) -> int:
        """Returns signed number of child bookmarks."""
    def get_dest(self) -> "PdfDest | None":
        """Returns the bookmark's destination."""
```
classPdfDest(raw, pdf)
Bases: AutoCastable
Destination helper class.
raw
The underlying PDFium destination handle.
Type: FPDF_DEST
pdf
Reference to the document this dest belongs to.
Type: PdfDocument
get_index()
Returns: Zero-based index of the page the dest points to, or None on failure.
Return type: int | None
get_view(seqtype=list)
Returns: A tuple of (view_mode, view_pos). view_mode is a constant (one of PDFDEST_VIEW_*) defining how view_pos shall be interpreted. view_pos is the target position on the page the dest points to. It may contain between 0 to 4 float coordinates, depending on the view mode.
Return type: (int, list[float])
Page
classPdfPage(raw, pdf, formenv)
Bases: AutoCloseable
Page helper class.
raw
The underlying PDFium page handle.
Type: FPDF_PAGE
pdf
Reference to the document this page belongs to.
Type: PdfDocument
formenv
Formenv handle, if the parent pdf had an active formenv at the time of page retrieval. None otherwise.
Type: PdfFormEnv | None
propertyparent
get_width()
Returns: Page width (horizontal size), in PDF canvas units.
Return type: float
get_height()
Returns: Page height (vertical size), in PDF canvas units.
Return type: float
get_size()
Returns: Page width and height, in PDF canvas units.
Return type: (float, float)
get_rotation()
Returns: Clockwise page rotation in degrees.
Return type: int
set_rotation(rotation)
Define the absolute, clockwise page rotation (0, 90, 180, or 270 degrees).
get_mediabox(fallback_ok=True)
Returns: The page MediaBox in PDF canvas units, consisting of four coordinates (usually x0, y0, x1, y1). If MediaBox is not defined, returns ANSI A (0, 0, 612, 792) if fallback_ok=True, None otherwise.
Return type: (float, float, float, float) | None
Known issue
Due to quirks in PDFium, all get_*box() functions except get_bbox() do not inherit from parent nodes in the page tree (as of PDFium 5418).
set_mediabox(l, b, r, t)
Set the page’s MediaBox by passing four float coordinates (usually x0, y0, x1, y1).
get_cropbox(fallback_ok=True)
Returns: The page’s CropBox (If not defined, falls back to MediaBox).
set_cropbox(l, b, r, t)
Set the page’s CropBox.
get_bleedbox(fallback_ok=True)
Returns: The page’s BleedBox (If not defined, falls back to CropBox).
set_bleedbox(l, b, r, t)
Set the page’s BleedBox.
get_trimbox(fallback_ok=True)
Returns: The page’s TrimBox (If not defined, falls back to CropBox).
set_trimbox(l, b, r, t)
Set the page’s TrimBox.
get_artbox(fallback_ok=True)
Returns: The page’s ArtBox (If not defined, falls back to CropBox).
set_artbox(l, b, r, t)
Set the page’s ArtBox.
## Page
```py
class PdfPage(AutoCloseable):
    """Page helper class."""
    @property
    def raw(self) -> FPDF_PAGE:
        """The underlying PDFium page handle."""
    @property
    def pdf(self) -> PdfDocument:
        """Reference to the document this page belongs to."""
    @property
    def formenv(self) -> PdfFormEnv | None:
        """Formenv handle, if active."""
    @property
    def parent(self):
        """Parent property."""
    def get_width(self) -> float:
        """Returns page width."""
    def get_height(self) -> float:
        """Returns page height."""
    def get_size(self) -> tuple[float, float]:
        """Returns page width and height."""
    def get_rotation(self) -> int:
        """Returns clockwise page rotation in degrees."""
    def set_rotation(self, rotation: int) -> None:
        """Define absolute clockwise page rotation (0, 90, 180, or 270)."""
    def get_mediabox(self, fallback_ok: bool = True) -> tuple[float, float, float, float] | None:
        """Returns the page MediaBox."""
    def set_mediabox(self, l: float, b: float, r: float, t: float) -> None:
        """Set the page's MediaBox."""
    def get_cropbox(self, fallback_ok: bool = True) -> tuple[float, float, float, float]:
        """Returns the page's CropBox."""
    def set_cropbox(self, l: float, b: float, r: float, t: float) -> None:
        """Set the page's CropBox."""
    def get_bleedbox(self, fallback_ok: bool = True) -> tuple[float, float, float, float]:
        """Returns the page's BleedBox."""
    def set_bleedbox(self, l: float, b: float, r: float, t: float) -> None:
        """Set the page's BleedBox."""
    def get_trimbox(self, fallback_ok: bool = True) -> tuple[float, float, float, float]:
        """Returns the page's TrimBox."""
    def set_trimbox(self, l: float, b: float, r: float, t: float) -> None:
        """Set the page's TrimBox."""
    def get_artbox(self, fallback_ok: bool = True) -> tuple[float, float, float, float]:
        """Returns the page's ArtBox."""
    def set_artbox(self, l: float, b: float, r: float, t: float) -> None:
        """Set the page's ArtBox."""
    def get_bbox(self) -> tuple[float, float, float, float]:
        """Returns the bounding box of the page."""
    def get_textpage(self) -> "PdfTextPage":
        """Returns a new text page handle for this page."""
    def insert_obj(self, pageobj: "PdfObject") -> None:
        """Insert a pageobject into the page."""
    def remove_obj(self, pageobj: "PdfObject") -> None:
        """Remove a pageobject from the page."""
    def gen_content(self) -> None:
        """Generate page content to apply additions/removals."""
    def get_objects(self, filter: list[int] | None = None, max_depth: int = 15, form=None, level: int = 0, textpage: "PdfTextPage" | None = None):
        """Iterate through the pageobjects on this page."""
    def flatten(self, flag=pdfium_c.FLAT_NORMALDISPLAY) -> int:
        """Flatten form fields and annotations into page contents."""
    def render(self, scale: float = 1, rotation: int = 0, crop: tuple[float, float, float, float] = (0,0,0,0), 
              may_draw_forms: bool = True, bitmap_maker=PdfBitmap.new_native, 
              color_scheme=None, fill_to_stroke: bool = False, **kwargs) -> "PdfBitmap":
        """Rasterize the page to a PdfBitmap."""
```
### Format selection
This is the format selection hierarchy used by `render()`, from lowest to highest priority:
- default: `BGR`
- `prefer_bgrx=True`: `BGRx`
- `grayscale=True`: `L`
- `maybe_alpha=True`: `BGRA` if the page has transparency
- `fill_color[3] < 255`: `BGRA`
- `force_bitmap_format=...`: any supported by pdfium
Additionally, `rev_byteorder=True` will swap `BGR{A/x}` to `RGB{A/x}`.
```py
class PdfColorScheme:
    """Rendering color scheme."""
    def __init__(self, path_fill, path_stroke, text_fill, text_stroke):
        pass
    def convert(self, rev_byteorder) -> FPDF_COLORSCHEME:
        """Returns the color scheme as FPDF_COLORSCHEME object."""
```
## Pageobjects
```py
class PdfObject(AutoCloseable):
    """Pageobject helper class."""
    @property
    def raw(self) -> FPDF_PAGEOBJECT:
        """The underlying PDFium pageobject handle."""
    @property
    def type(self) -> int:
        """The object's type (FPDF_PAGEOBJ_*)."""
    @property
    def page(self) -> PdfPage | None:
        """Reference to the page this pageobject belongs to."""
    @property
    def pdf(self) -> PdfDocument | None:
        """Reference to the document."""
    @property
    def container(self) -> "PdfObject | None":
        """Handle to parent Form XObject."""
    @property
    def level(self) -> int:
        """Nesting level of parent Form XObjects."""
    @property
    def parent(self):
        """Parent property."""
    def get_bounds(self) -> tuple[float, float, float, float]:
        """Get the bounds of the object on the page."""
    def get_quad_points(self) -> tuple[tuple[float, float], ...]:
        """Get the object's quadrilateral points."""
    def get_matrix(self) -> "PdfMatrix":
        """Returns the pageobject's current transform matrix."""
    def set_matrix(self, matrix: "PdfMatrix") -> None:
        """Set the pageobject's transform matrix."""
    def transform(self, matrix: "PdfMatrix") -> None:
        """Multiply the pageobject's current transform matrix."""
```
```py
class PdfImage(PdfObject):
    """Image object helper class."""
    SIMPLE_FILTERS = ('ASCIIHexDecode', 'ASCII85Decode', 'RunLengthDecode', 'FlateDecode', 'LZWDecode')
    @classmethod
    def new(cls, pdf: PdfDocument) -> "PdfImage":
        """Create a new, empty image object."""
    def get_metadata(self) -> FPDF_IMAGEOBJ_METADATA:
        """Retrieve image metadata."""
    def get_px_size(self) -> tuple[int, int]:
        """Returns image dimension in pixels."""
    def load_jpeg(self, source: str | Path | BinaryIO, pages: list[PdfPage] | None = None, 
                  inline: bool = False, autoclose: bool = True) -> None:
        """Set a JPEG as the image object's content."""
    def set_bitmap(self, bitmap: PdfBitmap, pages: list[PdfPage] | None = None) -> None:
        """Set a bitmap as the image object's content."""
    def get_bitmap(self, render: bool = False, scale_to_original: bool = True) -> PdfBitmap:
        """Get a bitmap rasterization of the image."""
    def get_data(self, decode_simple: bool = False) -> ctypes.Array:
        """Get the data of the image stream."""
    def get_filters(self, skip_simple: bool = False) -> list[str]:
        """Get image filters."""
    def extract(self, dest: str | Path | io.BytesIO, fb_format: str = "png") -> None:
        """Extract the image into a file or byte stream."""
```
classPdfTextObj(raw, *args, **kwargs)
Bases: PdfObject
Textobject helper class.
You may want to call PdfPage.get_objects() or PdfTextPage.get_textobj() to obtain an instance of this class.
textpage
The parent textpage, or None if not set.
Type: PdfTextPage | None
extract()
Returns: The objects’s text content.
Return type: str
Note
This method requires the textpage attribute to be set. For textobjects obtained through PdfPage.get_objects(), use the textpage passthrough parameter.
get_font()
Returns: Handle to the object’s font. Provides name and weight info.
Return type: PdfFont
get_font_size()
Returns: Font size used by the object’s text, in PDF canvas units (typically 1/72in).
Return type: float
classPdfFont(raw, parent=None, needs_free=False)
Bases: AutoCloseable
Font helper class.
propertyis_embedded
The font’s embedding status. True if it is embedded (bundled) in the PDF, False otherwise. This is a cached property, as a font object’s embedding status is unlikely to change.
Type: bool
get_base_name(errors='replace')
Returns: The base font name.
Return type: str
get_family_name(errors='replace')
Returns: The font family name.
Return type: str
get_weight()
Returns: The font’s weight. Typical values are 400 (normal) and 700 (bold).
Return type: int
STANDARD_FONTS= ('Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic', 'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique', 'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique', 'Symbol', 'ZapfDingbats')
Standard 14 fonts (Type 1, PostScript names) according to PDF32000_2008, section 9.6.2.2. These fonts or suitable substitutes should be available to all PDF engines, so PDFs that uses them without embedding can still be expected to display correctly.
classmethodload_standard(pdf, name)
Load one of the Standard 14 fonts defined above into a PDF.
If the font is not available in the system, a substitute may be used. Checking get_family_name() should give a clue about internal substitution (e.g. “Chrom Sans OTF”, “Chrom Serif OTF”). For system substitution, consider intercepting what goes through the PdfSysfontBase callbacks.
Parameters: pdf (PdfDocument) – The document to which the font shall be loaded.
name (str) – The font name. Must be one of STANDARD_FONTS.
Text Page
classPdfTextPage(raw, page)
Bases: AutoCloseable
Text page helper class.
Note
PDFium’s text APIs generally output CRLF (\r\n) style line breaks. This may be undesirable or confusing in some situations, e.g. when processing the output with an (unaware) parser on the command line. If this is an issue, replace \r\n with just \n.
Hint
(py)pdfium itself does not implement layout analysis, such as detecting words/lines/paragraphs. However, there may be third-party extensions for this job, e.g.: https://github.com/VikParuchuri/pdftext
raw
The underlying PDFium textpage handle.
Type: FPDF_TEXTPAGE
page
Reference to the page this textpage belongs to.
Type: PdfPage
propertyparent
get_text_bounded(left=None, bottom=None, right=None, top=None, errors='ignore')
Extract text from given boundaries, in PDF canvas units. If a boundary value is None, it defaults to the corresponding value of PdfPage.get_bbox().
Changed in version 5.7.1: The page bbox is now managed as a cached property, so it will only be retrieved if needed. This helps avoid overhead when get_text_bounded() is called many times with given rectangles. In the event that you changed the page bbox, manually del textpage._page_bbox (if loaded) or re-initialize the textpage.
Parameters: errors (str) – Error treatment when decoding the data (see codecs.decode()).
Returns: The text on the page area in question, or an empty string if no text was found.
Return type: str
get_text_range(index=0, count=-1, errors='ignore')
Extract text from a given range.
Parameters: index (int) – Index of the first char to include.
count (int) – Number of chars to cover, relative to the internal char list. Defaults to -1 for all remaining chars after index.
errors (str) – Error treatment when decoding the data (see codecs.decode()).
Returns: The text in the range in question, or an empty string if no text was found.
Return type: str
Warning
This method is limited to UCS-2, whereas get_text_bounded() provides full Unicode support.
Note
The returned text’s length does not have to match count, even if it will for most PDFs. This is because the underlying API may exclude/insert chars compared to the internal list, although rare in practice. This means, if the char at i is excluded, get_text_range(i, 2)[1] will raise an index error. Pdfium provides raw APIs FPDFText_GetTextIndexFromCharIndex() / FPDFText_GetCharIndexFromTextIndex() to translate between the two views and identify excluded/inserted chars.
In case of leading/trailing excluded characters, pypdfium2 modifies index and count accordingly to prevent pdfium from unexpectedly reading beyond range(index, index+count).
count_chars()
Returns: The number of characters on the text page.
Return type: int
count_rects(index=0, count=-1)
Parameters: index (int) – Start character index.
count (int) – Character count to consider (defaults to -1 for all remaining).
Returns: The number of text rectangles in the given character range.
Return type: int
get_index(x, y, x_tol, y_tol)
Get the index of a character by position.
Parameters: x (float) – Horizontal position (in PDF canvas units).
y (float) – Vertical position.
x_tol (float) – Horizontal tolerance.
y_tol (float) – Vertical tolerance.
Returns: The index of the character at or nearby the point (x, y). May be None if there is no character. If an internal error occurred, an exception will be raised.
Return type: int | None
get_charbox(index, loose=False)
Get the bounding box of a single character.
Parameters: index (int) – Index of the character to work with, in the page’s character array.
loose (bool) – Get a more comprehensive box covering the entire font bounds, as opposed to the default tight box specific to the one character.
Returns: Values for left, bottom, right and top in PDF canvas units.
Return type: float
get_rect(index)
Get the bounding box of a text rectangle at the given index.
Attention
count_rects() must be called once with default params before subsequent get_rect() calls for this function to work.
Returns: Values for left, bottom, right and top in PDF canvas units.
Return type: float
get_textobj(index)
Returns: A handle to the textobject that includes the char at index, or None if it could not be resolved (e.g. escape character).
Return type: PdfTextObj | None
Tip
Textobjects can also be obtained through PdfPage.get_objects().
search(text, index=0, match_case=False, match_whole_word=False, consecutive=False, flags=0)
Locate text on the page.
Parameters: text (str) – The string to search for.
index (int) – Character index at which to start searching.
match_case (bool) – If True, the search will be case-specific (upper and lower letters treated as different characters).
match_whole_word (bool) – If True, substring occurrences will be ignored (e.g. cat would not match category).
consecutive (bool) – If False (the default), search() will skip past the current match to look for the next match. If True, parts of the previous match may be caught again (e.g. searching for aa in aaaa would match 3 rather than 2 times).
flags (int) – Passthrough of raw pdfium searching flags. Note that you may want to use the boolean options instead.
Returns: A helper object to search text.
Return type: PdfTextSearcher
classPdfTextSearcher(raw, textpage)
Bases: AutoCloseable
Text searcher helper class.
raw
The underlying PDFium searcher handle.
Type: FPDF_SCHHANDLE
textpage
Reference to the textpage this searcher belongs to.
Type: PdfTextPage
propertyparent
get_next()
Returns: Start character index and count of the next occurrence, or None if the last occurrence was passed.
Return type: (int, int) | None
get_prev()
Returns: Start character index and count of the previous occurrence (i. e. the one before the last valid occurrence), or None if the last occurrence was passed.
Return type: (int, int) | None
Bitmap
classPdfBitmap(raw, buffer, width, height, stride, format, rev_byteorder, needs_free)
Bases: AutoCloseable
Bitmap helper class.
Warning
bitmap.close(), which frees the buffer of foreign bitmaps, is not validated for safety. A bitmap must not be closed while other objects still depend on its buffer!
raw
The underlying PDFium bitmap handle.
Type: FPDF_BITMAP
buffer
A ctypes array representation of the pixel data (each item is an unsigned byte, i. e. a number ranging from 0 to 255).
Type: Array[c_ubyte]
width
Width of the bitmap (horizontal size).
Type: int
height
Height of the bitmap (vertical size).
Type: int
stride
Number of bytes per line in the bitmap buffer. Depending on how the bitmap was created, there may be a padding of unused bytes at the end of each line, so this value can be greater than width * n_channels.
Type: int
format
PDFium bitmap format constant (FPDFBitmap_*)
Type: int
rev_byteorder
Whether the bitmap is using reverse byte order.
Type: bool
n_channels
Number of channels per pixel.
Type: int
mode
The bitmap format as string (see PIL Modes).
Type: str
propertyparent
classmethodfrom_raw(raw, rev_byteorder=False, ex_buffer=None)
Construct a PdfBitmap wrapper around a raw PDFium bitmap handle.
Note
This method is primarily meant for bitmaps provided by pdfium (as in PdfImage.get_bitmap()). For bitmaps created by the caller, where the parameters are already known, it may be preferable to call the PdfBitmap constructor directly.
Parameters: raw (FPDF_BITMAP) – PDFium bitmap handle.
rev_byteorder (bool) – Whether the bitmap uses reverse byte order.
ex_buffer (Array[c_ubyte] | None) – If the bitmap was created from a buffer allocated by Python/ctypes, pass in the ctypes array to keep it referenced.
classmethodnew_native(width, height, format, rev_byteorder=False, buffer=None, stride=None)
Create a new bitmap using FPDFBitmap_CreateEx(), with a buffer allocated by Python/ctypes, or provided by the caller.
If buffer and stride are None, a packed buffer is created.
If a custom buffer is given but no stride, the buffer is assumed to be packed.
If a custom stride is given but no buffer, a stride-agnostic buffer is created.
If both custom buffer and stride are given, they are used as-is.
Caller-provided buffer/stride are subject to a logical validation.
classmethodnew_foreign(width, height, format, rev_byteorder=False, force_packed=False)
Create a new bitmap using FPDFBitmap_CreateEx(), with a buffer allocated by PDFium. There may be a padding of unused bytes at line end, unless force_packed=True is given.
Note, the recommended default bitmap creation strategy is new_native().
classmethodnew_foreign_simple(width, height, use_alpha, rev_byteorder=False)
Create a new bitmap using FPDFBitmap_Create(). The buffer is allocated by PDFium.
PDFium docs specify that each line uses width * 4 bytes, with no gap between adjacent lines, i.e. the resulting buffer should be packed.
Contrary to the other PdfBitmap.new_*() methods, this method does not take a format constant, but a use_alpha boolean. If True, the format will be FPDFBitmap_BGRA, FPFBitmap_BGRx otherwise. Other bitmap formats cannot be used with this method.
Note, the recommended default bitmap creation strategy is new_native().
fill_rect(color, left, top, width, height)
Fill a rectangle on the bitmap with the given color. The coordinate system’s origin is the top left corner of the image.
Note
This function replaces the color values in the given rectangle. It does not perform alpha compositing.
Parameters: color (tuple[int, int, int, int]) – RGBA fill color (a tuple of 4 integers ranging from 0 to 255).
to_numpy()
Get a numpy array view of the bitmap.
The array contains as many rows as the bitmap is high. Each row contains as many pixels as the bitmap is wide. Each pixel will be an array holding the channel values, or just a value if there is only one channel (see n_channels and format).
The resulting array is supposed to share memory with the original bitmap buffer, so changes to the buffer should be reflected in the array, and vice versa.
Returns: NumPy array (representation of the bitmap buffer).
Return type: numpy.ndarray
to_pil()
Get a PIL image of the bitmap, using PIL.Image.frombuffer().
For RGBA, RGBX and L bitmaps, PIL is supposed to share memory with the original buffer, so changes to the buffer should be reflected in the image, and vice versa. Otherwise, PIL will make a copy of the data.
Returns: PIL image (representation or copy of the bitmap buffer).
Return type: PIL.Image.Image
classmethodfrom_pil(pil_image)
Convert a PIL image to a PDFium bitmap. Due to the limited number of color formats and bit depths supported by FPDF_BITMAP, this may be a lossy operation.
Bitmaps returned by this function should be treated as immutable.
Parameters: pil_image (PIL.Image.Image) – The image.
Returns: PDFium bitmap (with a copy of the PIL image’s data).
Return type: PdfBitmap
```py
def to_pil(self) -> PIL.Image.Image:
    """Get a PIL image of the bitmap."""
```
```py
@classmethod
def from_pil(cls, pil_image: PIL.Image.Image) -> "PdfBitmap":
    """Convert a PIL image to a PDFium bitmap."""
```
```py
def get_posconv(self, page: PdfPage) -> "PdfPosConv":
    """Acquire a PdfPosConv object to translate coordinates."""
```
## Matrix
```py
class PdfMatrix:
    """PDF transformation matrix helper class."""
    def __init__(self, a: float = 1, b: float = 0, c: float = 0, 
                 d: float = 1, e: float = 0, f: float = 0):
        pass
    @property
    def a(self) -> float:
        """Matrix value [0][0]."""
    @property
    def b(self) -> float:
        """Matrix value [0][1]."""
    @property
    def c(self) -> float:
        """Matrix value [1][0]."""
    @property
    def d(self) -> float:
        """Matrix value [1][1]."""
    @property
    def e(self) -> float:
        """X translation."""
    @property
    def f(self) -> float:
        """Y translation."""
    def get(self) -> tuple[float, float, float, float, float, float]:
        """Get the matrix as tuple."""
    @classmethod
    def from_raw(cls, raw) -> "PdfMatrix":
        """Load a PdfMatrix from a raw FS_MATRIX object."""
    def to_raw(self) -> FS_MATRIX:
        """Convert the matrix to a raw FS_MATRIX object."""
    def multiply(self, other: "PdfMatrix") -> "PdfMatrix":
        """Multiply this matrix by another."""
    def translate(self, x: float, y: float) -> "PdfMatrix":
        """Translate the matrix."""
    def scale(self, x: float, y: float) -> "PdfMatrix":
        """Scale the matrix."""
    def rotate(self, angle: float, ccw: bool = False, rad: bool = False) -> "PdfMatrix":
        """Rotate the matrix."""
    def mirror(self, invert_x: bool, invert_y: bool) -> "PdfMatrix":
        """Mirror the matrix."""
    def skew(self, x_angle: float, y_angle: float, rad: bool = False) -> "PdfMatrix":
        """Skew the matrix."""
    def on_point(self, x: float, y: float) -> tuple[float, float]:
        """Apply matrix to a point."""
    def on_rect(self, left: float, bottom: float, right: float, top: float) -> tuple[float, float, float, float]:
        """Apply matrix to a rectangle."""
```
## Attachment
```py
class PdfAttachment(AutoCastable):
    """Attachment helper class."""
    @property
    def raw(self) -> FPDF_ATTACHMENT:
        """The underlying PDFium attachment handle."""
    @property
    def pdf(self) -> PdfDocument:
        """Reference to the document."""
    def get_name(self) -> str:
        """Returns name of the attachment."""
    def get_data(self) -> ctypes.Array:
        """Returns the attachment's file data."""
    def set_data(self, data) -> None:
        """Set the attachment's file data."""
```
page (PdfPage) – Handle to the page.
pos_args (tuple[int*5]) – pdfium canvas args (start_x, start_y, size_x, size_y, rotate), as in FPDF_RenderPageBitmap() etc.
to_page(bitmap_x, bitmap_y)
Translate coordinates from bitmap to page.
to_bitmap(page_x, page_y)
Translate coordinates from page to bitmap.
Matrix
classPdfMatrix(a=1, b=0, c=0, d=1, e=0, f=0)
Bases: object
PDF transformation matrix helper class.
See the PDF 1.7 specification, Section 8.3.3 (“Common Transformations”).
Note
The PDF format uses row vectors.
Transformations operate from the origin of the coordinate system (PDF coordinates: commonly bottom left, but can be any corner in principle. Device coordinates: top left).
Matrix calculations are implemented independently in Python.
Matrix objects are immutable, so transforming methods return a new matrix.
Matrix objects implement ctypes auto-conversion to FS_MATRIX for easy use as C function parameter.
a
Matrix value [0][0].
Type: float
b
Matrix value [0][1].
Type: float
c
Matrix value [1][0].
Type: float
d
Matrix value [1][1].
Type: float
e
Matrix value [2][0] (X translation).
Type: float
f
Matrix value [2][1] (Y translation).
Type: float
get()
Get the matrix as tuple of the form (a, b, c, d, e, f).
classmethodfrom_raw(raw)
Load a PdfMatrix from a raw FS_MATRIX object.
to_raw()
Convert the matrix to a raw FS_MATRIX object.
multiply(other)
Multiply this matrix by another PdfMatrix, to concatenate transformations.
translate(x, y)
Parameters: x (float) – Horizontal shift (<0: left, >0: right).
y (float) – Vertical shift.
scale(x, y)
Parameters: x (float) – A factor to scale the X axis (<1: compress, >1: stretch).
y (float) – A factor to scale the Y axis.
rotate(angle, ccw=False, rad=False)
Parameters: angle (float) – Angle by which to rotate the matrix.
ccw (bool) – If True, rotate counter-clockwise.
rad (bool) – If True, interpret the angle as radians.
mirror(invert_x, invert_y)
Parameters: invert_x (bool) – If True, invert X coordinates (horizontal transform). Corresponds to flipping around the Y axis.
invert_y (bool) – If True, invert Y coordinates (vertical transform). Corresponds to flipping around the X axis.
Note
Flipping around a vertical axis leads to a horizontal transform, and vice versa.
skew(x_angle, y_angle, rad=False)
Parameters: x_angle (float) – Inner angle to skew the X axis.
y_angle (float) – Inner angle to skew the Y axis.
rad (bool) – If True, interpret the angles as radians.
on_point(x, y)
Returns: Transformed point.
Return type: (float, float)
on_rect(left, bottom, right, top)
Returns: Transformed rectangle.
Return type: (float, float, float, float)
Attachment
classPdfAttachment(raw, pdf)
Bases: AutoCastable
Attachment helper class. See PDF 1.7, Section 7.11 “File Specifications”.
raw
The underlying PDFium attachment handle.
Type: FPDF_ATTACHMENT
pdf
Reference to the document this attachment belongs to. Must remain valid as long as the attachment is used.
Type: PdfDocument
```py
def has_key(self, key: str) -> bool:
    """Returns True if key is contained in the params dictionary."""
```
```py
def get_value_type(self, key: str) -> int:
    """Returns type of the value (FPDF_OBJECT_*)."""
```
```py
def get_str_value(self, key: str) -> str:
    """Returns the value if it is a string or name."""
```
```py
def set_str_value(self, key: str, value: str) -> None:
    """Set the attribute specified by key to the string value."""
```
## Miscellaneous
### System Font Info
Warning: This API is experimental and exempted from semantic versioning until this notice is removed.
### Unsupported Feature Info
## Internal
Warning: The following helpers are considered internal, so their API may change any time. They are isolated in an own namespace (`pypdfium2.internal`).
```py
# Rotation constants
RotationToConst = {0: 0, 90: 1, 180: 2, 270: 3}  # degrees -> PDFium constant
RotationToDegrees = {0: 0, 1: 90, 2: 180, 3: 270}  # PDFium constant -> degrees
# Bitmap format mappings
BitmapTypeToNChannels = {1: 1, 2: 3, 3: 4, 4: 4, 5: 4}
BitmapTypeToStr = {1: 'L', 2: 'BGR', 3: 'BGRX', 4: 'BGRA', 5: 'BGRa'}
BitmapTypeToStrReverse = {1: 'L', 2: 'RGB', 3: 'RGBX', 4: 'RGBA', 5: 'RGBa'}
BitmapStrToConst = {'BGR': 2, 'BGRA': 4, 'BGRX': 3, 'BGRa': 5, 'L': 1}
BitmapStrReverseToConst = {'L': 1, 'RGB': 2, 'RGBA': 4, 'RGBX': 3, 'RGBa': 5}
# Type mappings
FormTypeToStr = {0: 'None', 1: 'AcroForm', 2: 'XFA', 3: 'XFAF'}
ColorspaceToStr = {0: '?', 1: 'DeviceGray', 2: 'DeviceRGB', 3: 'DeviceCMYK', 4: 'CalGray', 5: 'CalRGB', 6: 'Lab', 7: 'ICCBased', 8: 'Separation', 9: 'DeviceN', 10: 'Indexed', 11: 'Pattern'}
ViewmodeToStr = {0: '?', 1: 'XYZ', 2: 'Fit', 3: 'FitH', 4: 'FitV', 5: 'FitR', 6: 'FitB', 7: 'FitBH', 8: 'FitBV'}
ObjectTypeToStr = {0: '?', 1: 'text', 2: 'path', 3: 'image', 4: 'shading', 5: 'form'}
ObjectTypeToConst = {'?': 0, 'form': 5, 'image': 3, 'path': 2, 'shading': 4, 'text': 1}
PageModeToStr = {-1: '?', 0: 'None', 1: 'Outline', 2: 'Thumbnails', 3: 'Full-screen', 4: 'Layers', 5: 'Attachments'}
ErrorToStr = {0: 'Success', 1: 'Unknown error', 2: 'File access error', 3: 'Data format error', 4: 'Incorrect password error', 5: 'Unsupported security scheme error', 6: 'Page not found or content error'}
UnsupportedInfoToStr = {1: 'XFA form', 2: 'Portable collection', 3: 'Attachment (incomplete support)', 4: 'Security', 5: 'Shared review', 6: 'Shared form (acrobat)', 7: 'Shared form (filesystem)', 8: 'Shared form (email)', 11: '3D annotation', 12: 'Movie annotation', 13: 'Sound annotation', 14: 'Screen media annotation', 15: 'Screen rich media annotation', 16: 'Attachment annotation', 17: 'Signature annotation'}
CharsetToStr = {0: 'ANSI', 1: 'Default', 2: 'Symbol', 128: 'ShiftJIS', 129: 'Hangeul', 134: 'GB2312', 136: 'ChineseBig5', 161: 'Greek', 163: 'Vietnamese', 177: 'Hebrew', 178: 'Arabic', 204: 'Cyrillic', 222: 'Thai', 238: 'EasternEuropean'}
class PdfFontPitchFamilyFlags(Flag):
    """Map PDFium font pitch and family flags to python enum.Flag."""
    FIXEDPITCH = 1
    ROMAN = 16
    SCRIPT = 64
class AutoCastable:
    """Base class for auto-castable objects."""
    pass
class AutoCloseable(AutoCastable):
    """Base class for auto-closeable objects."""
    def __init__(self, close_func, *args, obj=None, needs_free=True, tracked=True, **kwargs):
        pass
    def close(self, _by_parent=False): pass
# Internal helper functions
def color_tohex(color, rev_byteorder): pass
def set_callback(struct, fname, callback): pass
def set_callbacks(struct, **kwargs): pass
def is_stream(buf, spec='r'): pass
def get_buffer(ptr, size): pass
def get_bufreader(buffer): pass
def get_bufwriter(buffer): pass
def pages_c_array(pages): pass
```