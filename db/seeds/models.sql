-- Re-runnable: ON CONFLICT updates pricing in place
INSERT INTO public.models (id, provider, usd_per_1m_input, usd_per_1m_output, available_date) VALUES

-- Anthropic
('claude-opus-4-6',            'anthropic', 15.00,  75.00,  '2026-01-01'),
('claude-sonnet-4-6',          'anthropic',  3.00,  15.00,  '2026-01-01'),
('claude-opus-4-5',            'anthropic', 15.00,  75.00,  '2025-06-01'),
('claude-sonnet-4-5',          'anthropic',  3.00,  15.00,  '2025-06-01'),
('claude-haiku-4-5-20251001',  'anthropic',  0.80,   4.00,  '2025-10-01'),
('claude-3-5-sonnet-20241022', 'anthropic',  3.00,  15.00,  '2024-10-22'),
('claude-3-5-haiku-20241022',  'anthropic',  0.80,   4.00,  '2024-10-22'),
('claude-3-opus-20240229',     'anthropic', 15.00,  75.00,  '2024-02-29'),

-- OpenAI
('gpt-4o',                     'openai',     2.50,  10.00,  '2024-05-13'),
('gpt-4o-mini',                'openai',     0.15,   0.60,  '2024-07-18'),
('gpt-4-turbo',                'openai',    10.00,  30.00,  '2024-04-09'),
('gpt-4-turbo-preview',        'openai',    10.00,  30.00,  '2024-01-25'),
('o1',                         'openai',    15.00,  60.00,  '2024-12-17'),
('o1-mini',                    'openai',     3.00,  12.00,  '2024-09-12'),
('o3-mini',                    'openai',     1.10,   4.40,  '2025-01-31'),
('o3',                         'openai',    10.00,  40.00,  '2025-04-16'),

-- Google
('gemini-2.0-flash',           'google',     0.10,   0.40,  '2025-02-05'),
('gemini-2.0-flash-lite',      'google',     0.075,  0.30,  '2025-03-01'),
('gemini-1.5-pro',             'google',     1.25,   5.00,  '2024-04-09'),
('gemini-1.5-flash',           'google',     0.075,  0.30,  '2024-05-24'),
('gemini-1.5-flash-8b',        'google',     0.0375, 0.15,  '2024-10-03')

ON CONFLICT (id) DO UPDATE SET
    provider          = EXCLUDED.provider,
    usd_per_1m_input  = EXCLUDED.usd_per_1m_input,
    usd_per_1m_output = EXCLUDED.usd_per_1m_output,
    available_date    = EXCLUDED.available_date;
