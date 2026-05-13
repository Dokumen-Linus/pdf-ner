-- migrate:up
CREATE VIEW core.entity_value_labels AS
SELECT
  ev.id,
  ev.pdf_id,
  ev.entity_type_id,
  et.name AS entity_type_name,
  ev.text_value,
  lower(btrim(ev.text_value)) AS normalized_text_value,
  ev.page_index,
  ev.created_at,
  ev.updated_at
FROM core.entity_values ev
JOIN web.entity_types et ON et.id = ev.entity_type_id
WHERE ev.is_label;

-- migrate:down
DROP VIEW core.entity_value_labels;
