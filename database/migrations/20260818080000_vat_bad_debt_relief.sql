-- NuBlox Package 004K controlled VAT bad-debt relief and return-posting evidence
-- Adds source-tax-linked relief preparation/authorisation/reversal, recovery repayment evidence,
-- and additive VAT-return posting/reversal evidence without creating a VAT return or general ledger engine.
-- Operational invoice, credit-note, payment, write-off and recovery facts remain immutable.
-- migrate:up transaction:false

ALTER TABLE receivable_write_offs
    ADD UNIQUE KEY uq_receivable_write_offs_id_invoice (
        id,
        organisation_id,
        invoice_document_id
    );

ALTER TABLE receivable_write_off_recoveries
    ADD UNIQUE KEY uq_receivable_write_off_recoveries_id_writeoff (
        id,
        organisation_id,
        write_off_id
    );

CREATE TABLE receivable_vat_bad_debt_claims (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    write_off_id BIGINT UNSIGNED NOT NULL,
    invoice_document_id BIGINT UNSIGNED NOT NULL,
    supply_date DATE NOT NULL,
    payment_due_date DATE NOT NULL,
    relevant_date DATE NOT NULL,
    eligible_from DATE NOT NULL,
    claim_deadline DATE NOT NULL,
    original_vat_period_reference VARCHAR(80) NOT NULL,
    vat_accounted_and_paid BOOLEAN NOT NULL,
    debt_not_sold_or_factored BOOLEAN NOT NULL,
    selling_price_condition_met BOOLEAN NOT NULL,
    relief_scheme_applicable BOOLEAN NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    prepared_by_member_id BIGINT UNSIGNED NOT NULL,
    prepared_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_vat_bad_debt_claims_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_vat_bad_debt_claims_id_organisation (id, organisation_id),
    UNIQUE KEY uq_receivable_vat_bad_debt_claims_id_invoice (id, organisation_id, invoice_document_id),
    UNIQUE KEY uq_receivable_vat_bad_debt_claims_id_writeoff (id, organisation_id, write_off_id),
    KEY idx_receivable_vat_bad_debt_claims_writeoff (write_off_id, organisation_id, prepared_at),
    KEY idx_receivable_vat_bad_debt_claims_invoice (invoice_document_id, organisation_id, prepared_at),

    CONSTRAINT fk_receivable_vat_bad_debt_claims_writeoff
        FOREIGN KEY (write_off_id, organisation_id, invoice_document_id)
        REFERENCES receivable_write_offs (id, organisation_id, invoice_document_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_vat_bad_debt_claims_invoice
        FOREIGN KEY (invoice_document_id, organisation_id)
        REFERENCES invoices (financial_document_id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_vat_bad_debt_claims_prepared_by
        FOREIGN KEY (prepared_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_vat_bad_debt_claims_dates
        CHECK (
            relevant_date >= supply_date
            AND relevant_date >= payment_due_date
            AND eligible_from >= relevant_date
            AND claim_deadline >= eligible_from
        ),
    CONSTRAINT ck_receivable_vat_bad_debt_claims_attestations
        CHECK (
            vat_accounted_and_paid = TRUE
            AND debt_not_sold_or_factored = TRUE
            AND selling_price_condition_met = TRUE
            AND relief_scheme_applicable = TRUE
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_vat_bad_debt_claim_lines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    claim_id BIGINT UNSIGNED NOT NULL,
    invoice_document_id BIGINT UNSIGNED NOT NULL,
    source_invoice_item_id BIGINT UNSIGNED NOT NULL,
    tax_category_id BIGINT UNSIGNED NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    consideration_basis_amount DECIMAL(19,4) NOT NULL,
    vat_relief_amount DECIMAL(19,4) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_vat_bad_debt_claim_lines_source (
        organisation_id,
        claim_id,
        source_invoice_item_id,
        tax_category_id
    ),
    UNIQUE KEY uq_receivable_vat_bad_debt_claim_lines_sort (
        organisation_id,
        claim_id,
        sort_order
    ),
    KEY idx_receivable_vat_bad_debt_claim_lines_tax_source (
        organisation_id,
        source_invoice_item_id,
        tax_category_id
    ),

    CONSTRAINT fk_receivable_vat_bad_debt_claim_lines_claim
        FOREIGN KEY (claim_id, organisation_id, invoice_document_id)
        REFERENCES receivable_vat_bad_debt_claims (id, organisation_id, invoice_document_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_vat_bad_debt_claim_lines_item
        FOREIGN KEY (source_invoice_item_id, organisation_id, invoice_document_id)
        REFERENCES financial_document_items (id, organisation_id, financial_document_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_vat_bad_debt_claim_lines_tax
        FOREIGN KEY (organisation_id, source_invoice_item_id, tax_category_id)
        REFERENCES financial_document_item_taxes (organisation_id, financial_document_item_id, tax_category_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_vat_bad_debt_claim_lines_amounts
        CHECK (consideration_basis_amount > 0 AND vat_relief_amount > 0),
    CONSTRAINT ck_receivable_vat_bad_debt_claim_lines_sort
        CHECK (sort_order > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_vat_bad_debt_claim_authorisations (
    claim_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    authorised_by_member_id BIGINT UNSIGNED NOT NULL,
    authorised_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (claim_id),
    UNIQUE KEY uq_receivable_vat_bad_debt_claim_authorisations_context (claim_id, organisation_id),

    CONSTRAINT fk_receivable_vat_bad_debt_claim_authorisations_claim
        FOREIGN KEY (claim_id, organisation_id)
        REFERENCES receivable_vat_bad_debt_claims (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_vat_bad_debt_claim_authorisations_member
        FOREIGN KEY (authorised_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_vat_bad_debt_claim_reversals (
    claim_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (claim_id),
    UNIQUE KEY uq_receivable_vat_bad_debt_claim_reversals_context (claim_id, organisation_id),

    CONSTRAINT fk_receivable_vat_bad_debt_claim_reversals_claim
        FOREIGN KEY (claim_id, organisation_id)
        REFERENCES receivable_vat_bad_debt_claims (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_vat_bad_debt_claim_reversals_member
        FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_vat_bad_debt_repayments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    claim_id BIGINT UNSIGNED NOT NULL,
    write_off_id BIGINT UNSIGNED NOT NULL,
    recovery_id BIGINT UNSIGNED NOT NULL,
    consideration_payment_amount DECIMAL(19,4) NOT NULL,
    vat_repayment_amount DECIMAL(19,4) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    recorded_by_member_id BIGINT UNSIGNED NOT NULL,
    recorded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_vat_bad_debt_repayments_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_vat_bad_debt_repayments_id_organisation (id, organisation_id),
    KEY idx_receivable_vat_bad_debt_repayments_claim (claim_id, organisation_id, recorded_at),
    KEY idx_receivable_vat_bad_debt_repayments_recovery (recovery_id, organisation_id, recorded_at),

    CONSTRAINT fk_receivable_vat_bad_debt_repayments_claim
        FOREIGN KEY (claim_id, organisation_id, write_off_id)
        REFERENCES receivable_vat_bad_debt_claims (id, organisation_id, write_off_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_vat_bad_debt_repayments_recovery
        FOREIGN KEY (recovery_id, organisation_id, write_off_id)
        REFERENCES receivable_write_off_recoveries (id, organisation_id, write_off_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_vat_bad_debt_repayments_member
        FOREIGN KEY (recorded_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_vat_bad_debt_repayments_amounts
        CHECK (consideration_payment_amount > 0 AND vat_repayment_amount > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_vat_bad_debt_repayment_reversals (
    repayment_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (repayment_id),
    UNIQUE KEY uq_receivable_vat_bad_debt_repayment_reversals_context (repayment_id, organisation_id),

    CONSTRAINT fk_receivable_vat_bad_debt_repayment_reversals_repayment
        FOREIGN KEY (repayment_id, organisation_id)
        REFERENCES receivable_vat_bad_debt_repayments (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_vat_bad_debt_repayment_reversals_member
        FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_vat_return_postings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    posting_kind VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    claim_id BIGINT UNSIGNED NULL,
    repayment_id BIGINT UNSIGNED NULL,
    vat_return_box TINYINT UNSIGNED NOT NULL,
    vat_return_period_reference VARCHAR(80) NOT NULL,
    vat_return_period_start DATE NOT NULL,
    vat_return_period_end DATE NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    external_reference VARCHAR(160) NULL,
    reason VARCHAR(1000) NOT NULL,
    posted_by_member_id BIGINT UNSIGNED NOT NULL,
    posted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_vat_return_postings_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_vat_return_postings_id_organisation (id, organisation_id),
    KEY idx_receivable_vat_return_postings_claim (claim_id, organisation_id, posted_at),
    KEY idx_receivable_vat_return_postings_repayment (repayment_id, organisation_id, posted_at),
    KEY idx_receivable_vat_return_postings_period (organisation_id, vat_return_period_end, posting_kind),

    CONSTRAINT fk_receivable_vat_return_postings_claim
        FOREIGN KEY (claim_id, organisation_id)
        REFERENCES receivable_vat_bad_debt_claims (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_vat_return_postings_repayment
        FOREIGN KEY (repayment_id, organisation_id)
        REFERENCES receivable_vat_bad_debt_repayments (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_vat_return_postings_member
        FOREIGN KEY (posted_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_vat_return_postings_source
        CHECK (
            (posting_kind = 'relief_claim' AND claim_id IS NOT NULL AND repayment_id IS NULL AND vat_return_box = 4)
            OR
            (posting_kind = 'relief_repayment' AND claim_id IS NULL AND repayment_id IS NOT NULL AND vat_return_box = 1)
        ),
    CONSTRAINT ck_receivable_vat_return_postings_amount
        CHECK (amount > 0),
    CONSTRAINT ck_receivable_vat_return_postings_period
        CHECK (vat_return_period_end >= vat_return_period_start)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_vat_return_posting_reversals (
    posting_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (posting_id),
    UNIQUE KEY uq_receivable_vat_return_posting_reversals_context (posting_id, organisation_id),

    CONSTRAINT fk_receivable_vat_return_posting_reversals_posting
        FOREIGN KEY (posting_id, organisation_id)
        REFERENCES receivable_vat_return_postings (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_vat_return_posting_reversals_member
        FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

INSERT INTO permissions (capability_id, permission_key, name, description, is_active)
VALUES
    (NULL, 'finance.tax_relief.view', 'View VAT bad-debt relief', 'View VAT bad-debt relief preparations, authorisations, repayments and VAT-return posting evidence.', TRUE),
    (NULL, 'finance.tax_relief.prepare', 'Prepare VAT bad-debt relief', 'Prepare source-tax-linked VAT bad-debt relief evidence for later authorisation.', TRUE),
    (NULL, 'finance.tax_relief.authorise', 'Authorise VAT bad-debt relief', 'Authorise a prepared VAT bad-debt relief claim after current eligibility revalidation.', TRUE),
    (NULL, 'finance.tax_relief.reverse', 'Reverse VAT bad-debt relief', 'Reverse an authorised VAT bad-debt relief claim through additive evidence.', TRUE),
    (NULL, 'finance.tax_relief.repayment.record', 'Record VAT bad-debt relief repayment', 'Record VAT repayment arising from a payment recovered after VAT bad-debt relief.', TRUE),
    (NULL, 'finance.tax_relief.repayment.reverse', 'Reverse VAT bad-debt relief repayment', 'Reverse VAT bad-debt relief repayment evidence additively.', TRUE),
    (NULL, 'finance.tax_relief.post', 'Record VAT return posting', 'Record evidence that a VAT bad-debt relief claim or repayment was included in a VAT return.', TRUE),
    (NULL, 'finance.tax_relief.post.reverse', 'Reverse VAT return posting evidence', 'Reverse VAT-return posting evidence without deleting the original posting fact.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role.organisation_id, role.id, permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission
    ON permission.permission_key IN (
        'finance.tax_relief.view',
        'finance.tax_relief.prepare',
        'finance.tax_relief.authorise',
        'finance.tax_relief.reverse',
        'finance.tax_relief.repayment.record',
        'finance.tax_relief.repayment.reverse',
        'finance.tax_relief.post',
        'finance.tax_relief.post.reverse'
    )
WHERE role.name IN ('Owner', 'Administrator')
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role.organisation_id, role.id, permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission
    ON permission.permission_key IN (
        'finance.tax_relief.view',
        'finance.tax_relief.prepare'
    )
WHERE role.name = 'Finance/Commercial'
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- VAT bad-debt relief and VAT-return posting evidence is forward-only.
SELECT 1;
