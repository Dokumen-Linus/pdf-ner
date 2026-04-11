INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, format_description, datatype, regex, exact_length, single_word
)
VALUES
-- general
(
  'name', 'Person Name', 'general',
  'Full or partial name of an individual person',
  ARRAY['John Smith', 'Mary Jane Watson', 'Dr. James Brown Jr.'],
  'May include titles (Dr., Mr.), suffixes (Jr., III), and middle names or initials',
  'alpha', NULL, NULL, FALSE
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
  'alphanumeric', '\+?[\d\s\-().]{7,20}', NULL, FALSE
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
),

-- time
(
  'date', 'Date', 'time',
  'Calendar date representing a specific day',
  ARRAY['January 1, 2022', '01/02/22', '2024-03-15', 'March 15th'],
  'May be in ISO 8601 (YYYY-MM-DD), US (MM/DD/YYYY), or written formats with month names',
  NULL, NULL, NULL, FALSE
),
(
  'time', 'Time of Day', 'time',
  'Time of day expressed in hours and minutes, optionally with seconds',
  ARRAY['3:45 PM', '14:30', '09:00:00', '11:59 AM'],
  'May use 12-hour (AM/PM) or 24-hour format, with optional seconds',
  NULL, '\d{1,2}:\d{2}(:\d{2})?(\s?[AP]M)?', NULL, FALSE
),
(
  'datetime', 'Date and Time', 'time',
  'Combined date and time value representing a specific moment',
  ARRAY['2024-03-15T14:30:00', 'March 15, 2024 at 2:30 PM', '03/15/2024 14:30'],
  'Combines date and time components, often with a separator such as T or a space',
  NULL, NULL, NULL, FALSE
),
(
  'duration', 'Duration', 'time',
  'Length of time between two events or a span of time',
  ARRAY['2 hours 30 minutes', '3 days', '45 minutes', 'PT1H30M'],
  'May be expressed in natural language or ISO 8601 duration format (e.g., PT1H30M)',
  NULL, NULL, NULL, FALSE
),
(
  'year', 'Year', 'time',
  'Four-digit calendar year',
  ARRAY['2024', '1999', '2000'],
  'Typically a 4-digit number representing a calendar year',
  'int', '\b(19|20)\d{2}\b', 4, TRUE
),
(
  'month', 'Month', 'time',
  'Calendar month expressed as a name or number',
  ARRAY['January', 'Feb', '03', 'March'],
  'May be full name, 3-letter abbreviation, or numeric (01-12)',
  NULL, NULL, NULL, TRUE
),
(
  'weekday', 'Day of the Week', 'time',
  'Named day of the week',
  ARRAY['Monday', 'Wed', 'Friday', 'Tue'],
  'May be full name or 3-letter abbreviation',
  'alpha', '\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b', NULL, TRUE
),
(
  'created_date', 'Created Date', 'time',
  'Date on which a document, record, or item was created',
  ARRAY['Created: 01/15/2024', 'Date Created: March 1, 2023'],
  'A date value specifically labeled or contextually identified as the creation date of a document or record',
  NULL, NULL, NULL, FALSE
),

