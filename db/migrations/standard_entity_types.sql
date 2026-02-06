(
-- general
'name',
'email',
'phone_num',
'url',
'company',
-- time
'date',
'time',
'datetime',
'duration',
'year',
'month',
'weekday',
'created_date',
-- location
'address',
'city',
'state', -- could be province if country is Canada, but still called state in db
'country',
'county',
'zip_code',
'coordinates',
-- formatted numbers
'dollar_val',
'currency_val',
'percent_val',
-- personal
'ssn',
'drivers_license',
'passport_num',
'state_id_num',
-- measurements
'speed',
'weight',
'length', -- or height or width
'volume',
'area',
'dimensions',
'angle',
'temperature',
'pressure',
'energy',
'current'
'voltage',
'resistance',
'concentration',
'force',
'torque',
'fuel_efficiency',
-- sales
'sku',
'invoice_num',
'check_num',
'po_num',
'tracking_num',
'billing_address',
'shipping_address',
'vat',
'price',
'hs_code', -- Harmonized System Code
'bol', -- Bill of Lading number
'rma', -- return authorization number
'slip_num', -- packaging slip number
'due_date',
'expiration_date',
'delivery_date',
-- finance
'currency',
'ein', -- same as FEIN
'itin', -- individual TIN
'iban',
'bic', -- swift/bic code
'bank_acct',
'rtn', -- ABA routing transit number
'ticker',
'isin', -- International Securities Identification Number
'cusip', -- Committee on Uniform Securities Identification Procedures
'figi', -- Financial Instrument Global Identifier
'effective_date',
-- healthcare
'cpt', -- Current Procedural Terminology
'cpt_modifier', -- CPT-MM two modifier digits
'npi', -- national provider id
'hcpcs', -- Healthcare Common Procedure Coding System
'icd-10-cm',
'icd-10-pcs',
'drg', -- diagnosis related group
'member_id',
'policy_num',
'group_num',
'claim_num',
'ndc', -- national drug code
'rx', -- prescription number for pharmacy
-- pharma
'lab_asccession_num',
'clia', -- Clinical Laboratory Improvement Amendments
'spl_id', -- structured product labeling doc id
--legal
'case_num',
'pacer', -- case number for federal courts
'nos', -- nature of suit code
'usc', -- united states code
'cfr', -- code of federal regulations
'public_law_num',
'filing_code',
'patent_num',
'trademark_num',
'copyright_num',
'ucc', -- uniform commercial code
'notary_seal', -- or commision number
-- research
'doi',
'arxiv',
'author',
'institution',
'citation',
'issn',
'isbn',
'grant_num',
'vol',
'issue',
'conference',
-- real estate
'aspn', -- Assessor's Parcel Number
'deed_type_code',
'instrument_num',
'mortgage_id',
)