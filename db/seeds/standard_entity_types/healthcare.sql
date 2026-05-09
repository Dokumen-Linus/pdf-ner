INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, format_description, datatype, regex, exact_length, single_word
)
VALUES
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
   'alphanumeric', '\b[A-Za-z0-9]{2}\b', 2, TRUE
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
   'alphanumeric', '\d{5}-\d{3,4}-\d{2}', NULL, TRUE
),
(
  'rx', 'Prescription Number', 'healthcare',
  'Pharmacy-assigned identifier for a specific prescription',
  ARRAY['RX1234567', 'Rx 00234567', '5678901'],
  'Numeric or alphanumeric code assigned by the pharmacy; format varies by pharmacy system',
  'alphanumeric', NULL, NULL, TRUE
);