-- location
(
  'address', 'Street Address', 'location',
  'Full street address including house number, street name, and optional unit identifier',
  ARRAY['123 Main St', '456 Oak Avenue, Apt 2B', '789 Washington Blvd Suite 100'],
  'Typically starts with a number followed by street name and optional unit identifier',
  NULL, NULL, NULL, FALSE
),
(
  'city', 'City', 'location',
  'Name of a city or municipality',
  ARRAY['New York', 'Los Angeles', 'Chicago', 'Springfield'],
  NULL,
  'alpha', NULL, NULL, FALSE
),
(
  'state', 'State or Province', 'location',
  'US state, Canadian province, or equivalent administrative division',
  ARRAY['California', 'CA', 'Ontario', 'Texas', 'TX'],
  'May be full name or 2-letter abbreviation for US states',
  'alpha', NULL, NULL, TRUE
),
(
  'country', 'Country', 'location',
  'Name or code of a sovereign nation',
  ARRAY['United States', 'US', 'USA', 'Canada', 'Germany', 'DE'],
  'May be full name, ISO 2-letter code (US), or ISO 3-letter code (USA)',
  'alpha', NULL, NULL, FALSE
),
(
  'county', 'County', 'location',
  'Administrative subdivision of a US state or similar jurisdiction',
  ARRAY['Los Angeles County', 'Cook County', 'Fairfax County'],
  'Typically includes the word ''County'' after the name in US contexts',
  'alpha', NULL, NULL, FALSE
),
(
  'zip_code', 'ZIP Code', 'location',
  'US postal code used for mail routing',
  ARRAY['90210', '10001', '94102-1234'],
  '5-digit US ZIP code, optionally followed by a hyphen and 4-digit extension (ZIP+4)',
  'alphanumeric', '\b\d{5}(-\d{4})?\b', NULL, TRUE
),
(
  'coordinates', 'Geographic Coordinates', 'location',
  'Latitude and longitude pair identifying a geographic location',
  ARRAY['40.7128° N, 74.0060° W', '34.0522, -118.2437', '(37.7749, -122.4194)'],
  'Expressed as decimal degrees or DMS notation; latitude ranges -90 to 90, longitude -180 to 180',
  NULL, NULL, NULL, FALSE
),

-- formatted numbers
(
  'dollar_val', 'Dollar Value', 'formatted numbers',
  'Monetary amount expressed in US dollars',
  ARRAY['$1,234.56', '$99.99', '$1.2M', '$10'],
  'Prefixed with dollar sign; may include commas as thousands separators and abbreviations like K, M, B',
  'float', '\$[\d,]+(\.\d{2})?', NULL, TRUE
),
(
  'currency_val', 'Currency Value', 'formatted numbers',
  'Monetary amount in any currency, with or without currency symbol',
  ARRAY['€1,234.56', '¥10,000', '£99.99', 'CAD 50.00'],
  'May include ISO currency code (EUR, GBP) or currency symbol; format varies by locale',
  'float', NULL, NULL, TRUE
),
(
  'percent_val', 'Percentage Value', 'formatted numbers',
  'Numeric value expressed as a percentage',
  ARRAY['15%', '3.5%', '100%', '0.5%'],
  'Number followed by percent sign; may include decimals',
  'float', '\d+(\.\d+)?%', NULL, TRUE
),

-- personal
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
),

