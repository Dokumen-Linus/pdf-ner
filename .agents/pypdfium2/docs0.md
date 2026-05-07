# Introduction
pypdfium2 is an ABI-level Python 3 binding to PDFium, a powerful and liberal-licensed library for PDF rendering, inspection, manipulation and creation.
It is built with ctypesgen and external PDFium binaries. The custom setup infrastructure provides a seamless packaging and installation process. A wide range of platforms is supported with pre-built packages.
pypdfium2 includes helpers to simplify common use cases, while the raw PDFium API (ctypes) remains accessible as well.
```python
# Installation
## From PyPI (recommended)
```
```bash
python -m pip install -U pypdfium2
```
If available for your platform, this will use a pre-built wheel package, which is the easiest way of installing pypdfium2. Otherwise, setup code will run. If your platform is not covered with pre-built binaries, this will look for system pdfium, or attempt to build pdfium from source.
### JavaScript/XFA builds
pdfium-binaries also offer V8 (JavaScript) / XFA enabled builds. If you need them, do e.g.:
```bash
PDFIUM_PLATFORM=auto-v8 pip install -v pypdfium2 --no-binary pypdfium2
```
This will bypass wheels and run setup, while requesting use of V8 builds through the PDFIUM_PLATFORM=auto-v8 environment setting. See below for more info.
## Optional runtime dependencies
As of this writing, pypdfium2 does not require any mandatory runtime dependencies, apart from Python and PDFium itself (which is commonly bundled).
However, some optional support model / CLI features need additional packages:
Pillow (module PIL) is a pouplar imaging library for Python. pypdfium2 provides convenience adapters to translate between raw bitmap buffers and PIL images. It also uses PIL for some command-line functionality (e.g. image saving).
NumPy is a library for scientific computing. As with Pillow, pypdfium2 provides helpers to get a numpy array view of a raw bitmap.
opencv-python (module cv2) is an imaging library built around numpy arrays. It can be used in the rendering CLI to save with pypdfium2’s numpy adapter.
If tabulate is installed, the CLI will give prettier output where tables are involved.
pypdfium2 tries to defer imports of optional dependencies until they are actually needed, so there should be no startup overhead if you don’t use them.
## From the repository / With setup
Note, unlike helpers, pypdfium2’s setup is not bound by API stability promises, so it may change any time.
### Setup Dependencies
#### System
C pre-processor (gcc/clang – alternatively, specify the command to invoke via $CPP)
```bash
git
```
(Used e.g. to determine the latest pdfium-binaries version, to get git describe info, or to check out pdfium on sourcebuild. Might be optional on default setup.)
```bash
gh >= 2.47.0
```
(optional; used to verify pdfium-binaries build attestations)
#### Python
ctypesgen (pypdfium2-team fork)
setuptools
wheel, if setuptools is < v70.1.0
Python dependencies should be automatically installed, unless --no-build-isolation is passed to pip.
Note
pypdfium2 and its ctypesgen fork are developed in sync, i.e. each pypdfium2 commit ought to be coupled with the then HEAD of pypdfium2-ctypesgen.
Our release sdists, and latest pypdfium2 from git, will automatically use matching ctypesgen.
However, when using a non-latest commit, you’ll have to set up the right ctypesgen version on your own, and install pypdfium2 without build isolation.
### Get the code
```bash
git clone "https://github.com/pypdfium2-team/pypdfium2.git"
cd pypdfium2/
```
### Default setup
```bash
# In the pypdfium2/ directory
python -m pip install -v .
```
This will invoke pypdfium2’s setup.py. Typically, this means a binary will be downloaded from pdfium-binaries and bundled into pypdfium2, and ctypesgen will be called on pdfium headers to produce the bindings interface.
pdfium-binaries offer GitHub build provenance attestations, so it is highly recommended that you install the gh CLI for our setup to verify authenticity of the binaries.
If no pre-built binaries are available for your platform, setup will look for system pdfium, or attempt to build pdfium from source.
```bash
# pip options of interest
-v  # Verbose logging output. Useful for debugging.
-e  # Install in editable mode, so the installation points to the source tree.
--no-build-isolation  # Do not isolate setup in a virtual env; use the main env instead.
--no-binary pypdfium2  # Do not use binary wheels when installing from PyPI.
--pre  # Install a beta release, if available.
```
### With system pdfium
```bash
PDFIUM_PLATFORM="system-search" python -m pip install -v .
```
Look for a system-provided pdfium shared library, and bind against it.
Standard, portable ctypes.util.find_library() means will be used to probe for system pdfium at setup time, and the result will be hardcoded into the bindings. Alternatively, set $PDFIUM_BINARY to the path of the out-of-tree DLL to use.
If system pdfium was found, we will look for pdfium headers from which to generate the bindings (e.g. in /usr/include). If the headers are in a location not recognized by our code, set $PDFIUM_HEADERS to the directory in question.
Also, we try to determine the pdfium version, either from the library filename itself, or via pkg-config. If this fails, you can pass the version alongside the setup target, e.g. PDFIUM_PLATFORM=system-search:XXXX, where XXXX is the pdfium build version. If the version is not known in the end, NaN placeholders will be set.
If the version is known but no headers were found, they will be downloaded from upstream. If neither headers nor version are known (or ctypesgen is not installed), the reference bindings will be used as a last resort. This is ABI-unsafe and thus discouraged.
If find_library() failed to find pdfium, we may do additional, custom search, such as checking for a pdfium shared library included with LibreOffice, and – if available – determining its version.
Our search heuristics currently expect a Linux-like filesystem hierarchy (e.g. /usr), but contributions for other systems are welcome.
Important
When pypdfium2 is installed with system pdfium, the bindings ought to be re-generated with the new headers whenever the out-of-tree pdfium DLL is updated, for ABI safety reasons.1
For distributors, we highly recommend the use of versioned libraries (e.g. libpdfium.so.140.0.7269.0) or similar concepts that enforce binary/bindings version match, so outdated bindings will safely stop working with a meaningful error, rather than silently continue unsafely, at risk of hard crashes.
Tip
If you mind pypdfium2’s setup making a web request to resolve the full version, you may pass it in manually via GIVEN_FULLVER=$major.$minor.$build.$patch (colon-separated if there are multiple versions), or less ideally, set IGNORE_FULLVER=1 to use NaN placeholders. This applies to other setup targets as well.
For distributors, we recommend that you use the full version in binary filename or pkgconfig info, so pypdfium2’s setup will not need to resolve it in the first place.
Related targets
There is also a system-generate:$VERSION target, to produce system pdfium bindings in a host-independent fashion. This will call find_library() at runtime, and may be useful for packaging.
Further, you can set just system to consume pre-generated files from the data/system staging directory. See the section on caller-provided data files for more info.
### With self-built pdfium
You can also install pypdfium2 with a self-compiled pdfium shared library, by placing it in data/sourcebuild/ along with a bindings interface and version info, and setting the PDFIUM_PLATFORM="sourcebuild" directive to use these files on setup.
This project comes with two scripts to automate the build process: build_toolchained.py and build_native.py (in setupsrc/).
build_toolchained is based on the build instructions in pdfium’s Readme, and uses Google’s toolchain (this means foreign binaries and sysroots). This results in a heavy checkout process that may take a lot of time and space. Dependency libraries are vendored. An advantage of the toolchain is its powerful cross-compilation support (including symbol reversioning).
build_native is an attempt to address some shortcomings of the toolchained build. It performs a lean, self-managed checkout, and is tailored towards native compilation. It uses system dependencies (compiler/gn/ninja), which must be installed by the caller beforehand. This script should theoretically work on arbitrary Linux architectures. As a drawback, this process is not supported or even documented upstream, so it might be hard to maintain.
Tip
The native sourcebuild can either use system libraries, or pdfium’s vendored libraries. When invoked directly, by default, system libraries need to be installed. However, when invoked through fallback setup (PDFIUM_PLATFORM=fallback), vendored libraries will be used.
The --vendor ... and --no-vendor ... options can be used to control vendoring on a per-library basis. See build_native.py --help for details.
You can also set PDFIUM_PLATFORM to sourcebuild-native or sourcebuild-toolchained to trigger either build script through setup, and pass command-line flags with $BUILD_PARAMS. However, for simplicity, both scripts/subtargets share just sourcebuild as staging directory.
#### Dependencies:
##### When building with system libraries
, the following packages need to be installed (including development headers): freetype, icu-uc, lcms2, libjpeg, libopenjp2, libpng, libtiff, zlib (and maybe glib to satisfy the build system).
You might also want to know that pdfium bundles agg, abseil, fast_float.
##### When building with system tools
, gn (generate-ninja), ninja, and a compiler are needed. If available, the compiler defaults to GCC, but Clang should also work if you set up some symlinks, and make sure you have the libclang_rt builtins or pass --no-libclang-rt.
##### To do the toolchained build
, you’d run something like:
```bash
# call build script with --help to list options
python setupsrc/build_toolchained.py
PDFIUM_PLATFORM="sourcebuild" python -m pip install -v .
```
Or for the native build, on Ubuntu 24.04, you could do e.g.:
```bash
# Install dependencies
sudo apt-get install generate-ninja ninja-build libfreetype-dev liblcms2-dev libjpeg-dev libopenjp2-7-dev libpng-dev libtiff-dev zlib1g-dev libicu-dev libglib2.0-dev
# Build with GCC
python ./setupsrc/build_native.py --compiler gcc
# Alternatively, build with Clang
sudo apt-get install llvm lld
VERSION=18
ARCH=$(uname -m)
sudo ln -s "/usr/lib/clang/$VERSION/lib/linux" "/usr/lib/clang/$VERSION/lib/$ARCH-unknown-linux-gnu"
sudo ln -s "/usr/lib/clang/$VERSION/lib/linux/libclang_rt.builtins-$ARCH.a" "/usr/lib/clang/$VERSION/lib/linux/libclang_rt.builtins.a"
python ./setupsrc/build_native.py --compiler clang
# Install
PDFIUM_PLATFORM="sourcebuild" python -m pip install -v .
```
Note
The native sourcebuild currently supports Linux (or similar). macOS and Windows are not handled, as we do not have access to these systems, and working over CI did not turn out feasible – use the toolchain-based build for now. Community help / pull requests to extend platform support would be welcome.
### Android (Termux)
The native build may also work on Android with Termux in principle.
Click to expand for instructions
cibuildwheel
Sourcebuild can be run through cibuildwheel. For targets configured in our pyproject.toml, the basic invocation is as simple as p.ex.
### cibuildwheel
Sourcebuild can be run through cibuildwheel. For targets configured in our pyproject.toml, the basic invocation is as simple as p.ex.
```bash
CIBW_BUILD="cp311-manylinux_x86_64" cibuildwheel
```
A more involved use case could look like this:
```bash
CIBW_BUILD="cp310-musllinux_s390x" CIBW_ARCHS=s390x CIBW_CONTAINER_ENGINE=podman TEST_PDFIUM=1 cibuildwheel
```
See also our cibuildwheel workflow. For more options, see the upstream documentation.
On Linux, this will use the native sourcebuild with vendored dependency libraries. On Windows and macOS, the toolchained sourcebuild is used.
Note, for Linux, cibuildwheel requires Docker, or Podman. On the author’s version of Fedora, Docker can be installed as follows:
```bash
sudo dnf in moby-engine  # this provides the docker command
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# then reboot (re-login might also suffice)
```
For other ways of installing Docker, refer to the cibuildwheel docs (Setup, Platforms) and the links therein.
Warning
cibuildwheel copies the project directory into a container, not taking .gitignore rules into account. Thus, it is advisable to make a fresh checkout of pypdfium2 before running cibuildwheel. In particular, a toolchained checkout of pdfium within pypdfium2 is problematic, and will cause a halt on the Copying project into container... step. For development, make sure the fresh checkout is in sync with the working copy.
Tip
pdfium itself has first-class cross-compilation support. In particular, for Linux architectures supported by upstream’s toolchain but not available natively on CI, we recommend to forego cibuildwheel, and instead cross-build pdfium using its own toolchain, e.g.:
```bash
# assuming cross-compilation dependencies are installed
python setupsrc/build_toolchained.py --target-cpu arm
PDFIUM_PLATFORM=sourcebuild CROSS_TAG="manylinux_2_17_armv7l" python -m build -wxn
```
This typically achieves a lower glibc requirement than we can with cibuildwheel.
### With caller-provided data files
pypdfium2 is like any other Python project in essentials, except that it needs some data files: a pdfium DLL (either bundled or out-of-tree), a bindings interface (generated via ctypesgen), and pdfium version info (JSON).
The main point of pypdfium2’s custom setup is to automate deployment of these files, in a way that suits end users / contributors, and our PyPI packaging.
However, if you want to (or have to) forego this automation, you can also just supply these files yourself, as shown below. This allows to largely sidestep pypdfium2’s own setup code.
The idea is basically to put your data files in a staging directory, data/sourcebuild or data/system (depending on whether you want to bundle or use system pdfium), and set the matching $PDFIUM_PLATFORM target to consume from that directory on setup.
This setup strategy should be inherently free of web requests. Mind though, we don't support the result. If you bring your own files, it's your own responsibility, and it's quite possible your pypdfium2 might turn out subtly different from ours.
```bash
# First, ask yourself: Do you want to bundle pdfium (in-tree), or use system
# pdfium (out-of-tree)? For bundling, set "sourcebuild", else set "system".
TARGET="sourcebuild"  # or "system"
STAGING_DIR="data/$TARGET"
# If you have decided for bundling, copy over the pdfium DLL in question.
# Otherwise, skip this step.
cp "$MY_BINARY_PATH" "$STAGING_DIR/libpdfium.so"
# Now, we will call ctypesgen to generate the bindings interface.
# Reminder: You'll want to use the pypdfium2-team fork of ctypesgen.
# It generates much cleaner bindings, and it's what our source expects
# (there may be subtle API differences in terms of output).
# How exactly you do this is down to you.
# See ctypesgen --help or base.py::run_ctypesgen() for further options.
ctypesgen --library pdfium --rt-libpaths $MY_RT_LIBPATHS --ct-libpaths $MY_CT_LIBPATHS \
--headers $MY_INCLUDE_DIR/fpdf*.h -o $STAGING_DIR/bindings.py [-D $MY_RAW_FLAGS]
# Then write the version file (fill the placeholders).
# Note, this is not a mature interface yet and might change any time!
# See also https://pypdfium2.readthedocs.io/en/stable/python_api.html#pypdfium2.version.PDFIUM_INFO
# major/minor/build/patch: integers forming the pdfium version being packaged
# n_commits/hash: git describe like post-tag info (0/null for release commit)
# origin: a string to identify the build
# flags: a comma-separated list of pdfium feature flag strings
#        (e.g. "V8", "XFA") - may be empty for default build
cat > "$STAGING_DIR/version.json" <<END
{
  "major": $PDFIUM_MAJOR,
  "minor": $PDFIUM_MINOR,
  "build": $PDFIUM_BUILD,
  "patch": $PDFIUM_PATCH,
  "n_commits": $POST_TAG_COMMIT_COUNT,
  "hash": $POST_TAG_HASH,
  "origin": "$TARGET-$MY_ORIGIN",
  "flags": [$MY_SHORT_FLAGS]
}
END
```
```python
# Finally, run setup (through pip, pyproject-build or whatever).
# The PDFIUM_PLATFORM value will instruct pypdfium2's setup to use the files
# just prepared, without any web requests.
```
```bash
PDFIUM_PLATFORM="consume-$TARGET" python -m pip install -v .
```
# we supplied, rather than to generate its own.
PDFIUM_PLATFORM=$TARGET python -m pip install --no-build-isolation -v .
## Further setup info (formal summary)
This is a somewhat formal description of pypdfium2’s setup capabilities. It is meant to sum up and complement the above documentation on specific sub-targets.
Disclaimer: As it is hard to keep up with constantly evolving setup code, it is possible this documentation may be outdated/incomplete. Also keep in mind that these APIs could change any time, and may be mainly of internal interest.
Binaries are stored in platform-specific sub-directories of data/, along with bindings and version information.
$PDFIUM_PLATFORM defines which binary to include on setup.
Format spec: [$PLATFORM][-v8][:$VERSION] ([] = segments, $CAPS = variables).
Examples: auto, auto:7269 auto-v8:7269 (auto may be substituted by an explicit platform name, e.g. linux_x64).
V8: If given, use the V8 (JavaScript) and XFA enabled pdfium binaries. Otherwise, use the regular (non-V8) binaries.
Version: If given, use the specified pdfium-binaries release. Otherwise, use the default version currently set in the codebase. Set pinned to request that behavior explicitly. Or set latest to use the newest pdfium-binaries release instead.
Platform:
If unset or auto, the host platform is detected and a corresponding binary will be selected.
If an explicit platform identifier (e.g. linux_x64, darwin_arm64, …), binaries for the requested platform will be used.2
If system-search, look for and bind against system-provided pdfium instead of embedding a binary. If just system, consume existing bindings from data/system/.
If sourcebuild, binary and bindings will be taken from data/sourcebuild/, assuming a prior run of the native or toolchained build scripts. sourcebuild-native or sourcebuild-toolchained can also be used to trigger either build through setup (use $BUILD_PARAMS to pass custom options).
If sdist, no platform-specific files will be included, so as to create a source distribution.
$PYPDFIUM_MODULES=[raw,helpers] defines the modules to include. Metadata adapts dynamically.
May be used by packagers to decouple raw bindings and helpers, which may be relevant if packaging against system pdfium.
Would also allow to install only the raw module without helpers, or only helpers with a custom raw module.
$PDFIUM_BINDINGS=reference allows to override ctypesgen and use the reference bindings file autorelease/bindings.py instead.
This is a convenience option to get pypdfium2 installed from source even if a working ctypesgen / C pre-processor is not available in the install env. May be automatically enabled under given circumstances.
Warning: This may not be ABI-safe. Please make sure binary/bindings build headers match to avoid ABI issues.
# From Conda
Warning
Beware: Any conda packages/recipes of pypdfium2 or pdfium-binaries that might be provided by other distributors, including anaconda/main or conda-forge default channels, are unofficial.
Note
Wait a moment: Do you really need this? pypdfium2 is best installed from PyPI (e.g. via pip),3 which you can also do in a conda env. Rather than asking your users to add custom channels, consider making pypdfium2 optional at install time, and ask them to install it via pip instead.
This library has no hard runtime dependencies, so you don’t need to worry about breaking the conda env.
```python
## To install
### With permanent channel config (encouraged):
```
```bash
conda config --add channels bblanchon
conda config --add channels pypdfium2-team
conda config --set channel_priority strict
conda install pypdfium2-team::pypdfium2_helpers
```
### Alternatively, with temporary channel config:
```bash
conda install pypdfium2-team::pypdfium2_helpers --override-channels -c pypdfium2-team -c bblanchon -c defaults
```
If desired, you may limit the channel config to the current environment by adding --env. Adding the channels permanently and tightening priority is encouraged to include pypdfium2 in conda update by default, and to avoid accidentally replacing the install with a different channel. Otherwise, you should be cautious when making changes to the environment.
## To depend on pypdfium2 in a conda-build recipe
```yaml
requirements:
  run:
    - pypdfium2-team::pypdfium2_helpers
```
You’ll want to have downstream callers handle the custom channels as shown above, otherwise conda will not be able to satisfy requirements.
## To set up channels in a GH workflow
```yaml
- name: ...
  uses: conda-incubator/setup-miniconda@v3
  with:
    # ... your options
    channels: pypdfium2-team,bblanchon
    channel-priority: strict
```
This is just a suggestion, you can also call conda config manually, or pass channels on command basis using -c, as discussed above.
## To verify the sources
```bash
conda list --show-channel-urls "pypdfium2|pdfium-binaries"
conda config --show-sources
```
The table should show pypdfium2-team and bblanchon in the channels column. If added permanently, the config should also include these channels, ideally with top priority. Please check this before reporting any issue with a conda install of pypdfium2.
Note: Conda packages are normally managed using recipe feedstocks driven by third parties, in a Linux repository like fashion. However, with some quirks it is also possible to do conda packaging within the original project and publish to a custom channel, which is what pypdfium2-team does, and the above instructions are referring to.
# Unofficial packages
The authors of this project have no control over and are not responsible for possible third-party builds of pypdfium2, and we do not support them. Please use our official packages where possible. If you have an issue with a third-party build, either contact your distributor, or try to reproduce with our official builds.
Do not expect us to add/change code for downstream-specific setup tasks. Related issues or PRs may be closed without further notice if we don’t see fit for upstream. Enhancements of general value that are maintainable and align well with the idea of our setup code are welcome, though.
Important
If you are a third-party distributor, please point out in the description that your package is unofficial, i.e. not affiliated with or endorsed by the pypdfium2 authors.
In particular, if you feel like you need patches to package pypdfium2, please submit them on the Discussions page so we can figure out if there isn’t a better way (there usually is).
```python
# Usage
## Support model
```
Here are some examples of using the support model API.
### Import the library
```python
import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c
```
### Open a PDF using the helper class PdfDocument (supports file paths as string or pathlib.Path, or file content as bytes or byte stream)
```python
pdf = pdfium.PdfDocument("./path/to/document.pdf")
version = pdf.get_version()  # get the PDF standard version
n_pages = len(pdf)  # get the number of pages in the document
page = pdf[0]  # load a page
```
### Render the page
```python
bitmap = page.render(
    scale = 1,    # 72dpi resolution
    rotation = 0, # no additional rotation
    # ... further rendering options
)
pil_image = bitmap.to_pil()
pil_image.show()
```
Note, with the PIL adapter, it might be advantageous to use force_bitmap_format=pdfium_c.FPDFBitmap_BGRA, rev_byteorder=True or perhaps prefer_bgrx=True, maybe_alpha=True, rev_byteorder=True, to achieve a pixel format supported natively by PIL, and avoid rendering with transparency to a non-alpha bitmap, which can slow down pdfium.
With .to_numpy(), all formats are zero-copy, but passing either maybe_alpha=True (if dynamic pixel format is acceptable) or force_bitmap_format=pdfium_c.FPDFBitmap_BGRA is also recommended for the transparency problem.
### Try some page methods
```python
# Get page dimensions in PDF canvas units (1pt->1/72in by default)
width, height = page.get_size()
# Set the absolute page rotation to 90° clockwise
page.set_rotation(90)
# Locate objects on the page
for obj in page.get_objects():
    print(obj.level, obj.type, obj.get_bounds())
```
### Extract and search text
```python
# Load a text page helper
textpage = page.get_textpage()
# Extract text from the whole page
text_all = textpage.get_text_bounded()
# Extract text from a specific rectangular area
text_rect = textpage.get_text_bounded(left=50, bottom=100, right=width-50, top=height-100)
# Extract text from a specific char range
text_span = textpage.get_text_range(index=10, count=15)
# Locate text on the page
searcher = textpage.search("something", match_case=False, match_whole_word=False)
# This returns the next occurrence as (char_index, char_count), or None if not found
match = searcher.get_next()
```
### Read the table of contents
```python
import pypdfium2.internal as pdfium_i
for bm in pdf.get_toc(max_depth=15):
    count, dest = bm.get_count(), bm.get_dest()
    out = "    " * bm.level
    out += "[%s] %s -> " % (
        f"{count:+}" if count != 0 else "*",
        bm.get_title(),
    )
    if dest:
        index, (view_mode, view_pos) = dest.get_index(), dest.get_view()
        out += "%s  # %s %s" % (
            index+1 if index != None else "?",
            pdfium_i.ViewmodeToStr.get(view_mode),
            round(view_pos, 3),
        )
    else:
        out += "_"
    print(out)
```
### Create a new PDF with an empty A4 sized page
```python
pdf = pdfium.PdfDocument.new()
width, height = (595, 842)
page_a = pdf.new_page(width, height)
```
### Include a JPEG image in a PDF
```python
pdf = pdfium.PdfDocument.new()
image = pdfium.PdfImage.new(pdf)
image.load_jpeg("./tests/resources/mona_lisa.jpg")
width, height = image.get_px_size()
matrix = pdfium.PdfMatrix().scale(width, height)
image.set_matrix(matrix)
page = pdf.new_page(width, height)
page.insert_obj(image)
page.gen_content()
```
### Save the document
```python
# PDF 1.7 standard
pdf.save("output.pdf", version=17)
```
## Raw PDFium API
While helper classes conveniently wrap the raw PDFium API, it may still be accessed directly and is available in the namespace pypdfium2.raw. Lower-level utilities that may aid with using the raw API are provided in pypdfium2.internal.
```python
import pypdfium2.raw as pdfium_c
import pypdfium2.internal as pdfium_i
```
Since PDFium is a large library, many components are not covered by helpers yet. However, as helpers expose their underlying raw objects, you may seamlessly integrate raw APIs while using helpers as available. When passed as ctypes function parameter, helpers automatically resolve to the raw object handle (but you may still access it explicitly if desired):
```python
permission_flags = pdfium_c.FPDF_GetDocPermission(pdf.raw)  # explicit
permission_flags = pdfium_c.FPDF_GetDocPermission(pdf)      # implicit
```
For PDFium docs, please look at the comments in its public header files.4 A variety of examples on how to interface with the raw API using ctypes is already provided with support model source code. Nonetheless, the following guide may be helpful to get started with the raw API, if you are not familiar with ctypes yet.
In general, PDFium functions can be called just like normal Python functions. However, parameters may only be passed positionally, i.e. it is not possible to use keyword arguments. There are no defaults, so you always need to provide a value for each argument.
```python
# arguments: filepath (bytes), password (bytes|None)
# NUL-terminate filepath and encode as UTF-8
pdf = pdfium_c.FPDF_LoadDocument((filepath+"\x00").encode("utf-8"), None)
```
This is the underlying bindings declaration,5 which loads the function from the binary and contains the information required to convert Python types to their C equivalents.
```python
if hasattr(_libs['pdfium'], 'FPDF_LoadDocument'):
    FPDF_LoadDocument = _libs['pdfium']['FPDF_LoadDocument']
    FPDF_LoadDocument.argtypes = (FPDF_STRING, FPDF_BYTESTRING)
    FPDF_LoadDocument.restype = FPDF_DOCUMENT
```
Python bytes are converted to FPDF_STRING by ctypes autoconversion. This works because FPDF_STRING is actually an alias to POINTER(c_char) (i.e. char*), which is a primitive pointer type. When passing a string to a C function, it must always be NUL-terminated, as the function merely receives a pointer to the first item and then continues to read memory until it finds a NUL terminator.
First of all, function parameters are not only used for input, but also for output:
```python
# Initialise an integer object (defaults to 0)
c_version = ctypes.c_int()
# Let the function assign a value to the c_int object, and capture its return code (True for success, False for failure)
ok = pdfium_c.FPDF_GetFileVersion(pdf, c_version)
# If successful, get the Python int by accessing the `value` attribute of the c_int object
# Otherwise, set the variable to None (in other cases, it may be desired to raise an exception instead)
version = c_version.value if ok else None
```
If an array is required as output parameter, you can initialise one like this (in general terms):
```python
# long form
array_type = (c_type * array_length)
array_object = array_type()
# short form
array_object = (c_type * array_length)()
Example: Getting view mode and target position from a destination object returned by some other function.
# (Assuming `dest` is an FPDF_DEST)
n_params = ctypes.c_ulong()
# Create a C array to store up to four coordinates
view_pos = (pdfium_c.FS_FLOAT * 4)()
view_mode = pdfium_c.FPDFDest_GetView(dest, n_params, view_pos)
# Slice the array to the actual number of coordinates. This implicitly converts the C array to a Python list.
view_pos = view_pos[:n_params.value]
```
For string output parameters, callers needs to provide a sufficiently long, pre-allocated buffer. This may work differently depending on what type the function requires, which encoding is used, whether the number of bytes or units is returned, and whether space for a NUL terminator is included or not. Carefully review the documentation of the function in question to fulfill its requirements.
There are many different ways of handling output strings; this section describes the strategy used by pypdfium2’s helpers.
We will first import the codecs.decode() function which can be used on generic memory (whereas the .decode() method is only available on bytes or bytearrays):
```python
from codecs import decode
```
Example A: Getting the title string of a bookmark.
```python
# (Assuming `bookmark` is an FPDF_BOOKMARK)
# First call to get the required number of bytes (not units!), including space for a NUL terminator
```
n_bytes = pdfium_c.FPDFBookmark_GetTitle(bookmark, None, 0)
# Initialise the output buffer
buffer = ctypes.create_string_buffer(n_bytes)
# Second call with the actual buffer
pdfium_c.FPDFBookmark_GetTitle(bookmark, buffer, n_bytes)
# Decode to string, cutting off the NUL terminator (encoding: UTF-16LE)
title = decode(memoryview(buffer)[:n_bytes-2], "utf-16-le")
Example B: Extracting text in given boundaries.
```python
# (Assuming `textpage` is an FPDF_TEXTPAGE and the boundary variables are set)
# Store common arguments for the two calls
```
args = (textpage, left, top, right, bottom)
```python
# First call to get the required number of units (not bytes!).
# A possible NUL terminator is not included.
```
n_units = pdfium_c.FPDFText_GetBoundedText(*args, None, 0)
# If no characters were found, return an empty string
if n_units <= 0:
    return ""
