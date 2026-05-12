INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, datatype, regex, exact_length, single_word
)
VALUES
(
  'sku', 'Stock Keeping Unit', 'sales',
  'Unique alphanumeric identifier assigned to a product for inventory tracking',
  ARRAY['ABC-12345', 'SKU001234', 'PROD-XYZ-001'],
  'alphanumeric', NULL, NULL, TRUE
),
(
  'invoice_num', 'Invoice Number', 'sales',
  'Unique identifier assigned to a billing invoice',
  ARRAY['INV-2024-001', '00123456', 'INV20240315'],
  'alphanumeric', NULL, NULL, TRUE
),
(
  'check_num', 'Check Number', 'sales',
  'Sequential number printed on a paper check for identification',
  ARRAY['1042', '5001', '10234'],
  'int', '\b\d{4,6}\b', NULL, TRUE
),
(
  'po_num', 'Purchase Order Number', 'sales',
  'Unique identifier assigned to a purchase order by the buyer',
  ARRAY['PO-2024-001', 'PO00123', '4500012345'],
  'alphanumeric', NULL, NULL, TRUE
),
(
  'tracking_num', 'Tracking Number', 'sales',
  'Carrier-assigned identifier used to track a shipment',
  ARRAY['1Z999AA10123456784', '9400111899223397910207', '7489 6691 3751'],
  'alphanumeric', NULL, NULL, TRUE
),
(
  'billing_address', 'Billing Address', 'sales',
  'Mailing address associated with a payment method or account for invoicing',
  ARRAY['123 Main St, Springfield, IL 62701', '456 Oak Ave, Suite 200, Boston, MA 02101'],
  NULL, NULL, NULL, FALSE
),
(
  'shipping_address', 'Shipping Address', 'sales',
  'Delivery address for physical goods being shipped',
  ARRAY['789 Elm St, Austin, TX 78701', '321 Pine Rd, Apt 5, Seattle, WA 98101'],
  NULL, NULL, NULL, FALSE
),
(
  'vat', 'Value Added Tax Number', 'sales',
  'Tax identification number used for VAT purposes in international trade',
  ARRAY['GB123456789', 'DE987654321', 'FR12345678901'],
   'alphanumeric', '^[A-Z]{2}[A-Z0-9]{2,12}$', NULL, TRUE
),
(
  'price', 'Price', 'sales',
  'Monetary amount assigned to a product or service',
  ARRAY['$29.99', '$1,500.00', '€49.95', '£12.50'],
  'float', NULL, NULL, TRUE
),
(
  'hs_code', 'Harmonized System Code', 'sales',
  'International product classification code used for customs and trade',
  ARRAY['8471.30', '6109.10.00', '0101.21.00'],
  'alphanumeric', '\d{4}\.\d{2}(\.\d{2,4})?', NULL, TRUE
),
(
  'bol', 'Bill of Lading Number', 'sales',
  'Carrier-issued document number for a shipment of freight',
  ARRAY['MAEU1234567890', 'BOL-2024-001234', 'SCAC12345678'],
  'alphanumeric', NULL, NULL, TRUE
),
(
  'rma', 'Return Merchandise Authorization Number', 'sales',
  'Authorization number issued to approve a product return',
  ARRAY['RMA-2024-001', 'RMA123456', 'RA-789012'],
  'alphanumeric', NULL, NULL, TRUE
),
(
  'slip_num', 'Packing Slip Number', 'sales',
  'Unique identifier on a packing slip included with a shipment',
  ARRAY['PS-2024-001', 'SLIP00123', '78901234'],
  'alphanumeric', NULL, NULL, TRUE
),
(
  'due_date', 'Due Date', 'sales',
  'Date by which a payment, submission, or task must be completed',
  ARRAY['Due: 03/31/2024', 'Payment due April 15, 2024', '2024-12-31'],
  NULL, NULL, NULL, FALSE
),
(
  'expiration_date', 'Expiration Date', 'sales',
  'Date after which a product, offer, or document is no longer valid',
  ARRAY['Exp: 12/2025', 'Expires: March 31, 2024', 'Valid through 06/30/24'],
  NULL, NULL, NULL, FALSE
),
(
  'delivery_date', 'Delivery Date', 'sales',
  'Expected or actual date on which goods are to be delivered',
  ARRAY['Delivery: April 5, 2024', 'Est. Delivery: 04/10/2024', 'Ship by: March 28, 2024'],
  NULL, NULL, NULL, FALSE
);