-- measurements
(
  'speed', 'Speed', 'measurements',
  'Rate of motion expressed with a numeric value and unit',
  ARRAY['60 mph', '100 km/h', '30 m/s', '5 knots'],
  'Numeric value followed by unit such as mph, km/h, m/s, or knots',
  'float', NULL, NULL, FALSE
),
(
  'weight', 'Weight', 'measurements',
  'Mass or weight expressed with a numeric value and unit',
  ARRAY['150 lbs', '68 kg', '2.5 tons', '500 g'],
  'Numeric value followed by unit such as lbs, kg, g, oz, or tons',
  'float', NULL, NULL, FALSE
),
(
  'length', 'Length, Height, or Width', 'measurements',
  'Linear measurement of length, height, or width with numeric value and unit',
  ARRAY['6 ft', '180 cm', '12 inches', '3.5 m'],
  'Numeric value followed by unit such as ft, in, cm, m, mm, or yd',
  'float', NULL, NULL, FALSE
),
(
  'volume', 'Volume', 'measurements',
  'Three-dimensional measurement of capacity or space with numeric value and unit',
  ARRAY['2 liters', '500 mL', '1 gallon', '3 fl oz'],
  'Numeric value followed by unit such as L, mL, gal, fl oz, or cc',
  'float', NULL, NULL, FALSE
),
(
  'area', 'Area', 'measurements',
  'Two-dimensional measurement of surface size with numeric value and unit',
  ARRAY['100 sq ft', '50 m²', '2 acres', '1,500 square feet'],
  'Numeric value followed by unit such as sq ft, m², acres, or hectares',
  'float', NULL, NULL, FALSE
),
(
  'dimensions', 'Dimensions', 'measurements',
  'Multi-dimensional measurements expressed as width × height × depth or similar',
  ARRAY['10 x 20 x 5 cm', '8.5" x 11"', '24 x 36 inches'],
  'Two or three measurements separated by x or × with optional units',
  NULL, NULL, NULL, FALSE
),
(
  'angle', 'Angle', 'measurements',
  'Rotational measurement expressed in degrees, radians, or gradians',
  ARRAY['45°', '90 degrees', '1.57 rad', '3.14159 radians'],
  'Numeric value followed by degree symbol (°), ''degrees'', ''rad'', or ''radians''',
  'float', NULL, NULL, FALSE
),
(
  'temperature', 'Temperature', 'measurements',
  'Thermal measurement expressed with a numeric value and unit scale',
  ARRAY['98.6°F', '37°C', '310 K', '-40°F'],
  'Numeric value followed by °F, °C, or K; may include negative values',
  'float', NULL, NULL, FALSE
),
(
  'pressure', 'Pressure', 'measurements',
  'Force per unit area expressed with a numeric value and unit',
  ARRAY['30 psi', '1 atm', '101.3 kPa', '760 mmHg'],
  'Numeric value followed by unit such as psi, atm, Pa, kPa, bar, or mmHg',
  'float', NULL, NULL, FALSE
),
(
  'energy', 'Energy', 'measurements',
  'Measure of work or heat capacity expressed with a numeric value and unit',
  ARRAY['100 kWh', '500 J', '1,000 BTU', '2.5 MJ'],
  'Numeric value followed by unit such as J, kJ, kWh, BTU, or cal',
  'float', NULL, NULL, FALSE
),
(
  'current', 'Electric Current', 'measurements',
  'Flow of electric charge expressed in amperes or related units',
  ARRAY['5 A', '100 mA', '2.5 amperes', '500 μA'],
  'Numeric value followed by unit such as A, mA, μA, or amperes',
  'float', NULL, NULL, FALSE
),
(
  'voltage', 'Voltage', 'measurements',
  'Electric potential difference expressed in volts or related units',
  ARRAY['120 V', '12V', '3.3 volts', '480 VAC'],
  'Numeric value followed by V, kV, mV, or volts; may include AC/DC qualifier',
  'float', NULL, NULL, FALSE
),
(
  'resistance', 'Electrical Resistance', 'measurements',
  'Opposition to electric current expressed in ohms or related units',
  ARRAY['100 Ω', '10 kΩ', '1 MΩ', '470 ohms'],
  'Numeric value followed by Ω, kΩ, MΩ, or ohms',
  'float', NULL, NULL, FALSE
),
(
  'concentration', 'Concentration', 'measurements',
  'Amount of a substance per unit volume or mass expressed with value and unit',
  ARRAY['5 mg/L', '0.1 mol/L', '200 ppm', '10 μg/mL'],
  'Numeric value followed by unit such as mg/L, g/dL, mol/L, ppm, or ppb',
  'float', NULL, NULL, FALSE
),
(
  'force', 'Force', 'measurements',
  'Physical force expressed with a numeric value and unit',
  ARRAY['100 N', '50 lbf', '9.8 kN', '500 dyne'],
  'Numeric value followed by unit such as N, kN, lbf, or dyne',
  'float', NULL, NULL, FALSE
),
(
  'torque', 'Torque', 'measurements',
  'Rotational force expressed with a numeric value and unit',
  ARRAY['250 Nm', '184 ft-lb', '30 kgf·m'],
  'Numeric value followed by unit such as N·m, ft-lb, or kgf·m',
  'float', NULL, NULL, FALSE
),
(
  'fuel_efficiency', 'Fuel Efficiency', 'measurements',
  'Distance traveled per unit of fuel expressed with value and unit',
  ARRAY['30 mpg', '8 L/100km', '12 km/L'],
  'Numeric value followed by unit such as mpg, L/100km, or km/L',
  'float', NULL, NULL, FALSE
),

