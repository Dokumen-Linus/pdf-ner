INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, datatype, regex, exact_length, single_word
)
VALUES
(
   'lab_accession_num', 'Lab Accession Number', 'pharma',
  'Unique identifier assigned to a laboratory specimen or test order',
  ARRAY['ACC2024031500001', 'LAB-123456-A', '2024-00123456'],
  'alphanumeric', NULL, NULL, TRUE
),
(
  'clia', 'CLIA Number', 'pharma',
  'CMS-issued certificate number for clinical laboratories under the Clinical Laboratory Improvement Amendments',
  ARRAY['01D2345678', '36D0987654', '05D1234567'],
   'alphanumeric', '\b\d{2}D\d{7}\b', 10, TRUE
),
(
  'spl_id', 'Structured Product Labeling ID', 'pharma',
  'FDA document identifier for structured product labeling submissions',
  ARRAY['d76e0e97-b4f6-40c2-af46-03c5b24c6bb8', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
  'alphanumeric', '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 36, TRUE
);
