-- Enterprise Payment Terms Engine
-- Normalised term templates, execution rules, staged schedules and early-payment discounts.
-- Existing organisation-owned payment_terms remain the operational assignment boundary.
-- migrate:up transaction:false

CREATE TABLE payment_term_templates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    term_kind VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'single',
    calculation_basis VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    days_offset SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    day_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'calendar',
    month_offset SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    fixed_day_of_month TINYINT UNSIGNED NULL,
    business_day_convention VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'none',
    is_invoice_compatible TINYINT(1) NOT NULL DEFAULT 0,
    description VARCHAR(500) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_term_template_code (code),
    KEY ix_payment_term_template_basis (calculation_basis, is_active),
    CONSTRAINT chk_payment_term_template_kind CHECK (term_kind IN ('single', 'recurring', 'milestone', 'split', 'retention', 'trade')),
    CONSTRAINT chk_payment_term_template_basis CHECK (calculation_basis IN (
        'invoice_date', 'invoice_receipt_date', 'order_date', 'shipment_date', 'delivery_date',
        'goods_receipt_date', 'acceptance_date', 'service_completion_date', 'billing_period_start',
        'billing_period_end', 'milestone_date', 'completion_date', 'end_of_month', 'manual'
    )),
    CONSTRAINT chk_payment_term_template_day_type CHECK (day_type IN ('calendar', 'business')),
    CONSTRAINT chk_payment_term_template_fixed_day CHECK (fixed_day_of_month IS NULL OR fixed_day_of_month BETWEEN 1 AND 31),
    CONSTRAINT chk_payment_term_template_business_convention CHECK (business_day_convention IN ('none', 'following', 'preceding', 'modified_following')),
    CONSTRAINT chk_payment_term_template_invoice_compatibility CHECK (
        is_invoice_compatible = 0 OR calculation_basis IN ('invoice_date', 'end_of_month', 'manual')
    )
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE payment_term_rules (
    payment_term_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    source_template_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    term_kind VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'single',
    day_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'calendar',
    month_offset SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    fixed_day_of_month TINYINT UNSIGNED NULL,
    business_day_convention VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'none',
    description VARCHAR(500) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (payment_term_id),
    KEY ix_payment_term_rule_organisation (organisation_id, source_template_code),
    CONSTRAINT fk_payment_term_rule_term
        FOREIGN KEY (payment_term_id) REFERENCES payment_terms(id),
    CONSTRAINT fk_payment_term_rule_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT chk_payment_term_rule_kind CHECK (term_kind IN ('single', 'recurring', 'milestone', 'split', 'retention', 'trade')),
    CONSTRAINT chk_payment_term_rule_day_type CHECK (day_type IN ('calendar', 'business')),
    CONSTRAINT chk_payment_term_rule_fixed_day CHECK (fixed_day_of_month IS NULL OR fixed_day_of_month BETWEEN 1 AND 31),
    CONSTRAINT chk_payment_term_rule_business_convention CHECK (business_day_convention IN ('none', 'following', 'preceding', 'modified_following'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE payment_term_schedule_lines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    payment_term_id BIGINT UNSIGNED NOT NULL,
    line_number SMALLINT UNSIGNED NOT NULL,
    percentage_due DECIMAL(7,4) NOT NULL,
    calculation_basis VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    days_offset SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    day_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'calendar',
    month_offset SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    fixed_day_of_month TINYINT UNSIGNED NULL,
    business_day_convention VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'none',
    milestone_code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NULL,
    description VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_term_schedule_line (payment_term_id, line_number),
    KEY ix_payment_term_schedule_organisation (organisation_id, payment_term_id),
    CONSTRAINT fk_payment_term_schedule_term
        FOREIGN KEY (payment_term_id) REFERENCES payment_terms(id),
    CONSTRAINT fk_payment_term_schedule_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT chk_payment_term_schedule_percentage CHECK (percentage_due > 0 AND percentage_due <= 100),
    CONSTRAINT chk_payment_term_schedule_basis CHECK (calculation_basis IN (
        'invoice_date', 'invoice_receipt_date', 'order_date', 'shipment_date', 'delivery_date',
        'goods_receipt_date', 'acceptance_date', 'service_completion_date', 'billing_period_start',
        'billing_period_end', 'milestone_date', 'completion_date', 'end_of_month', 'manual'
    )),
    CONSTRAINT chk_payment_term_schedule_day_type CHECK (day_type IN ('calendar', 'business')),
    CONSTRAINT chk_payment_term_schedule_fixed_day CHECK (fixed_day_of_month IS NULL OR fixed_day_of_month BETWEEN 1 AND 31),
    CONSTRAINT chk_payment_term_schedule_business_convention CHECK (business_day_convention IN ('none', 'following', 'preceding', 'modified_following'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE payment_term_discounts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    payment_term_id BIGINT UNSIGNED NOT NULL,
    sequence_number SMALLINT UNSIGNED NOT NULL,
    discount_percentage DECIMAL(7,4) NOT NULL,
    calculation_basis VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'invoice_date',
    eligibility_days SMALLINT UNSIGNED NOT NULL,
    day_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'calendar',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_term_discount_sequence (payment_term_id, sequence_number),
    KEY ix_payment_term_discount_organisation (organisation_id, payment_term_id),
    CONSTRAINT fk_payment_term_discount_term
        FOREIGN KEY (payment_term_id) REFERENCES payment_terms(id),
    CONSTRAINT fk_payment_term_discount_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT chk_payment_term_discount_percentage CHECK (discount_percentage > 0 AND discount_percentage < 100),
    CONSTRAINT chk_payment_term_discount_basis CHECK (calculation_basis IN ('invoice_date', 'invoice_receipt_date')),
    CONSTRAINT chk_payment_term_discount_day_type CHECK (day_type IN ('calendar', 'business'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

INSERT INTO payment_term_templates (
    code, name, term_kind, calculation_basis, days_offset, day_type, month_offset,
    fixed_day_of_month, business_day_convention, is_invoice_compatible, description
)
VALUES
    ('IMMEDIATE', 'Immediate Payment', 'single', 'invoice_date', 0, 'calendar', 0, NULL, 'none', 1, 'Payment is due immediately from invoice date.'),
    ('DUE_RECEIPT', 'Due on Receipt', 'single', 'invoice_receipt_date', 0, 'calendar', 0, NULL, 'none', 0, 'Payment is due when a valid invoice is received.'),
    ('PIA', 'Payment in Advance', 'single', 'order_date', 0, 'calendar', 0, NULL, 'none', 0, 'Payment is required in advance of fulfilment.'),
    ('PAY_ON_ORDER', 'Payment on Order', 'single', 'order_date', 0, 'calendar', 0, NULL, 'none', 0, 'Payment is due when the order is placed.'),
    ('PAY_BEFORE_SHIPMENT', 'Payment Before Shipment', 'single', 'shipment_date', 0, 'calendar', 0, NULL, 'preceding', 0, 'Payment must clear before shipment.'),
    ('PAY_ON_SHIPMENT', 'Payment on Shipment', 'single', 'shipment_date', 0, 'calendar', 0, NULL, 'none', 0, 'Payment is due on shipment.'),
    ('PAY_ON_DELIVERY', 'Payment on Delivery', 'single', 'delivery_date', 0, 'calendar', 0, NULL, 'none', 0, 'Payment is due on delivery.'),
    ('PAY_ON_ACCEPTANCE', 'Payment on Acceptance', 'single', 'acceptance_date', 0, 'calendar', 0, NULL, 'none', 0, 'Payment is due on formal acceptance.'),
    ('PAY_ON_COMPLETION', 'Payment on Completion', 'single', 'completion_date', 0, 'calendar', 0, NULL, 'none', 0, 'Payment is due on completion.'),
    ('PAY_ON_SERVICE_COMPLETION', 'Payment on Service Completion', 'single', 'service_completion_date', 0, 'calendar', 0, NULL, 'none', 0, 'Payment is due on service completion.'),
    ('NET_7', 'Net 7', 'single', 'invoice_date', 7, 'calendar', 0, NULL, 'none', 1, 'Due seven calendar days from invoice date.'),
    ('NET_10', 'Net 10', 'single', 'invoice_date', 10, 'calendar', 0, NULL, 'none', 1, 'Due ten calendar days from invoice date.'),
    ('NET_14', 'Net 14', 'single', 'invoice_date', 14, 'calendar', 0, NULL, 'none', 1, 'Due fourteen calendar days from invoice date.'),
    ('NET_15', 'Net 15', 'single', 'invoice_date', 15, 'calendar', 0, NULL, 'none', 1, 'Due fifteen calendar days from invoice date.'),
    ('NET_21', 'Net 21', 'single', 'invoice_date', 21, 'calendar', 0, NULL, 'none', 1, 'Due twenty-one calendar days from invoice date.'),
    ('NET_28', 'Net 28', 'single', 'invoice_date', 28, 'calendar', 0, NULL, 'none', 1, 'Due twenty-eight calendar days from invoice date.'),
    ('NET_30', 'Net 30', 'single', 'invoice_date', 30, 'calendar', 0, NULL, 'none', 1, 'Due thirty calendar days from invoice date.'),
    ('NET_35', 'Net 35', 'single', 'invoice_date', 35, 'calendar', 0, NULL, 'none', 1, 'Due thirty-five calendar days from invoice date.'),
    ('NET_45', 'Net 45', 'single', 'invoice_date', 45, 'calendar', 0, NULL, 'none', 1, 'Due forty-five calendar days from invoice date.'),
    ('NET_60', 'Net 60', 'single', 'invoice_date', 60, 'calendar', 0, NULL, 'none', 1, 'Due sixty calendar days from invoice date.'),
    ('NET_75', 'Net 75', 'single', 'invoice_date', 75, 'calendar', 0, NULL, 'none', 1, 'Due seventy-five calendar days from invoice date.'),
    ('NET_90', 'Net 90', 'single', 'invoice_date', 90, 'calendar', 0, NULL, 'none', 1, 'Due ninety calendar days from invoice date.'),
    ('NET_120', 'Net 120', 'single', 'invoice_date', 120, 'calendar', 0, NULL, 'none', 1, 'Due one hundred and twenty calendar days from invoice date.'),
    ('NET_180', 'Net 180', 'single', 'invoice_date', 180, 'calendar', 0, NULL, 'none', 1, 'Due one hundred and eighty calendar days from invoice date.'),
    ('RECEIPT_7', '7 Days from Invoice Receipt', 'single', 'invoice_receipt_date', 7, 'calendar', 0, NULL, 'none', 0, 'Due seven days from valid invoice receipt.'),
    ('RECEIPT_14', '14 Days from Invoice Receipt', 'single', 'invoice_receipt_date', 14, 'calendar', 0, NULL, 'none', 0, 'Due fourteen days from valid invoice receipt.'),
    ('RECEIPT_30', '30 Days from Invoice Receipt', 'single', 'invoice_receipt_date', 30, 'calendar', 0, NULL, 'none', 0, 'Due thirty days from valid invoice receipt.'),
    ('RECEIPT_45', '45 Days from Invoice Receipt', 'single', 'invoice_receipt_date', 45, 'calendar', 0, NULL, 'none', 0, 'Due forty-five days from valid invoice receipt.'),
    ('RECEIPT_60', '60 Days from Invoice Receipt', 'single', 'invoice_receipt_date', 60, 'calendar', 0, NULL, 'none', 0, 'Due sixty days from valid invoice receipt.'),
    ('RECEIPT_90', '90 Days from Invoice Receipt', 'single', 'invoice_receipt_date', 90, 'calendar', 0, NULL, 'none', 0, 'Due ninety days from valid invoice receipt.'),
    ('GRN_30', '30 Days from Goods Receipt', 'single', 'goods_receipt_date', 30, 'calendar', 0, NULL, 'none', 0, 'Due thirty days from goods receipt.'),
    ('GRN_45', '45 Days from Goods Receipt', 'single', 'goods_receipt_date', 45, 'calendar', 0, NULL, 'none', 0, 'Due forty-five days from goods receipt.'),
    ('GRN_60', '60 Days from Goods Receipt', 'single', 'goods_receipt_date', 60, 'calendar', 0, NULL, 'none', 0, 'Due sixty days from goods receipt.'),
    ('GRN_90', '90 Days from Goods Receipt', 'single', 'goods_receipt_date', 90, 'calendar', 0, NULL, 'none', 0, 'Due ninety days from goods receipt.'),
    ('DELIVERY_30', '30 Days from Delivery', 'single', 'delivery_date', 30, 'calendar', 0, NULL, 'none', 0, 'Due thirty days from delivery.'),
    ('DELIVERY_45', '45 Days from Delivery', 'single', 'delivery_date', 45, 'calendar', 0, NULL, 'none', 0, 'Due forty-five days from delivery.'),
    ('DELIVERY_60', '60 Days from Delivery', 'single', 'delivery_date', 60, 'calendar', 0, NULL, 'none', 0, 'Due sixty days from delivery.'),
    ('DELIVERY_90', '90 Days from Delivery', 'single', 'delivery_date', 90, 'calendar', 0, NULL, 'none', 0, 'Due ninety days from delivery.'),
    ('ACCEPTANCE_30', '30 Days from Acceptance', 'single', 'acceptance_date', 30, 'calendar', 0, NULL, 'none', 0, 'Due thirty days from acceptance.'),
    ('ACCEPTANCE_45', '45 Days from Acceptance', 'single', 'acceptance_date', 45, 'calendar', 0, NULL, 'none', 0, 'Due forty-five days from acceptance.'),
    ('ACCEPTANCE_60', '60 Days from Acceptance', 'single', 'acceptance_date', 60, 'calendar', 0, NULL, 'none', 0, 'Due sixty days from acceptance.'),
    ('ACCEPTANCE_90', '90 Days from Acceptance', 'single', 'acceptance_date', 90, 'calendar', 0, NULL, 'none', 0, 'Due ninety days from acceptance.'),
    ('SERVICE_30', '30 Days from Service Completion', 'single', 'service_completion_date', 30, 'calendar', 0, NULL, 'none', 0, 'Due thirty days from service completion.'),
    ('SERVICE_45', '45 Days from Service Completion', 'single', 'service_completion_date', 45, 'calendar', 0, NULL, 'none', 0, 'Due forty-five days from service completion.'),
    ('SERVICE_60', '60 Days from Service Completion', 'single', 'service_completion_date', 60, 'calendar', 0, NULL, 'none', 0, 'Due sixty days from service completion.'),
    ('EOM_0', 'End of Current Month', 'single', 'end_of_month', 0, 'calendar', 0, NULL, 'none', 1, 'Due at the end of the invoice month.'),
    ('EOM_7', '7 Days End of Month', 'single', 'end_of_month', 7, 'calendar', 0, NULL, 'none', 1, 'Due seven days after invoice month end.'),
    ('EOM_14', '14 Days End of Month', 'single', 'end_of_month', 14, 'calendar', 0, NULL, 'none', 1, 'Due fourteen days after invoice month end.'),
    ('EOM_30', '30 Days End of Month', 'single', 'end_of_month', 30, 'calendar', 0, NULL, 'none', 1, 'Due thirty days after invoice month end.'),
    ('EOM_45', '45 Days End of Month', 'single', 'end_of_month', 45, 'calendar', 0, NULL, 'none', 1, 'Due forty-five days after invoice month end.'),
    ('EOM_60', '60 Days End of Month', 'single', 'end_of_month', 60, 'calendar', 0, NULL, 'none', 1, 'Due sixty days after invoice month end.'),
    ('EOM_90', '90 Days End of Month', 'single', 'end_of_month', 90, 'calendar', 0, NULL, 'none', 1, 'Due ninety days after invoice month end.'),
    ('FOLLOWING_EOM', 'End of Following Month', 'single', 'invoice_date', 0, 'calendar', 1, 31, 'preceding', 0, 'Due on the final calendar day of the following month.'),
    ('FOLLOWING_01', '1st of Following Month', 'single', 'invoice_date', 0, 'calendar', 1, 1, 'none', 0, 'Due on the first day of the following month.'),
    ('FOLLOWING_05', '5th of Following Month', 'single', 'invoice_date', 0, 'calendar', 1, 5, 'none', 0, 'Due on the fifth day of the following month.'),
    ('FOLLOWING_10', '10th of Following Month', 'single', 'invoice_date', 0, 'calendar', 1, 10, 'none', 0, 'Due on the tenth day of the following month.'),
    ('FOLLOWING_15', '15th of Following Month', 'single', 'invoice_date', 0, 'calendar', 1, 15, 'none', 0, 'Due on the fifteenth day of the following month.'),
    ('FOLLOWING_20', '20th of Following Month', 'single', 'invoice_date', 0, 'calendar', 1, 20, 'none', 0, 'Due on the twentieth day of the following month.'),
    ('FOLLOWING_25', '25th of Following Month', 'single', 'invoice_date', 0, 'calendar', 1, 25, 'none', 0, 'Due on the twenty-fifth day of the following month.'),
    ('FOLLOWING_28', '28th of Following Month', 'single', 'invoice_date', 0, 'calendar', 1, 28, 'none', 0, 'Due on the twenty-eighth day of the following month.'),
    ('WORKING_5', '5 Business Days', 'single', 'invoice_date', 5, 'business', 0, NULL, 'following', 0, 'Due five business days from invoice date.'),
    ('WORKING_10', '10 Business Days', 'single', 'invoice_date', 10, 'business', 0, NULL, 'following', 0, 'Due ten business days from invoice date.'),
    ('WORKING_20', '20 Business Days', 'single', 'invoice_date', 20, 'business', 0, NULL, 'following', 0, 'Due twenty business days from invoice date.'),
    ('WORKING_30', '30 Business Days', 'single', 'invoice_date', 30, 'business', 0, NULL, 'following', 0, 'Due thirty business days from invoice date.'),
    ('MONTHLY_ADVANCE', 'Monthly in Advance', 'recurring', 'billing_period_start', 0, 'calendar', 0, NULL, 'none', 0, 'Recurring payment at the start of each billing period.'),
    ('MONTHLY_ARREARS', 'Monthly in Arrears', 'recurring', 'billing_period_end', 0, 'calendar', 0, NULL, 'none', 0, 'Recurring payment at the end of each billing period.'),
    ('QUARTERLY_ADVANCE', 'Quarterly in Advance', 'recurring', 'billing_period_start', 0, 'calendar', 0, NULL, 'none', 0, 'Quarterly payment in advance.'),
    ('QUARTERLY_ARREARS', 'Quarterly in Arrears', 'recurring', 'billing_period_end', 0, 'calendar', 0, NULL, 'none', 0, 'Quarterly payment in arrears.'),
    ('ANNUAL_ADVANCE', 'Annual in Advance', 'recurring', 'billing_period_start', 0, 'calendar', 0, NULL, 'none', 0, 'Annual payment in advance.'),
    ('ANNUAL_ARREARS', 'Annual in Arrears', 'recurring', 'billing_period_end', 0, 'calendar', 0, NULL, 'none', 0, 'Annual payment in arrears.'),
    ('MILESTONE', 'Milestone Payment', 'milestone', 'milestone_date', 0, 'calendar', 0, NULL, 'none', 0, 'Payment is due against a governed milestone.'),
    ('PROGRESS', 'Progress Payment', 'milestone', 'milestone_date', 0, 'calendar', 0, NULL, 'none', 0, 'Payment is due against certified progress.'),
    ('RETENTION', 'Retention Release', 'retention', 'completion_date', 0, 'calendar', 0, NULL, 'none', 0, 'Retention becomes due on the configured release event.'),
    ('MANUAL', 'Manual Due Date', 'single', 'manual', 0, 'calendar', 0, NULL, 'none', 1, 'Due date is explicitly entered and governed on the financial document.')
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
-- Commercial payment-term definitions may become referenced contractual evidence.
-- Production rollback is therefore forward-only; non-production environments are rebuilt.
SELECT 1;
