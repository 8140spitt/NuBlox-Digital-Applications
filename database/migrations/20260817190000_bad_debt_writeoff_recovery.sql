-- NuBlox Package 004J controlled bad debt, write-off and recovery
-- Adds invoice-specific bad-debt assessment, immutable recommendations, authorised write-offs,
-- additive reversal evidence and cash recovery linked to existing payment receipts.
-- Original invoice/credit/payment facts remain immutable; no shadow receivable balance is stored.
-- migrate:up transaction:false

CREATE TABLE receivable_bad_debt_cases (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    customer_party_id BIGINT UNSIGNED NOT NULL,
    invoice_document_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    opening_reason VARCHAR(1000) NOT NULL,
    opened_by_member_id BIGINT UNSIGNED NOT NULL,
    opened_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    close_reason VARCHAR(1000) NULL,
    closed_by_member_id BIGINT UNSIGNED NULL,
    closed_at DATETIME(6) NULL,
    active_invoice_document_id BIGINT UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN status = 'open' THEN invoice_document_id ELSE NULL END
    ) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_bad_debt_cases_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_bad_debt_cases_id_organisation (id, organisation_id),
    UNIQUE KEY uq_receivable_bad_debt_cases_id_context (id, organisation_id, invoice_document_id),
    UNIQUE KEY uq_receivable_bad_debt_cases_one_open (organisation_id, active_invoice_document_id),
    KEY idx_receivable_bad_debt_cases_customer (customer_party_id, organisation_id, status, opened_at),
    KEY idx_receivable_bad_debt_cases_invoice (invoice_document_id, organisation_id, status),

    CONSTRAINT fk_receivable_bad_debt_cases_customer
        FOREIGN KEY (customer_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_bad_debt_cases_invoice
        FOREIGN KEY (invoice_document_id, organisation_id)
        REFERENCES financial_documents (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_bad_debt_cases_opened_by
        FOREIGN KEY (opened_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_bad_debt_cases_closed_by
        FOREIGN KEY (closed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_bad_debt_cases_status
        CHECK (status IN ('open', 'closed')),
    CONSTRAINT ck_receivable_bad_debt_cases_lifecycle
        CHECK (
            (status = 'open' AND close_reason IS NULL AND closed_by_member_id IS NULL AND closed_at IS NULL)
            OR
            (status = 'closed' AND close_reason IS NOT NULL AND closed_by_member_id IS NOT NULL AND closed_at IS NOT NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_bad_debt_recommendations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    bad_debt_case_id BIGINT UNSIGNED NOT NULL,
    invoice_document_id BIGINT UNSIGNED NOT NULL,
    recommended_amount DECIMAL(19,4) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    recommended_by_member_id BIGINT UNSIGNED NOT NULL,
    recommended_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_bad_debt_recommendations_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_bad_debt_recommendations_id_organisation (id, organisation_id),
    UNIQUE KEY uq_receivable_bad_debt_recommendations_context (id, organisation_id, bad_debt_case_id, invoice_document_id),
    KEY idx_receivable_bad_debt_recommendations_case (bad_debt_case_id, organisation_id, recommended_at),

    CONSTRAINT fk_receivable_bad_debt_recommendations_case
        FOREIGN KEY (bad_debt_case_id, organisation_id, invoice_document_id)
        REFERENCES receivable_bad_debt_cases (id, organisation_id, invoice_document_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_bad_debt_recommendations_member
        FOREIGN KEY (recommended_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_bad_debt_recommendations_amount
        CHECK (recommended_amount > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_write_offs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    bad_debt_case_id BIGINT UNSIGNED NOT NULL,
    recommendation_id BIGINT UNSIGNED NOT NULL,
    invoice_document_id BIGINT UNSIGNED NOT NULL,
    write_off_amount DECIMAL(19,4) NOT NULL,
    tax_treatment_policy VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    authorised_by_member_id BIGINT UNSIGNED NOT NULL,
    authorised_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_write_offs_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_write_offs_id_organisation (id, organisation_id),
    UNIQUE KEY uq_receivable_write_offs_recommendation (organisation_id, recommendation_id),
    KEY idx_receivable_write_offs_case (bad_debt_case_id, organisation_id, authorised_at),
    KEY idx_receivable_write_offs_invoice (invoice_document_id, organisation_id, authorised_at),

    CONSTRAINT fk_receivable_write_offs_recommendation
        FOREIGN KEY (recommendation_id, organisation_id, bad_debt_case_id, invoice_document_id)
        REFERENCES receivable_bad_debt_recommendations (id, organisation_id, bad_debt_case_id, invoice_document_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_write_offs_authorised_by
        FOREIGN KEY (authorised_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_write_offs_amount
        CHECK (write_off_amount > 0),
    CONSTRAINT ck_receivable_write_offs_tax_policy
        CHECK (tax_treatment_policy IN ('no_tax_adjustment', 'separate_tax_adjustment_required'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_write_off_reversals (
    write_off_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (write_off_id),
    UNIQUE KEY uq_receivable_write_off_reversals_context (write_off_id, organisation_id),

    CONSTRAINT fk_receivable_write_off_reversals_write_off
        FOREIGN KEY (write_off_id, organisation_id)
        REFERENCES receivable_write_offs (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_write_off_reversals_member
        FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_write_off_recoveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    write_off_id BIGINT UNSIGNED NOT NULL,
    payment_id BIGINT UNSIGNED NOT NULL,
    recovered_amount DECIMAL(19,4) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    recorded_by_member_id BIGINT UNSIGNED NOT NULL,
    recovered_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_write_off_recoveries_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_write_off_recoveries_id_organisation (id, organisation_id),
    KEY idx_receivable_write_off_recoveries_write_off (write_off_id, organisation_id, recovered_at),
    KEY idx_receivable_write_off_recoveries_payment (payment_id, organisation_id, recovered_at),

    CONSTRAINT fk_receivable_write_off_recoveries_write_off
        FOREIGN KEY (write_off_id, organisation_id)
        REFERENCES receivable_write_offs (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_write_off_recoveries_payment
        FOREIGN KEY (payment_id, organisation_id)
        REFERENCES payments (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_write_off_recoveries_member
        FOREIGN KEY (recorded_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_write_off_recoveries_amount
        CHECK (recovered_amount > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_write_off_recovery_reversals (
    recovery_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (recovery_id),
    UNIQUE KEY uq_receivable_write_off_recovery_reversals_context (recovery_id, organisation_id),

    CONSTRAINT fk_receivable_write_off_recovery_reversals_recovery
        FOREIGN KEY (recovery_id, organisation_id)
        REFERENCES receivable_write_off_recoveries (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_write_off_recovery_reversals_member
        FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'finance.bad_debt.view', 'View bad debt', 'View bad-debt cases, recommendations, write-offs, recoveries and reversal evidence.', TRUE),
    (NULL, 'finance.bad_debt.case.manage', 'Manage bad-debt cases', 'Open and close invoice-specific bad-debt assessment cases.', TRUE),
    (NULL, 'finance.bad_debt.recommend', 'Recommend write-off', 'Record immutable recommendations for partial or full receivable write-off.', TRUE),
    (NULL, 'finance.bad_debt.write_off.authorise', 'Authorise write-off', 'Authorise an invoice receivable write-off from an explicit bad-debt recommendation.', TRUE),
    (NULL, 'finance.bad_debt.write_off.reverse', 'Reverse write-off', 'Reverse an authorised write-off with explicit reasoned evidence.', TRUE),
    (NULL, 'finance.bad_debt.recovery.record', 'Record bad-debt recovery', 'Apply available cash from an existing payment receipt as recovery against an authorised write-off.', TRUE),
    (NULL, 'finance.bad_debt.recovery.reverse', 'Reverse bad-debt recovery', 'Reverse bad-debt recovery usage with explicit reasoned evidence.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

INSERT IGNORE INTO role_permissions (
    organisation_id,
    organisation_role_id,
    permission_id
)
SELECT
    role.organisation_id,
    role.id,
    permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission
    ON permission.permission_key IN (
        'finance.bad_debt.view',
        'finance.bad_debt.case.manage',
        'finance.bad_debt.recommend',
        'finance.bad_debt.write_off.authorise',
        'finance.bad_debt.write_off.reverse',
        'finance.bad_debt.recovery.record',
        'finance.bad_debt.recovery.reverse'
    )
WHERE role.name IN ('Owner', 'Administrator')
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

INSERT IGNORE INTO role_permissions (
    organisation_id,
    organisation_role_id,
    permission_id
)
SELECT
    role.organisation_id,
    role.id,
    permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission
    ON permission.permission_key IN (
        'finance.bad_debt.view',
        'finance.bad_debt.case.manage',
        'finance.bad_debt.recommend',
        'finance.bad_debt.recovery.record',
        'finance.bad_debt.recovery.reverse'
    )
WHERE role.name = 'Finance/Commercial'
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Bad-debt recommendations, write-offs, recoveries and reversal evidence are forward-only.
SELECT 1;