```python
# Create the buffer. This particular API does not insist on space for a NUL terminator.
# Skip so we don't need to cut it off later.
```
buffer = (ctypes.c_ushort * n_units)()
# Second call with the actual buffer
pdfium_c.FPDFText_GetBoundedText(*args, buffer, n_units)
# Decode to string (You may want to pass errors="ignore" to skip possible errors in the PDF's encoding)
text = decode(buffer, "utf-16-le")
There are also APIs that return the number of bytes but expect a multi-byte type, e.g. FPDF_WCHAR. In that case, you can calculate the number of units via -(n_bytes // -ctypes.sizeof(pdfium_c.FPDF_WCHAR)) (this does a ceil division).
Not only are there different ways of string output that need to be handled according to the requirements of the function in question. String input, too, can work differently depending on encoding and type. We have already discussed FPDF_LoadDocument(), which takes a UTF-8 encoded string as char*. A different examples is FPDFText_FindStart(), which needs a UTF-16LE encoded string, given as unsigned short*:
```python
# (Assuming `text` is a str and `textpage` an FPDF_TEXTPAGE)
# Add the NUL terminator and encode as UTF-16LE
```
enc_text = (text + "\x00").encode("utf-16-le")
# cast `enc_text` to a c_ushort pointer
text_ptr = ctypes.cast(enc_text, ctypes.POINTER(ctypes.c_ushort))
search = pdfium_c.FPDFText_FindStart(textpage, text_ptr, 0, 0)
Leaving strings, let’s suppose you have a C memory buffer allocated by PDFium and wish to read its data. PDFium will provide you with a pointer to the first item of the byte array. To access the data, you’ll want to re-interpret the pointer as an array view with .from_address():
```python
# (Assuming `bitmap` is an FPDF_BITMAP and `size` is the expected number of bytes in the buffer)
# FPDFBitmap_GetBuffer() has c_void_p as restype, which ctypes will auto-resolve to int or None
```
buffer_ptrval = pdfium_c.FPDFBitmap_GetBuffer(bitmap)
assert buffer_ptrval  # make sure it's non-null
# Get an actual pointer object so we can access .contents
buffer_ptr = ctypes.cast(buffer_ptrval, ctypes.POINTER(ctypes.c_ubyte))
# Buffer as ctypes array (referencing the original buffer, will be unavailable as soon as the bitmap is destroyed)
c_buffer = (ctypes.c_ubyte * size).from_address( ctypes.addressof(buffer_ptr.contents) )
```python
# Buffer as Python bytes (independent copy)
```
py_buffer = bytes(c_buffer)
Note that you can achieve the same result with ctypes.cast(ptr, POINTER(type * size)).contents, but this is somewhat problematic since ctypes used to cache pointer types eternally with Python < 3.14 (as size may vary, this can lead to memory leak like scenarios with long-running applications).
Writing data from Python into a C buffer works in a similar fashion:
```python
# (Assuming `buffer_ptr` is a pointer to the first item of a C buffer to write into,
#  `size` the number of bytes it can store, and `py_buffer` a Python byte buffer)
```
buffer = (ctypes.c_ubyte * size).from_address( ctypes.addressof(buffer_ptr.contents) )
```python
# Read from the Python buffer, starting at its current position, directly into the C buffer
# (until the target is full or the end of the source is reached)
```
n_bytes = py_buffer.readinto(buffer)  # returns the number of bytes read
If you wish to check whether two objects returned by PDFium are the same, the is operator won’t help because ctypes does not have original object return (OOR), i.e. new, equivalent Python objects are created each time, although they might represent one and the same C object.6 That’s why you’ll want to use ctypes.addressof() to get the memory addresses of the underlying C object. For instance, this is used to avoid infinite loops on circular bookmark references when iterating through the document outline:
# (Assuming `pdf` is an FPDF_DOCUMENT)
seen = set()
bookmark = pdfium_c.FPDFBookmark_GetFirstChild(pdf, None)
while bookmark:
```python
    # bookmark is a pointer, so we need to use its `contents` attribute to get the object the pointer refers to
    # (otherwise we'd only get the memory address of the pointer itself, which would result in random behaviour)
```
    address = ctypes.addressof(bookmark.contents)
    if address in seen:
        break  # circular reference detected
    else:
        seen.add(address)
    bookmark = pdfium_c.FPDFBookmark_GetNextSibling(pdf, bookmark)
In many situations, callback functions come in handy.7 Thanks to ctypes, it is seamlessly possible to use callbacks across Python/C language boundaries.
Example: Loading a document from a Python buffer. This way, file access can be controlled in Python while the data does not need to be in memory at once.
```python
import os
# Factory class to create callable objects holding a reference to a Python buffer
class _reader_class:
  
  def __init__(self, py_buffer):
```
      self.py_buffer = py_buffer
  
```python
  def __call__(self, _, position, buffer_ptr, size):
      # Write data from Python buffer into C buffer, as explained before
```
      c_buffer = (ctypes.c_ubyte * size).from_address( ctypes.addressof(buffer_ptr.contents) )
      self.py_buffer.seek(position)
      self.py_buffer.readinto(c_buffer)
      return 1  # non-zero return code for success
```python
# (Assuming py_buffer is a Python file buffer, e. g. io.BufferedReader)
# Get the length of the buffer
```
py_buffer.seek(0, os.SEEK_END)
file_len = py_buffer.tell()
py_buffer.seek(0)
# Set up an interface structure for custom file access
fileaccess = pdfium_c.FPDF_FILEACCESS()
fileaccess.m_FileLen = file_len
# Assign the callback, wrapped in its CFUNCTYPE
fileaccess.m_GetBlock = type(fileaccess.m_GetBlock)( _reader_class(py_buffer) )
# Finally, load the document
pdf = pdfium_c.FPDF_LoadCustomDocument(fileaccess, None)
When using the raw API, special care needs to be taken regarding object lifetime, considering that Python may garbage collect objects as soon as their reference count reaches zero. However, the interpreter has no way of magically knowing how long the underlying resources of a Python object might still be needed on the C side, so measures need to be taken to keep such objects referenced until PDFium does not depend on them anymore.
If resources need to remain valid after the time of a function call, PDFium docs usually indicate this clearly. Ignoring requirements on object lifetime will lead to memory corruption (commonly resulting in a segfault sooner or later).
For instance, the docs on FPDF_LoadCustomDocument() state that
The application must keep the file resources |pFileAccess| points to valid until the returned FPDF_DOCUMENT is closed. |pFileAccess| itself does not need to outlive the FPDF_DOCUMENT.
This means that the callback function and the Python buffer need to be kept alive as long as the FPDF_DOCUMENT is used. This can be achieved by referencing these objects in an accompanying class, e. g.
```python
class PdfDataHolder:
    
    def __init__(self, buffer, function):
```
        self.buffer = buffer
        self.function = function
    
```python
    def close(self):
```
```python
        # Make sure both objects remain available until this function is called
        # No-op id() call to denote that the object needs to stay in memory up to this point
```
        id(self.function)
        self.buffer.close()
```python
# ... set up an FPDF_FILEACCESS structure
# (Assuming `py_buffer` is the buffer and `fileaccess` the FPDF_FILEACCESS interface)
```
data_holder = PdfDataHolder(py_buffer, fileaccess.m_GetBlock)
pdf = pdfium_c.FPDF_LoadCustomDocument(fileaccess, None)
```python
# ... work with the pdf
# Close the PDF to free resources
```
pdfium_c.FPDF_CloseDocument(pdf)
```python
# Close the data holder, to keep the object itself and thereby the objects it
# references alive up to this point, as well as to release the buffer
```
data_holder.close()
Finally, let’s finish this guide with an example how to render the first page of a document to a PIL image in RGBA color format.
```python
import math
import ctypes
import os.path
import PIL.Image
import pypdfium2.raw as pdfium_c
# Load the document
```
filepath = os.path.abspath("tests/resources/render.pdf")
pdf = pdfium_c.FPDF_LoadDocument((filepath+"\x00").encode("utf-8"), None)
# Check page count to make sure it was loaded correctly
page_count = pdfium_c.FPDF_GetPageCount(pdf)
assert page_count >= 1
# Load the first page and get its dimensions
page = pdfium_c.FPDF_LoadPage(pdf, 0)
width  = math.ceil(pdfium_c.FPDF_GetPageWidthF(page))
height = math.ceil(pdfium_c.FPDF_GetPageHeightF(page))
```python
# Create a bitmap
# (Note, pdfium is faster at rendering transparency if we use BGRA rather than BGRx)
```
use_alpha = pdfium_c.FPDFPage_HasTransparency(page)
bitmap = pdfium_c.FPDFBitmap_Create(width, height, int(use_alpha))
```python
# Fill the whole bitmap with a white background
# The color is given as a 32-bit integer in ARGB format (8 bits per channel)
```
pdfium_c.FPDFBitmap_FillRect(bitmap, 0, 0, width, height, 0xFFFFFFFF)
# Store common rendering arguments
render_args = (
    bitmap,  # the bitmap
    page,    # the page
    # positions and sizes are to be given in pixels and may exceed the bitmap
    0,       # left start position
    0,       # top start position
    width,   # horizontal size
    height,  # vertical size
    0,       # rotation (as constant, not in degrees!)
    pdfium_c.FPDF_LCD_TEXT | pdfium_c.FPDF_ANNOT,  # rendering flags, combined with binary or
)
# Render the page
pdfium_c.FPDF_RenderPageBitmap(*render_args)
# Get the value of a pointer to the first item of the buffer
buffer_ptrval = pdfium_c.FPDFBitmap_GetBuffer(bitmap)
assert buffer_ptrval, "buffer pointer value must be non-null"
# Cast the pointer value to an actual pointer object so we can access .contents
buffer_ptr = ctypes.cast(buffer_ptrval, ctypes.POINTER(ctypes.c_ubyte))
# Re-interpret as array
buffer = (ctypes.c_ubyte * (width * height * 4)).from_address(ctypes.addressof(buffer_ptr.contents))
# Create a PIL image from the buffer contents
img = PIL.Image.frombuffer("RGBA", (width, height), buffer, "raw", "BGRA", 0, 1)
# Save it as file
img.save("out.png")
# Free resources
pdfium_c.FPDFBitmap_Destroy(bitmap)
pdfium_c.FPDF_ClosePage(page)
pdfium_c.FPDF_CloseDocument(pdf)
```python
# Known limitations
## Incompatibility with Threading
```
PDFium is inherently not thread-safe. See the API docs for more information.
## Risk of unknown object lifetime violations
As outlined in the raw API section, it is essential that Python-managed resources remain available as long as they are needed by PDFium.
The problem is that the Python interpreter may garbage collect objects with reference count zero at any time, so it can happen that an unreferenced but still required object by chance stays around long enough before it is garbage collected. However, it could also disappear too soon and cause breakage. Such dangling objects result in non-deterministic memory issues that are hard to debug. If the timeframe between reaching reference count zero and removal is sufficiently large and roughly consistent across different runs, it is even possible that mistakes regarding object lifetime remain unnoticed for a long time.
Although we intend to develop helpers carefully, it cannot be fully excluded that unknown object lifetime violations might still be lurking around somewhere, especially if unexpected requirements were not documented by the time the code was written.
## Missing raw PDF access
As of this writing, PDFium’s public interface does not provide access to the raw PDF data structure (see issue 1694). It does not expose APIs to read/write PDF dictionaries, streams, name/number trees, etc. Instead, it merely offers a predefined set of abstracted functions. This considerably limits the library’s potential, compared to other products such as pikepdf.
## Limitations of ABI bindings
PDFium’s non-public backend would provide extended capabilities, including raw access, but it is written in C++, which (unlike pure C) does not result in a stable ABI, so we cannot use it with ctypes. This means it’s out of scope for this project.
Also, while ABI bindings tend to be more convenient, they have some technical drawbacks compared to API bindings (see e.g. 1, 2)