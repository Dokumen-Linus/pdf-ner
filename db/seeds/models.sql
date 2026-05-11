INSERT INTO public.chat_models (id, display_name, host, usd_per_1m_input, usd_per_1m_output, release_date) VALUES

('gpt-5.5','GPT-5.5 Pro','OpenAI','30','180','2026-04-24'),
('gpt-5.5','GPT-5.5','OpenAI','5','30','2026-04-24'),
('gpt-5.4','GPT-5.4','OpenAI','2.5','15','2026-03-05'),
('gpt-5.4-mini','GPT-5.4 Mini','OpenAI','0.75','4.5','2026-03-17'),
('gpt-5.4-nano','GPT-5.4 Nano','OpenAI','0.2','1.25','2026-03-17'),
('claude-opus-4-7','Opus 4.7','Anthropic','5','25','2026-04-16'),
('claude-opus-4-6','Opus 4.6','Anthropic','5','25','2026-02-05'),
('claude-opus-4-5','Opus 4.5','Anthropic','5','25','2025-11-24'),
('claude-sonnet-4-6','Sonnet 4.6','Anthropic','3','15','2026-02-17'),
('claude-haiku-4-5','Haiku 4.5','Anthropic','1','5','2025-10-15'),
('gemini-3.1-flash-lite','Gemini 3.1 Flash-Lite','Google','0.25','1.5','2026-05-07'),
('gemini-3.1-pro-preview','Gemini 3.1 Pro Preview','Google','4','18','2026-02-19'),

ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    host = EXCLUDED.host,
    usd_per_1m_input = EXCLUDED.usd_per_1m_input,
    usd_per_1m_output = EXCLUDED.usd_per_1m_output,
    release_date = EXCLUDED.release_date;

INSERT INTO public.ocr_methods (id, display_name, method_type, usd_per_1m_pages, usd_per_sec, release_date) VALUES

('pdfium','Google PDFium','engine','10',NULL,'2014-05-22'),
('tesseract','Google Tesseract','engine','30',NULL,'2006-06-17'),
('deepseek-ocr','DeepSeek OCR','gpu',NULL,'0.0032','2025-10-20'),
('olm-ocr2','Allen AI olmOCR 2','gpu',NULL,'0.0032','2025-10-22'),

ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    method_type = EXCLUDED.method_type,
    usd_per_1m_pages = EXCLUDED.usd_per_1m_pages,
    usd_per_sec = EXCLUDED.usd_per_sec,
    release_date = EXCLUDED.release_date;
