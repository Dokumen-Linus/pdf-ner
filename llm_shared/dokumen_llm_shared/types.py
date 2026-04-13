from dataclasses import dataclass


@dataclass
class LLMResponseData:
    text: str
    input_tokens: int
    output_tokens: int
