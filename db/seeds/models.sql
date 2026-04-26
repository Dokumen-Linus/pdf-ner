-- Re-runnable: ON CONFLICT updates pricing in place
INSERT INTO public.models (id, provider, usd_per_1m_input, usd_per_1m_output, release_date) VALUES

-- Anthropic
('claude-opus-4-6',            'anthropic', 15.00,  75.00,  '2026-01-01'),
('claude-sonnet-4-6',          'anthropic',  3.00,  15.00,  '2026-01-01'),
('claude-opus-4-5',            'anthropic', 15.00,  75.00,  '2025-06-01'),
('claude-sonnet-4-5',          'anthropic',  3.00,  15.00,  '2025-06-01'),

-- OpenAI
('gpt-4o',                     'openai',     2.50,  10.00,  '2024-05-13'),

-- Gemini
('gemini-2.0-flash',           'gemini',     0.10,   0.40,  '2025-02-05')

ON CONFLICT (id) DO UPDATE SET
    provider          = EXCLUDED.provider,
    usd_per_1m_input  = EXCLUDED.usd_per_1m_input,
    usd_per_1m_output = EXCLUDED.usd_per_1m_output,
    release_date      = EXCLUDED.release_date;
