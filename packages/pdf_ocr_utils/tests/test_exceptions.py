from pdf_ocr_utils.exceptions import OcrExecutionError, PdfOcrError, PdfRenderError


class TestExceptions:
    def test_pdf_ocr_error_is_base(self):
        assert issubclass(PdfRenderError, PdfOcrError)
        assert issubclass(OcrExecutionError, PdfOcrError)

    def test_pdf_render_error_is_raiseable(self):
        err = PdfRenderError("render failed")
        assert isinstance(err, PdfOcrError)
        assert str(err) == "render failed"

    def test_ocr_execution_error_is_raiseable(self):
        err = OcrExecutionError("ocr failed")
        assert isinstance(err, PdfOcrError)
        assert str(err) == "ocr failed"

    def test_all_in_exception_hierarchy(self):
        try:
            raise PdfRenderError("test")
        except PdfOcrError:
            pass
        else:
            pytest.fail("PdfRenderError not caught by PdfOcrError")

    def test_ocr_execution_error_caught_by_base(self):
        try:
            raise OcrExecutionError("test")
        except PdfOcrError:
            pass
        else:
            pytest.fail("OcrExecutionError not caught by PdfOcrError")
