INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, datatype, regex, exact_length, single_word
)
VALUES
(
  'currency', 'Currency Code', 'finance',
  'ISO 4217 three-letter code representing a currency',
  ARRAY['USD', 'EUR', 'GBP', 'JPY', 'CAD'],
  'alpha', '\b[A-Z]{3}\b', 3, TRUE
),
(
  'ein', 'Employer Identification Number', 'finance',
  'IRS-issued tax identification number for US businesses, also called FEIN',
  ARRAY['12-3456789', '98-7654321'],
  'alphanumeric', '\b\d{2}-\d{7}\b', 9, TRUE
),
(
  'itin', 'Individual Taxpayer Identification Number', 'finance',
  'IRS-issued tax ID for individuals not eligible for a Social Security Number',
  ARRAY['900-70-0000', '9XX-70-XXXX'],
  'alphanumeric', '\b9\d{2}[-\s]?\d{2}[-\s]?\d{4}\b', 9, FALSE
),
(
  'iban', 'International Bank Account Number', 'finance',
  'Standardized international identifier for a bank account',
  ARRAY['GB29NWBK60161331926819', 'DE89370400440532013000', 'FR7614508590001308400002'],
  'alphanumeric', '[A-Z]{2}\d{2}[A-Z0-9]{1,30}', NULL, TRUE
),
(
  'bic', 'Bank Identifier Code', 'finance',
  'SWIFT/BIC code uniquely identifying a bank for international wire transfers',
  ARRAY['NWBKGB2L', 'DEUTDEDB', 'BOFAUS3N'],
  'alphanumeric', '[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?', NULL, TRUE
),
(
  'bank_acct', 'Bank Account Number', 'finance',
  'Unique number identifying a bank account at a financial institution',
  ARRAY['123456789', '000012345678', '87654321'],
  'alphanumeric', NULL, NULL, TRUE
),
(
  'rtn', 'ABA Routing Transit Number', 'finance',
  'Nine-digit code identifying a US financial institution for wire transfers and ACH transactions',
  ARRAY['021000021', '322271627', '026009593'],
  'int', '\b\d{9}\b', 9, TRUE
),
(
  'ticker', 'Stock Ticker Symbol', 'finance',
  'Abbreviated alphanumeric code identifying a publicly traded company on a stock exchange',
  ARRAY['AAPL', 'MSFT', 'GOOG', 'BRK.B', 'SPY'],
  'alpha', '\b[A-Z]{1,5}(\.[A-Z])?\b', NULL, TRUE
),
(
  'isin', 'International Securities Identification Number', 'finance',
  '12-character alphanumeric code uniquely identifying a security worldwide',
  ARRAY['US0378331005', 'GB0002634946', 'DE0005140008'],
  'alphanumeric', '[A-Z]{2}[A-Z0-9]{9}\d', 12, TRUE
),
(
  'cusip', 'CUSIP Number', 'finance',
  'Nine-character alphanumeric identifier for North American financial securities',
  ARRAY['037833100', '594918104', '912828ZT0'],
  'alphanumeric', '[A-Z0-9]{9}', 9, TRUE
),
(
  'figi', 'Financial Instrument Global Identifier', 'finance',
  '12-character alphanumeric code for uniquely identifying financial instruments globally',
  ARRAY['BBG000B9XRY4', 'BBG000BLNNH6', 'BBG00625LGGG'],
  'alphanumeric', 'BBG[A-Z0-9]{9}', 12, TRUE
),
(
  'effective_date', 'Effective Date', 'finance',
  'Date on which a contract, policy, or financial instrument becomes active',
  ARRAY['Effective: January 1, 2024', 'Effective Date: 01/01/2024', '2024-01-01'],
  NULL, NULL, NULL, FALSE
);