-- sales
(
  'sku', 'Stock Keeping Unit', 'sales',
  'Unique alphanumeric identifier assigned to a product for inventory tracking',
  ARRAY['ABC-12345', 'SKU001234', 'PROD-XYZ-001'],
  'Alphanumeric code; format varies by retailer and often includes hyphens',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'invoice_num', 'Invoice Number', 'sales',
  'Unique identifier assigned to a billing invoice',
  ARRAY['INV-2024-001', '00123456', 'INV20240315'],
  'Alphanumeric code, often prefixed with INV or similar; format varies by company',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'check_num', 'Check Number', 'sales',
  'Sequential number printed on a paper check for identification',
  ARRAY['1042', '5001', '10234'],
  'Typically a 4-6 digit number printed in the upper right corner of a check',
  'int', '\b\d{4,6}\b', NULL, TRUE
),
(
  'po_num', 'Purchase Order Number', 'sales',
  'Unique identifier assigned to a purchase order by the buyer',
  ARRAY['PO-2024-001', 'PO00123', '4500012345'],
  'Alphanumeric identifier, often prefixed with PO; format varies by organization',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'tracking_num', 'Tracking Number', 'sales',
  'Carrier-assigned identifier used to track a shipment',
  ARRAY['1Z999AA10123456784', '9400111899223397910207', '7489 6691 3751'],
  'Alphanumeric code assigned by carrier (UPS, FedEx, USPS); format and length vary by carrier',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'billing_address', 'Billing Address', 'sales',
  'Mailing address associated with a payment method or account for invoicing',
  ARRAY['123 Main St, Springfield, IL 62701', '456 Oak Ave, Suite 200, Boston, MA 02101'],
  'Full address including street, city, state, and ZIP code',
  NULL, NULL, NULL, FALSE
),
(
  'shipping_address', 'Shipping Address', 'sales',
  'Delivery address for physical goods being shipped',
  ARRAY['789 Elm St, Austin, TX 78701', '321 Pine Rd, Apt 5, Seattle, WA 98101'],
  'Full address including street, city, state, and ZIP code',
  NULL, NULL, NULL, FALSE
),
(
  'vat', 'Value Added Tax Number', 'sales',
  'Tax identification number used for VAT purposes in international trade',
  ARRAY['GB123456789', 'DE987654321', 'FR12345678901'],
  'Country code prefix followed by 8-12 alphanumeric characters; format varies by country',
  'alphanumeric', '[A-Z]{2}[A-Z0-9]{2,12}', NULL, TRUE
),
(
  'price', 'Price', 'sales',
  'Monetary amount assigned to a product or service',
  ARRAY['$29.99', '$1,500.00', '€49.95', '£12.50'],
  'Numeric amount with optional currency symbol; typically includes two decimal places',
  'float', NULL, NULL, TRUE
),
(
  'hs_code', 'Harmonized System Code', 'sales',
  'International product classification code used for customs and trade',
  ARRAY['8471.30', '6109.10.00', '0101.21.00'],
  '6-10 digit numeric code structured as HHHH.HH with optional country-specific extensions separated by dots',
  'alphanumeric', '\d{4}\.\d{2}(\.\d{2,4})?', NULL, TRUE
),
(
  'bol', 'Bill of Lading Number', 'sales',
  'Carrier-issued document number for a shipment of freight',
  ARRAY['MAEU1234567890', 'BOL-2024-001234', 'SCAC12345678'],
  'Alphanumeric identifier assigned by freight carrier; format varies by carrier',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'rma', 'Return Merchandise Authorization Number', 'sales',
  'Authorization number issued to approve a product return',
  ARRAY['RMA-2024-001', 'RMA123456', 'RA-789012'],
  'Alphanumeric code, often prefixed with RMA or RA; format varies by company',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'slip_num', 'Packing Slip Number', 'sales',
  'Unique identifier on a packing slip included with a shipment',
  ARRAY['PS-2024-001', 'SLIP00123', '78901234'],
  'Alphanumeric identifier; format varies by company',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'due_date', 'Due Date', 'sales',
  'Date by which a payment, submission, or task must be completed',
  ARRAY['Due: 03/31/2024', 'Payment due April 15, 2024', '2024-12-31'],
  'A date value specifically labeled or contextually identified as a deadline or payment due date',
  NULL, NULL, NULL, FALSE
),
(
  'expiration_date', 'Expiration Date', 'sales',
  'Date after which a product, offer, or document is no longer valid',
  ARRAY['Exp: 12/2025', 'Expires: March 31, 2024', 'Valid through 06/30/24'],
  'A date value labeled as expiration, expiry, valid through, or best by',
  NULL, NULL, NULL, FALSE
),
(
  'delivery_date', 'Delivery Date', 'sales',
  'Expected or actual date on which goods are to be delivered',
  ARRAY['Delivery: April 5, 2024', 'Est. Delivery: 04/10/2024', 'Ship by: March 28, 2024'],
  'A date value labeled as delivery, ship, or estimated arrival date',
  NULL, NULL, NULL, FALSE
),

