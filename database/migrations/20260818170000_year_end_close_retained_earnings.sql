-- NuBlox Package 004O controlled year-end close and retained earnings
-- Adds immutable preparation, authorised close and additive reversal provenance.
-- Year-end close consumes governed journal evidence and never rewrites prior journals or period history.
-- migrate:up transaction:false

ALTER TABLE accounting_account_mappings
    DROP CHECK ck_accounting_account_mappings_key;

ALTER TABLE accounting_account_mappings
    ADD CONSTRAINT ck_accounting_account_mappings_key
        CHECK (mapping_key IN (
            'accounts_receivable',
            'sales_revenue',
            'vat_control',
            'cash_receipts',
            'customer_unapplied_cash',
            'bad_debt_expense',
            'bad_debt_recovery_income',
            'retained_earnings'
        ));

ALTER TABLE accounting_journal_entries
    DROP CHECK ck_accounting_journal_entries_source_type;

ALTER TABLE accounting_journal_entries
    ADD CONSTRAINT ck_accounting_journal_entries_source_type
        CHECK (source_type IN (
            'invoice_issue',
            'invoice_void',
            'credit_note_issue',
            'payment_receipt',
            'payment_allocation',
            'payment_allocation_reversal',
            'payment_reversal',
            'bad_debt_write_off',
            'bad_debt_write_off_reversal',
            'bad_debt_recovery',
            'bad_debt_recovery_reversal',
            'vat_relief_posting',
            'vat_relief_posting_reversal',
            'journal_reversal',
            'year_end_close'
        ));

CREATE TABLE accounting_year_end_close_preparations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    financial_year_id BIGINT UNSIGNED NOT NULL,
    preparation_sequence INT UNSIGNED NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    revenue_total DECIMAL(19,4) NOT NULL,
    expense_total DECIMAL(19,4) NOT NULL,
    profit_loss_amount DECIMAL(19,4) NOT NULL,
    closing_debit_total DECIMAL(19,4) NOT NULL,
    closing_credit_total DECIMAL(19,4) NOT NULL,
    source_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    prepared_by_member_id BIGINT UNSIGNED NOT NULL,
    prepared_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounting_yec_preparations_public (organisation_id, public_id),
    UNIQUE KEY uq_accounting_yec_preparations_sequence (organisation_id, financial_year_id, currency_code, preparation_sequence),
    UNIQUE KEY uq_accounting_yec_preparations_id_organisation (id, organisation_id),
    KEY idx_accounting_yec_preparations_year (financial_year_id, organisation_id, currency_code, preparation_sequence),

    CONSTRAINT fk_accounting_yec_preparations_year
        FOREIGN KEY (financial_year_id, organisation_id)
        REFERENCES accounting_financial_years (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_yec_preparations_member
        FOREIGN KEY (prepared_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_yec_preparations_sequence
        CHECK (preparation_sequence > 0),
    CONSTRAINT ck_accounting_yec_preparations_totals
        CHECK (
            revenue_total >= 0
            AND expense_total >= 0
            AND closing_debit_total > 0
            AND closing_credit_total > 0
            AND closing_debit_total = closing_credit_total
            AND profit_loss_amount = revenue_total - expense_total
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounting_year_end_closes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    financial_year_id BIGINT UNSIGNED NOT NULL,
    preparation_id BIGINT UNSIGNED NOT NULL,
    close_sequence INT UNSIGNED NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    closing_journal_entry_id BIGINT UNSIGNED NOT NULL,
    authorised_by_member_id BIGINT UNSIGNED NOT NULL,
    authorised_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounting_year_end_closes_public (organisation_id, public_id),
    UNIQUE KEY uq_accounting_year_end_closes_preparation (organisation_id, preparation_id),
    UNIQUE KEY uq_accounting_year_end_closes_sequence (organisation_id, financial_year_id, currency_code, close_sequence),
    UNIQUE KEY uq_accounting_year_end_closes_journal (organisation_id, closing_journal_entry_id),
    UNIQUE KEY uq_accounting_year_end_closes_id_organisation (id, organisation_id),
    KEY idx_accounting_year_end_closes_year (financial_year_id, organisation_id, currency_code, close_sequence),

    CONSTRAINT fk_accounting_year_end_closes_year
        FOREIGN KEY (financial_year_id, organisation_id)
        REFERENCES accounting_financial_years (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_year_end_closes_preparation
        FOREIGN KEY (preparation_id, organisation_id)
        REFERENCES accounting_year_end_close_preparations (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_year_end_closes_journal
        FOREIGN KEY (closing_journal_entry_id, organisation_id)
        REFERENCES accounting_journal_entries (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_year_end_closes_member
        FOREIGN KEY (authorised_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_year_end_closes_sequence
        CHECK (close_sequence > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounting_year_end_close_reversals (
    year_end_close_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    reversal_journal_entry_id BIGINT UNSIGNED NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (year_end_close_id),
    UNIQUE KEY uq_accounting_yec_reversals_context (year_end_close_id, organisation_id),
    UNIQUE KEY uq_accounting_yec_reversals_journal (organisation_id, reversal_journal_entry_id),

    CONSTRAINT fk_accounting_yec_reversals_close
        FOREIGN KEY (year_end_close_id, organisation_id)
        REFERENCES accounting_year_end_closes (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_yec_reversals_journal
        FOREIGN KEY (reversal_journal_entry_id, organisation_id)
        REFERENCES accounting_journal_entries (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_yec_reversals_member
        FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

INSERT INTO permissions (capability_id, permission_key, name, description, is_active)
VALUES
    (NULL, 'finance.accounting.year_end.prepare', 'Prepare year-end close', 'Derive immutable year-end close evidence from a complete hard-closed financial year.', TRUE),
    (NULL, 'finance.accounting.year_end.authorise', 'Authorise year-end close', 'Authorise a separately prepared year-end close and create its balanced retained-earnings journal.', TRUE),
    (NULL, 'finance.accounting.year_end.reverse', 'Reverse year-end close', 'Create an additive journal reversal for an authorised year-end close before controlled reopen/correction.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role.organisation_id, role.id, permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission
    ON permission.permission_key IN (
        'finance.accounting.year_end.prepare',
        'finance.accounting.year_end.authorise',
        'finance.accounting.year_end.reverse'
    )
WHERE role.name IN ('Owner', 'Administrator')
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Year-end close evidence and accounting journals are forward-only.
SELECT 1;
