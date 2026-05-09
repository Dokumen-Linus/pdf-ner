INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, format_description, datatype, regex, exact_length, single_word
)
VALUES
(
  'currency', 'Currency Code', 'finance',
  'ISO 4217 three-letter code representing a currency',
  ARRAY['USD', 'EUR', 'GBP', 'JPY', 'CAD'],
  'Three uppercase letters per ISO 4217 standard',
  'alpha', '\b[A-Z]{3}\b', 3, TRUE
),
(
  'ein', 'Employer Identification Number', 'finance',
  'IRS-issued tax identification number for US businesses, also called FEIN',
  ARRAY['12-3456789', '98-7654321'],
  '9 digits formatted as XX-XXXXXXX with a required hyphen between the 2nd and 3rd digits',
  'alphanumeric', '\b\d{2}-\d{7}\b', 9, TRUE
),
(
  'itin', 'Individual Taxpayer Identification Number', 'finance',
  'IRS-issued tax ID for individuals not eligible for a Social Security Number',
  ARRAY['900-70-0000', '9XX-70-XXXX'],
  '9 digits formatted like an SSN (NNN-NN-NNNN) but always begins with 9',
  'alphanumeric', '\b9\d{2}[-\s]?\d{2}[-\s]?\d{4}\b', 9, FALSE
),
(
  'iban', 'International Bank Account Number', 'finance',
  'Standardized international identifier for a bank account',
  ARRAY['GB29NWBK60161331926819', 'DE89370400440532013000', 'FR7614508590001308400002'],
  'Starts with 2-letter country code, 2 check digits, then up to 30 alphanumeric characters; total 15-34 characters',
  'alphanumeric', '[A-Z]{2}\d{2}[A-Z0-9]{1,30}', NULL, TRUE
),
(
  'bic', 'Bank Identifier Code', 'finance',
  'SWIFT/BIC code uniquely identifying a bank for international wire transfers',
  ARRAY['NWBKGB2L', 'DEUTDEDB', 'BOFAUS3N'],
  '8 or 11 alphanumeric characters: 4-letter bank code, 2-letter country code, 2-char location code, optional 3-char branch code',
  'alphanumeric', '[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?', NULL, TRUE
),
(
  'bank_acct', 'Bank Account Number', 'finance',
  'Unique number identifying a bank account at a financial institution',
  ARRAY['123456789', '000012345678', '87654321'],
  'Typically 8-17 digits for US accounts; format varies by bank and country',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'rtn', 'ABA Routing Transit Number', 'finance',
  'Nine-digit code identifying a US financial institution for wire transfers and ACH transactions',
  ARRAY['021000021', '322271627', '026009593'],
  'Exactly 9 digits; first 4 identify the Federal Reserve district, next 4 the bank, last is a check digit',
  'int', '\b\d{9}\b', 9, TRUE
),
(
  'ticker', 'Stock Ticker Symbol', 'finance',
  'Abbreviated alphanumeric code identifying a publicly traded company on a stock exchange',
  ARRAY['AAPL', 'MSFT', 'GOOG', 'BRK.B', 'SPY'],
  '1-5 uppercase letters, sometimes with a dot and additional letter for share class',
  'alpha', '\b[A-Z]{1,5}(\.[A-Z])?\b', NULL, TRUE
),
(
  'isin', 'International Securities Identification Number', 'finance',
  '12-character alphanumeric code uniquely identifying a security worldwide',
  ARRAY['US0378331005', 'GB0002634946', 'DE0005140008'],
  '2-letter country code, 9-character national security identifier, 1 check digit; always 12 characters',
  'alphanumeric', '[A-Z]{2}[A-Z0-9]{9}\d', 12, TRUE
),
(
  'cusip', 'CUSIP Number', 'finance',
  'Nine-character alphanumeric identifier for North American financial securities',
  ARRAY['037833100', '594918104', '912828ZT0'],
  '6-character issuer code, 2-character issue number, 1 check digit; always 9 alphanumeric characters',
  'alphanumeric', '[A-Z0-9]{9}', 9, TRUE
),
(
  'figi', 'Financial Instrument Global Identifier', 'finance',
  '12-character alphanumeric code for uniquely identifying financial instruments globally',
  ARRAY['BBG000B9XRY4', 'BBG000BLNNH6', 'BBG00625LGGG'],
  'Always starts with BBG, followed by 9 alphanumeric characters; total 12 characters',
  'alphanumeric', 'BBG[A-Z0-9]{9}', 12, TRUE
),
(
  'effective_date', 'Effective Date', 'finance',
  'Date on which a contract, policy, or financial instrument becomes active',
  ARRAY['Effective: January 1, 2024', 'Effective Date: 01/01/2024', '2024-01-01'],
  'A date value specifically labeled or contextually identified as when an agreement or rate takes effect',
  NULL, NULL, NULL, FALSE
);