-- finance
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
),

-- healthcare
(
  'cpt', 'Current Procedural Terminology Code', 'healthcare',
  'AMA-owned 5-character code for physician and outpatient procedures; always starts with a digit, distinguishing it from HCPCS Level II codes',
  ARRAY['99213', '93000', '27447', '0001F', '0042T'],
  'Exactly 5 characters: Category I codes are 5 digits, Category II performance codes end in F, Category III emerging technology codes end in T',
  'alphanumeric', '\b\d{4}(\d|[FT])\b', 5, TRUE
),
(
  'cpt_modifier', 'CPT Modifier', 'healthcare',
  'Two-character alphanumeric code appended to a CPT code to indicate modified service circumstances',
  ARRAY['25', '59', 'TC', 'LT', '26'],
  'Exactly 2 alphanumeric characters appended to a CPT code',
  'alphanumeric', '\b[A-Z0-9]{2}\b', 2, TRUE
),
(
  'npi', 'National Provider Identifier', 'healthcare',
  '10-digit unique identifier assigned to US healthcare providers',
  ARRAY['1234567893', '0987654321', '1568370891'],
  'Exactly 10 digits; no letters or formatting characters',
  'int', '\b\d{10}\b', 10, TRUE
),
(
  'hcpcs', 'Healthcare Common Procedure Coding System Code', 'healthcare',
  'CMS-owned Level II code for DME, supplies, drugs, and services not covered by CPT; always starts with a letter, distinguishing it from CPT codes',
  ARRAY['E0601', 'A6216', 'J0690', 'G0439'],
  '1 uppercase letter followed by 4 digits; always 5 characters',
  'alphanumeric', '[A-Z]\d{4}', 5, TRUE
),
(
  'icd-10-cm', 'ICD-10-CM Diagnosis Code', 'healthcare',
  'Clinical modification code from ICD-10 identifying a diagnosis or condition',
  ARRAY['J18.9', 'E11.65', 'S52.501A', 'Z00.00'],
  '3-7 characters: 1 letter, 2 digits, optional dot and 1-4 additional alphanumeric characters',
  'alphanumeric', '[A-Z]\d{2}(\.[A-Z0-9]{1,4})?', NULL, TRUE
),
(
  'icd-10-pcs', 'ICD-10-PCS Procedure Code', 'healthcare',
  'Procedure coding system code from ICD-10 identifying an inpatient hospital procedure',
  ARRAY['0BH17EZ', '02HV00Z', '4A023N6'],
  'Exactly 7 alphanumeric characters with no dots or separators',
  'alphanumeric', '[A-Z0-9]{7}', 7, TRUE
),
(
  'drg', 'Diagnosis Related Group', 'healthcare',
  'Classification code grouping hospital inpatient stays by clinical similarity for reimbursement',
  ARRAY['470', '291', '65'],
  'Typically a 1-3 digit number for Medicare DRGs',
  'int', '\b\d{1,3}\b', NULL, TRUE
),
(
  'member_id', 'Member ID', 'healthcare',
  'Insurance plan member identification number assigned by the health insurer',
  ARRAY['XYZ123456789', 'MBR-001234567', '123456789-01'],
  'Alphanumeric identifier assigned by health insurer; format varies by plan',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'policy_num', 'Insurance Policy Number', 'healthcare',
  'Unique identifier for an insurance policy',
  ARRAY['POL-123456789', 'HMO123456', 'PPO-987654321'],
  'Alphanumeric identifier for an insurance policy; format varies by insurer',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'group_num', 'Insurance Group Number', 'healthcare',
  'Identifier for an employer group or insurance plan under which multiple members are covered',
  ARRAY['GRP123456', '00123', 'G-78901234'],
  'Alphanumeric identifier for an employer group plan; format varies by insurer',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'claim_num', 'Insurance Claim Number', 'healthcare',
  'Unique identifier assigned to a submitted insurance claim',
  ARRAY['CLM-2024-001234', '2024031500001', 'ICN123456789'],
  'Alphanumeric identifier assigned by insurer or clearinghouse; format varies by payer',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'ndc', 'National Drug Code', 'healthcare',
  'FDA-assigned identifier for prescription and over-the-counter drugs',
  ARRAY['0069-3060-30', '50090-1289-0', '00002-7630-01'],
  '11 digits in 5-4-2 or 5-3-2 format with hyphens separating labeler, product, and package codes',
  'alphanumeric', '\d{4,5}-\d{3,4}-\d{2}', NULL, TRUE
),
(
  'rx', 'Prescription Number', 'healthcare',
  'Pharmacy-assigned identifier for a specific prescription',
  ARRAY['RX1234567', 'Rx 00234567', '5678901'],
  'Numeric or alphanumeric code assigned by the pharmacy; format varies by pharmacy system',
  'alphanumeric', NULL, NULL, TRUE
),

