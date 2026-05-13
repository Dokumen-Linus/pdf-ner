INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, datatype, regex, exact_length, single_word
)
VALUES
(
  'date', 'Date', 'time',
  'Calendar date representing a specific day',
  ARRAY['January 1, 2022', '01/02/22', '2024-03-15', 'March 15th'],
  NULL, NULL, NULL, FALSE
),
(
  'time', 'Time of Day', 'time',
  'Time of day expressed in hours and minutes, optionally with seconds',
  ARRAY['3:45 PM', '14:30', '09:00:00', '11:59 AM'],
   NULL, '(?i)\b(?:(?:0?[1-9]|1[0-2]):[0-5][0-9](?::[0-5][0-9])?\s?[AP]M|(?:[01]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?)\b', NULL, FALSE
),
(
  'datetime', 'Date and Time', 'time',
  'Combined date and time value representing a specific moment',
  ARRAY['2024-03-15T14:30:00', 'March 15, 2024 at 2:30 PM', '03/15/2024 14:30'],
  NULL, NULL, NULL, FALSE
),
(
  'duration', 'Duration', 'time',
  'Length of time between two events or a span of time',
  ARRAY['2 hours 30 minutes', '3 days', '45 minutes', 'PT1H30M'],
  NULL, NULL, NULL, FALSE
),
(
  'year', 'Year', 'time',
  'Four-digit calendar year',
  ARRAY['2024', '1999', '2000'],
  'int', '\d{4}', 4, TRUE
),
(
  'month', 'Month', 'time',
  'Calendar month expressed as a name or number',
  ARRAY['January', 'Feb', '03', '3', 'March'],
   NULL, '(?i)^(Jan(uary)?|Feb(ruary)?|Mar(ch)?|Apr(il)?|May|Jun(e)?|Jul(y)?|Aug(ust)?|Sep(t(ember)?)?|Oct(ober)?|Nov(ember)?|Dec(ember)?|0?[1-9]|1[0-2])$', NULL, TRUE
),
(
  'weekday', 'Day of the Week', 'time',
  'Named day of the week',
  ARRAY['Monday', 'Wed', 'Friday', 'Tues', 'Thurs'],
  'alpha', '(?i)\b(?:Mon(?:day)?|Tue(?:s|sday)?|Wed(?:nesday)?|Thu(?:rs|rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\b', NULL, TRUE
);