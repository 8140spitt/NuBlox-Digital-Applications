-- NuBlox invoice tax configuration hotfix
-- Seeds the current UK VAT reference catalogue for existing organisations.
-- Tenant administrators can add further categories/rates; existing matching codes are preserved.
-- migrate:up transaction:false

INSERT INTO tax_categories (
    organisation_id,
    public_id,
    code,
    name,
    treatment,
    is_active
)
SELECT organisation.id, UUID(), 'VAT_STANDARD', 'VAT standard rate', 'taxable', TRUE
FROM organisations AS organisation
WHERE NOT EXISTS (
    SELECT 1
    FROM tax_categories AS category
    WHERE category.organisation_id = organisation.id
      AND category.code = 'VAT_STANDARD'
);

INSERT INTO tax_categories (
    organisation_id,
    public_id,
    code,
    name,
    treatment,
    is_active
)
SELECT organisation.id, UUID(), 'VAT_REDUCED', 'VAT reduced rate', 'taxable', TRUE
FROM organisations AS organisation
WHERE NOT EXISTS (
    SELECT 1
    FROM tax_categories AS category
    WHERE category.organisation_id = organisation.id
      AND category.code = 'VAT_REDUCED'
);

INSERT INTO tax_categories (
    organisation_id,
    public_id,
    code,
    name,
    treatment,
    is_active
)
SELECT organisation.id, UUID(), 'VAT_ZERO', 'VAT zero rate', 'zero', TRUE
FROM organisations AS organisation
WHERE NOT EXISTS (
    SELECT 1
    FROM tax_categories AS category
    WHERE category.organisation_id = organisation.id
      AND category.code = 'VAT_ZERO'
);

INSERT INTO tax_categories (
    organisation_id,
    public_id,
    code,
    name,
    treatment,
    is_active
)
SELECT organisation.id, UUID(), 'VAT_EXEMPT', 'VAT exempt', 'exempt', TRUE
FROM organisations AS organisation
WHERE NOT EXISTS (
    SELECT 1
    FROM tax_categories AS category
    WHERE category.organisation_id = organisation.id
      AND category.code = 'VAT_EXEMPT'
);

INSERT INTO tax_categories (
    organisation_id,
    public_id,
    code,
    name,
    treatment,
    is_active
)
SELECT organisation.id, UUID(), 'OUTSIDE_SCOPE', 'Outside scope', 'outside_scope', TRUE
FROM organisations AS organisation
WHERE NOT EXISTS (
    SELECT 1
    FROM tax_categories AS category
    WHERE category.organisation_id = organisation.id
      AND category.code = 'OUTSIDE_SCOPE'
);

-- Current UK rates for the 2026/27 tax year. Effective dating keeps later rate
-- changes additive rather than rewriting historical tax evidence. If a tenant
-- already owns rate history for one of these codes, that history is left alone.
INSERT INTO tax_category_rates (
    organisation_id,
    tax_category_id,
    rate_percent,
    valid_from,
    valid_to
)
SELECT category.organisation_id, category.id, 20.0000, '2026-04-01', NULL
FROM tax_categories AS category
WHERE category.code = 'VAT_STANDARD'
  AND NOT EXISTS (
      SELECT 1
      FROM tax_category_rates AS rate
      WHERE rate.organisation_id = category.organisation_id
        AND rate.tax_category_id = category.id
  );

INSERT INTO tax_category_rates (
    organisation_id,
    tax_category_id,
    rate_percent,
    valid_from,
    valid_to
)
SELECT category.organisation_id, category.id, 5.0000, '2026-04-01', NULL
FROM tax_categories AS category
WHERE category.code = 'VAT_REDUCED'
  AND NOT EXISTS (
      SELECT 1
      FROM tax_category_rates AS rate
      WHERE rate.organisation_id = category.organisation_id
        AND rate.tax_category_id = category.id
  );

INSERT INTO tax_category_rates (
    organisation_id,
    tax_category_id,
    rate_percent,
    valid_from,
    valid_to
)
SELECT category.organisation_id, category.id, 0.0000, '2026-04-01', NULL
FROM tax_categories AS category
WHERE category.code = 'VAT_ZERO'
  AND NOT EXISTS (
      SELECT 1
      FROM tax_category_rates AS rate
      WHERE rate.organisation_id = category.organisation_id
        AND rate.tax_category_id = category.id
  );

-- migrate:down transaction:false
-- Tax categories/rates may already have been used by financial documents, so the
-- released reference data is forward-only.
SELECT 1;