-- pharma
(
  'lab_asccession_num', 'Lab Accession Number', 'pharma',
  'Unique identifier assigned to a laboratory specimen or test order',
  ARRAY['ACC2024031500001', 'LAB-123456-A', '2024-00123456'],
  'Alphanumeric identifier assigned by the laboratory information system; format varies by lab',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'clia', 'CLIA Number', 'pharma',
  'CMS-issued certificate number for clinical laboratories under the Clinical Laboratory Improvement Amendments',
  ARRAY['01D2345678', '36D0987654', '05D1234567'],
  '10 alphanumeric characters: 2-digit state code, 1 letter D, 7 numeric digits',
  'alphanumeric', '\d{2}D\d{7}', 10, TRUE
),
(
  'spl_id', 'Structured Product Labeling ID', 'pharma',
  'FDA document identifier for structured product labeling submissions',
  ARRAY['d76e0e97-b4f6-40c2-af46-03c5b24c6bb8', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
  'UUID format: 8-4-4-4-12 hexadecimal characters separated by hyphens; always lowercase',
  'alphanumeric', '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 36, TRUE
),

-- legal
(
  'case_num', 'Case Number', 'legal',
  'Unique identifier assigned to a legal case by a court',
  ARRAY['2024-CV-001234', '23-cv-01234', 'Case No. 2024-L-000123'],
  'Alphanumeric identifier; format varies by court and jurisdiction',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'pacer', 'PACER Case Number', 'legal',
  'Federal court case number accessible via the Public Access to Court Electronic Records system',
  ARRAY['1:24-cv-01234', '3:23-cr-00567-ABC', '2:22-bk-12345'],
  'Format: D:YY-type-NNNNN where D is district, YY is year, type is case type (cv, cr, bk), and NNNNN is sequential number',
  'alphanumeric', '\d:\d{2}-[a-z]{2}-\d{5}', NULL, TRUE
),
(
  'nos', 'Nature of Suit Code', 'legal',
  '3-digit code on a civil cover sheet classifying the type of federal lawsuit',
  ARRAY['110', '240', '470', '830'],
  'Exactly 3 numeric digits from the federal civil cover sheet codes',
  'int', '\b\d{3}\b', 3, TRUE
),
(
  'usc', 'United States Code Citation', 'legal',
  'Citation to a section of the United States Code of federal law',
  ARRAY['42 U.S.C. § 1983', '18 U.S.C. § 1341', '26 U.S.C. § 501(c)(3)'],
  'Format: [Title] U.S.C. § [Section] with optional subsection in parentheses',
  NULL, NULL, NULL, FALSE
),
(
  'cfr', 'Code of Federal Regulations Citation', 'legal',
  'Citation to a section of the Code of Federal Regulations',
  ARRAY['21 C.F.R. § 820.30', '29 C.F.R. § 1910.1200', '47 C.F.R. § 15.105'],
  'Format: [Title] C.F.R. § [Part].[Section] with optional sub-sections',
  NULL, NULL, NULL, FALSE
),
(
  'public_law_num', 'Public Law Number', 'legal',
  'Congressional designation for a law enacted by the US Congress',
  ARRAY['Pub. L. 111-148', 'P.L. 116-136', 'Public Law 104-191'],
  'Format: [Congress number]-[sequential number] where Congress number is 2-3 digits',
  'alphanumeric', '\d{2,3}-\d{1,4}', NULL, FALSE
),
(
  'filing_code', 'Filing Code', 'legal',
  'Alphanumeric code identifying the type of legal document filed with a court',
  ARRAY['CV', 'CR', 'BK', 'COMP', 'MOT'],
  'Short alphanumeric code specific to the court or jurisdiction filing system',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'patent_num', 'Patent Number', 'legal',
  'USPTO-assigned number uniquely identifying a granted patent',
  ARRAY['US10,123,456', 'US 8,456,789 B2', 'US2024/0123456'],
  'Begins with country code (US), followed by serial number and optional kind code (B1, B2, A1)',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'trademark_num', 'Trademark Registration Number', 'legal',
  'USPTO-assigned number for a registered trademark',
  ARRAY['5,123,456', 'Reg. No. 4,987,654', '6000001'],
  '7-digit number, often formatted with a comma after the first digit',
  'int', '\b\d{7}\b', 7, TRUE
),
(
  'copyright_num', 'Copyright Registration Number', 'legal',
  'US Copyright Office registration number for a copyrighted work',
  ARRAY['TX 8-987-654', 'VA 2-123-456', 'TXu001234567'],
  'Letter prefix indicating work type (TX, VA, SR, PA) followed by hyphenated numbers',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'ucc', 'UCC Filing Number', 'legal',
  'State-assigned filing number for a UCC financing statement securing collateral',
  ARRAY['2024 0123456789', 'DE-2024-123456789', '202400001234'],
  'Alphanumeric number assigned by state filing office; format varies by state',
  'alphanumeric', NULL, NULL, FALSE
),
(
  'notary_seal', 'Notary Commission Number', 'legal',
  'Number assigned to a notary public''s official commission or seal',
  ARRAY['Commission No. 2345678', 'Notary ID: 12345', '98765432'],
  'Numeric or alphanumeric identifier issued by a state to a commissioned notary',
  'alphanumeric', NULL, NULL, TRUE
),

-- research
(
  'doi', 'Digital Object Identifier', 'research',
  'Persistent identifier for a digital document or publication',
  ARRAY['10.1038/nature12373', '10.1016/j.cell.2023.01.001', 'doi:10.1145/3442188.3445922'],
  'Format: 10.NNNN/suffix where NNNN is the registrant code and suffix is the item identifier',
  'alphanumeric', '10\.\d{4,9}/[^\s]+', NULL, TRUE
),
(
  'arxiv', 'arXiv Identifier', 'research',
  'Identifier for a preprint paper hosted on the arXiv repository',
  ARRAY['arXiv:2303.08774', '1706.03762', 'arXiv:1605.02688v2'],
  'Format: YYMM.NNNNN or YYMM.NNNNNvN for versioned papers; optionally prefixed with arXiv:',
  'alphanumeric', '\d{4}\.\d{4,5}(v\d+)?', NULL, TRUE
),
(
  'author', 'Author Name', 'research',
  'Name of a person who created or contributed to a published work',
  ARRAY['Smith, J.', 'John A. Smith', 'Smith et al.'],
  'May appear in Last, First or First Last format; may include initials or ''et al.'' for multiple authors',
  'alpha', NULL, NULL, FALSE
),
(
  'institution', 'Research Institution', 'research',
  'Name of an academic or research organization affiliated with a publication',
  ARRAY['Massachusetts Institute of Technology', 'Stanford University', 'NIH'],
  'Full or abbreviated name of a university, research lab, hospital, or government agency',
  'alpha', NULL, NULL, FALSE
),
(
  'citation', 'Citation', 'research',
  'Reference to a published work in a standard bibliographic format',
  ARRAY['Smith et al. (2023). Nature, 612, 45-52.', '[1] J. Smith, "Title," Journal, vol. 1, 2023.'],
  'May follow APA, MLA, Chicago, IEEE, or other citation styles; includes author, title, publication, and year',
  NULL, NULL, NULL, FALSE
),
(
  'issn', 'International Standard Serial Number', 'research',
  '8-digit code identifying a serial publication such as a journal or magazine',
  ARRAY['ISSN 1234-5678', '0028-0836', 'ISSN: 2041-1723'],
  '8 digits formatted as NNNN-NNNX where X may be 0-9 or X (check digit)',
  'alphanumeric', '\d{4}-\d{3}[\dX]', 8, TRUE
),
(
  'isbn', 'International Standard Book Number', 'research',
  'Unique numeric identifier for a published book',
  ARRAY['ISBN 978-0-306-40615-7', '0-306-40615-2', 'ISBN-13: 9780306406157'],
  '13 digits (ISBN-13) or 10 digits (ISBN-10), grouped with hyphens; final digit may be X for ISBN-10',
  'alphanumeric', '(?:97[89]-?)?\d{1,5}-?\d{1,7}-?\d{1,6}-?[\dX]', NULL, TRUE
),
(
  'grant_num', 'Grant Number', 'research',
  'Identifier assigned to a research funding grant by the awarding agency',
  ARRAY['R01 CA123456', 'NSF 2012345', '5R01GM123456-03'],
  'Alphanumeric code assigned by funding agency; NIH grants follow activity-IC-serial format',
  'alphanumeric', NULL, NULL, FALSE
),
(
  'vol', 'Volume Number', 'research',
  'Volume number of a journal or multi-volume publication',
  ARRAY['Vol. 42', 'Volume 10', 'vol. 3'],
  'Integer typically preceded by ''Vol.'' or ''Volume'' label',
  'int', NULL, NULL, FALSE
),
(
  'issue', 'Issue Number', 'research',
  'Issue or number within a journal volume',
  ARRAY['No. 3', 'Issue 12', 'no. 4'],
  'Integer typically preceded by ''Issue'', ''No.'', or ''Number'' label',
  'int', NULL, NULL, FALSE
),
(
  'conference', 'Conference Name', 'research',
  'Name of an academic conference or symposium where work was presented',
  ARRAY['NeurIPS 2023', 'IEEE CVPR 2024', 'ACL 2023', 'ICLR'],
  'Full or abbreviated conference name, often with year',
  NULL, NULL, NULL, FALSE
),

-- real estate
(
  'aspn', 'Assessor''s Parcel Number', 'real estate',
  'Local government identifier for a specific parcel of real property',
  ARRAY['123-456-78', '5143-018-014', '02-34-000-001-0000'],
  'Numeric or hyphenated number assigned by county assessor; format varies by jurisdiction',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'deed_type_code', 'Deed Type Code', 'real estate',
  'Code identifying the type of real property deed used in a transaction',
  ARRAY['GWD', 'QCD', 'WD', 'TD', 'SWD'],
  'Short alphabetic code representing deed type (e.g., GWD = General Warranty Deed, QCD = Quit Claim Deed)',
  'alpha', NULL, NULL, TRUE
),
(
  'instrument_num', 'Instrument Number', 'real estate',
  'Recording number assigned to a legal document by the county recorder''s office',
  ARRAY['2024-012345', '20240315001234', 'DOC# 2024-001234'],
  'Numeric or alphanumeric sequence assigned by recorder''s office when a document is recorded',
  'alphanumeric', NULL, NULL, TRUE
),
(
  'mortgage_id', 'Mortgage Identification Number', 'real estate',
  'Unique identifier assigned to a registered mortgage or deed of trust',
  ARRAY['1000157-0000000-9', '100016200000000008', 'MIN 1000157-0000000-9'],
  '18-digit Mortgage Identification Number (MIN) registered with MERS or a similar system',
  'alphanumeric', NULL, NULL, TRUE
);
