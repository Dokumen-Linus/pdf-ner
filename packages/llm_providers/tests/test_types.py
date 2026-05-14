from dokumen_llm_providers import LLMResponseData


class TestLLMResponseData:
    def test_creates_with_all_fields(self):
        data = LLMResponseData(text="hello", input_tokens=10, output_tokens=20)
        assert data.text == "hello"
        assert data.input_tokens == 10
        assert data.output_tokens == 20

    def test_accepts_zero_tokens(self):
        data = LLMResponseData(text="", input_tokens=0, output_tokens=0)
        assert data.text == ""
        assert data.input_tokens == 0
        assert data.output_tokens == 0
