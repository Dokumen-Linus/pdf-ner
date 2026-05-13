INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, datatype, regex, exact_length, single_word
)
VALUES
(
  'address', 'Street Address', 'location',
  'Full street address including house number, street name, and optional unit identifier',
  ARRAY['123 Main St', '456 Oak Avenue, Apt 2B', '789 Washington Blvd Suite 100'],
  NULL, NULL, NULL, FALSE
),
(
  'city', 'City', 'location',
  'Name of a city or municipality',
  ARRAY['New York', 'Los Angeles', 'Chicago', 'Springfield'],
  'alpha', NULL, NULL, FALSE
),
(
  'state', 'State or Province', 'location',
  'US state, Canadian province, or equivalent administrative division',
  ARRAY['California', 'CA', 'Ontario', 'Texas', 'TX'],
  'alpha', NULL, NULL, TRUE
),
(
  'country', 'Country', 'location',
  'Name or code of a sovereign nation',
  ARRAY['United States', 'US', 'USA', 'Canada', 'Germany', 'DE'],
  'alpha', NULL, NULL, FALSE
),
(
  'county', 'County', 'location',
  'Administrative subdivision of a US state or similar jurisdiction',
  ARRAY['Los Angeles County', 'Cook County', 'Fairfax County'],
  'alpha', NULL, NULL, FALSE
),
(
  'zip_code', 'ZIP Code', 'location',
  'US postal code used for mail routing',
  ARRAY['90210', '10001', '94102-1234'],
   'alphanumeric', '^\d{5}(-\d{4})?$', NULL, TRUE
),
(
  'coordinates', 'Geographic Coordinates', 'location',
  'Latitude and longitude pair identifying a geographic location',
  ARRAY['40.7128° N, 74.0060° W', '34.0522, -118.2437', '(37.7749, -122.4194)'],
  NULL, NULL, NULL, FALSE
);
