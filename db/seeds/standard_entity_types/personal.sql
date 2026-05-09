INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, format_description, datatype, regex, exact_length, single_word
)
VALUES
(
  'ssn', 'Social Security Number', 'personal',
  'US government-issued nine-digit identification number for individuals',
  ARRAY['123-45-6789', '123 45 6789', '123456789'],
  '9 digits formatted as AAA-BB-CCCC where groups may be separated by dashes or spaces',
  'alphanumeric', '\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b', 9, FALSE
),
(
  'drivers_license', 'Driver''s License Number', 'personal',
  'State-issued driver''s license identification number',
  ARRAY['D1234567', 'A123-456-789-01', 'S12345678901'],
  'Format varies by US state; typically alphanumeric, 6-14 characters',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'passport_num', 'Passport Number', 'personal',
  'Unique identifier on a government-issued passport',
  ARRAY['A12345678', '123456789', 'AB1234567'],
  'US passports are 9 alphanumeric characters; format varies by country',
  'alphanumeric', '[A-Z0-9]{6,9}', NULL, TRUE
),
(
  'state_id_num', 'State ID Number', 'personal',
  'State-issued identification card number for non-driver identification',
  ARRAY['ID1234567', 'S987654321'],
  'Format varies by US state; similar to driver''s license number',
  'alphanumeric', NULL, NULL, TRUE
);
