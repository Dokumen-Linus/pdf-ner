INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, format_description, datatype, regex, exact_length, single_word
)
VALUES
(
  'dollar_val', 'Dollar Value', 'formatted numbers',
  'Monetary amount expressed in US dollars',
  ARRAY['$1,234.56', '$99.99', '$1.2M', '$10'],
  'Prefixed with dollar sign; may include commas as thousands separators and abbreviations like K, M, B',
   'float', '\$[\d,]+(\.\d{1,2})?(?:[KMB])?', NULL, TRUE
),
(
  'currency_val', 'Currency Value', 'formatted numbers',
  'Monetary amount in any currency, with or without currency symbol',
  ARRAY['€1,234.56', '¥10,000', '£99.99', 'CAD 50.00'],
  'May include ISO currency code (EUR, GBP) or currency symbol; format varies by locale',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'percent_val', 'Percentage Value', 'formatted numbers',
  'Numeric value expressed as a percentage',
  ARRAY['15%', '3.5%', '100%', '0.5%'],
  'Number followed by percent sign; may include decimals',
  'float', '\d+(\.\d+)?%', NULL, TRUE
);
