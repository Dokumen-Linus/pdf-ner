import pytest

from pdf_ocr_utils.config import DEFAULT_OCR_CONFIG, DEFAULT_RENDER_CONFIG
from pdf_ocr_utils.types import OcrConfig, RenderConfig


class TestConfigTypes:
    def test_default_render_config_values(self):
        cfg = RenderConfig()
        assert cfg.scale == 2.0
        assert cfg.grayscale is False
        assert cfg.rev_byteorder is True

    def test_custom_render_config(self):
        cfg = RenderConfig(scale=3.0, grayscale=True, rev_byteorder=False)
        assert cfg.scale == 3.0
        assert cfg.grayscale is True
        assert cfg.rev_byteorder is False

    def test_default_ocr_config_values(self):
        cfg = OcrConfig()
        assert cfg.lang == "eng"
        assert cfg.config == "--oem 3 --psm 6"
        assert cfg.timeout is None

    def test_custom_ocr_config(self):
        cfg = OcrConfig(lang="fra", config="--psm 4", timeout=30.0)
        assert cfg.lang == "fra"
        assert cfg.config == "--psm 4"
        assert cfg.timeout == 30.0

    def test_module_level_defaults_are_correct_types(self):
        assert isinstance(DEFAULT_RENDER_CONFIG, RenderConfig)
        assert isinstance(DEFAULT_OCR_CONFIG, OcrConfig)
        assert DEFAULT_RENDER_CONFIG.scale == 2.0
        assert DEFAULT_OCR_CONFIG.lang == "eng"
