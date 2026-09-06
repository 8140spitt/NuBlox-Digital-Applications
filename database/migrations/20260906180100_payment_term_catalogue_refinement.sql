-- Enterprise Payment Terms Engine — catalogue semantic refinement
-- Keep calendar month-end and working-day month-end as separate commercial concepts.
-- migrate:up transaction:false

UPDATE payment_term_templates
SET business_day_convention = 'none',
    description = 'Due on the final calendar day of the following month.'
WHERE code = 'FOLLOWING_EOM';

INSERT INTO payment_term_templates (
    code, name, term_kind, calculation_basis, days_offset, day_type, month_offset,
    fixed_day_of_month, business_day_convention, is_invoice_compatible, description
)
VALUES (
    'FOLLOWING_LAST_WORKING_DAY',
    'Last Working Day of Following Month',
    'single',
    'invoice_date',
    0,
    'calendar',
    1,
    31,
    'preceding',
    0,
    'Due on the final business day of the following month.'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    term_kind = VALUES(term_kind),
    calculation_basis = VALUES(calculation_basis),
    days_offset = VALUES(days_offset),
    day_type = VALUES(day_type),
    month_offset = VALUES(month_offset),
    fixed_day_of_month = VALUES(fixed_day_of_month),
    business_day_convention = VALUES(business_day_convention),
    is_invoice_compatible = VALUES(is_invoice_compatible),
    description = VALUES(description),
    is_active = TRUE;

-- migrate:down transaction:false
SELECT 1;
