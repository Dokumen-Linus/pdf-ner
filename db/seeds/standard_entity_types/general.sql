INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, format_description, datatype, regex, exact_length, single_word
)
VALUES
(
  'name', 'Person Name', 'general',
  'Full or partial name of an individual person',
  ARRAY['John Smith', 'Mary Jane Watson', 'Dr. James Brown Jr.'],
   'May include titles (Dr., Mr.), suffixes (Jr., III), and middle names or initials',
   'alphanumeric', NULL, NULL, FALSE
),
(
  'email', 'Email Address', 'general',
  'Electronic mail address in standard format',
  ARRAY['user@example.com', 'john.doe+work@company.org'],
  'Format: local-part@domain, where domain includes at least one dot',
  'alphanumeric', '[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', NULL, TRUE
),
(
  'phone_num', 'Phone Number', 'general',
  'Telephone number for voice or text communication',
  ARRAY['(555) 867-5309', '+1-800-555-0199', '555.123.4567'],
  'May include country code, area code, and extension; digits may be separated by spaces, dashes, or dots',
   'alphanumeric', '^(?=.*\d)\+?[\d\s\-().]{7,20}$', NULL, FALSE
),
(
  'url', 'URL', 'general',
  'Uniform Resource Locator identifying a web address or resource',
  ARRAY['https://www.example.com', 'http://docs.company.com/api/v1'],
  'Typically begins with http:// or https:// followed by domain and optional path',
  'alphanumeric', 'https?://[^\s]+', NULL, TRUE
),
(
  'company', 'Company Name', 'general',
  'Name of a business, organization, or corporate entity',
  ARRAY['Acme Corp.', 'Google LLC', 'The Walt Disney Company'],
  'May include legal suffixes such as Inc., LLC, Corp., Ltd., or Co.',
  NULL, NULL, NULL, FALSE
);