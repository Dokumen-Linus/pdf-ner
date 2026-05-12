INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, datatype, regex, exact_length, single_word
)
VALUES
(
  'case_num', 'Case Number', 'legal',
  'Unique identifier assigned to a legal case by a court',
  ARRAY['2024-CV-001234', '23-cv-01234', 'Case No. 2024-L-000123'],
  'alphanumeric', NULL, NULL, TRUE
),
(
  'pacer', 'PACER Case Number', 'legal',
  'Federal court case number accessible via the Public Access to Court Electronic Records system',
  ARRAY['1:24-cv-01234', '3:23-cr-00567-ABC', '2:22-bk-12345'],
   'alphanumeric', '\b\d:\d{2}-[a-z]{2}-\d{5}\b', NULL, TRUE
),
(
  'nos', 'Nature of Suit Code', 'legal',
  '3-digit code on a civil cover sheet classifying the type of federal lawsuit',
  ARRAY['110', '240', '470', '830'],
  'int', '\b\d{3}\b', 3, TRUE
),
(
  'usc', 'United States Code Citation', 'legal',
  'Citation to a section of the United States Code of federal law',
  ARRAY['42 U.S.C. § 1983', '18 U.S.C. § 1341', '26 U.S.C. § 501(c)(3)'],
  NULL, NULL, NULL, FALSE
),
(
  'cfr', 'Code of Federal Regulations Citation', 'legal',
  'Citation to a section of the Code of Federal Regulations',
  ARRAY['21 C.F.R. § 820.30', '29 C.F.R. § 1910.1200', '47 C.F.R. § 15.105'],
  NULL, NULL, NULL, FALSE
),
(
  'public_law_num', 'Public Law Number', 'legal',
  'Congressional designation for a law enacted by the US Congress',
  ARRAY['Pub. L. 111-148', 'P.L. 116-136', 'Public Law 104-191'],
   'alphanumeric', '\b\d{2,3}-\d{1,4}\b', NULL, FALSE
),
(
  'filing_code', 'Filing Code', 'legal',
  'Alphanumeric code identifying the type of legal document filed with a court',
  ARRAY['CV', 'CR', 'BK', 'COMP', 'MOT'],
  'alphanumeric', NULL, NULL, TRUE
),
(
   'patent_num', 'Patent Number', 'legal',
   'USPTO-assigned number uniquely identifying a granted patent',
   ARRAY['US10,123,456', 'US 8,456,789 B2', 'US2024/0123456'],
   'alphanumeric', '\bUS\s*(?:\d[\d,]*\s*(?:[A-Z]\d?)?|\d{4}/\d+)\b', NULL, TRUE
),
(
  'trademark_num', 'Trademark Registration Number', 'legal',
  'USPTO-assigned number for a registered trademark',
  ARRAY['5,123,456', 'Reg. No. 4,987,654', '6000001'],
  'int', '\b\d{7}\b', 7, TRUE
),
(
  'copyright_num', 'Copyright Registration Number', 'legal',
  'US Copyright Office registration number for a copyrighted work',
  ARRAY['TX 8-987-654', 'VA 2-123-456', 'TXu001234567'],
  'alphanumeric', NULL, NULL, TRUE
),
(
  'ucc', 'UCC Filing Number', 'legal',
  'State-assigned filing number for a UCC financing statement securing collateral',
  ARRAY['2024 0123456789', 'DE-2024-123456789', '202400001234'],
  'alphanumeric', NULL, NULL, FALSE
),
(
  'notary_seal', 'Notary Commission Number', 'legal',
  'Number assigned to a notary public''s official commission or seal',
  ARRAY['Commission No. 2345678', 'Notary ID: 12345', '98765432'],
  'alphanumeric', NULL, NULL, TRUE
);
