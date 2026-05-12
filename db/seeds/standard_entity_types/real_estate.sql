INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, datatype, regex, exact_length, single_word
)
VALUES
(
  'aspn', 'Assessor''s Parcel Number', 'real estate',
  'Local government identifier for a specific parcel of real property',
  ARRAY['123-456-78', '5143-018-014', '02-34-000-001-0000'],
  'alphanumeric', NULL, NULL, TRUE
),
(
  'deed_type_code', 'Deed Type Code', 'real estate',
  'Code identifying the type of real property deed used in a transaction',
  ARRAY['GWD', 'QCD', 'WD', 'TD', 'SWD'],
  'alpha', NULL, NULL, TRUE
),
(
  'instrument_num', 'Instrument Number', 'real estate',
  'Recording number assigned to a legal document by the county recorder''s office',
  ARRAY['2024-012345', '20240315001234', 'DOC# 2024-001234'],
  'alphanumeric', NULL, NULL, TRUE
),
(
  'mortgage_id', 'Mortgage Identification Number', 'real estate',
  'Unique identifier assigned to a registered mortgage or deed of trust',
  ARRAY['1000157-0000000-9', '100016200000000008', 'MIN 1000157-0000000-9'],
  'alphanumeric', NULL, NULL, TRUE
);
