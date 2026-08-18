-- NuBlox Package 004O controlled year-end close and retained earnings
-- Adds additive year-end close/reversal evidence and extends existing accounting semantic/source vocabularies.
-- The closing journal is source-derived from governed revenue/expense balances; prior journals remain immutable.
-- migrate:up transaction:false

ALTER TABLE accounting_account_mappings
    DROP CHECK ck_accounting_account_mappings_key,
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
    DROP CHECK ck_accounting_journal_entries_source_type,
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

CREATE TABLE accounting_year_end_closes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    financial_year_id BIGINT UNSIGNED NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    close_sequence SMALLINT UNSIGNED NOT NULL,
    retained_earnings_account_id BIGINT UNSIGNED NOT NULL,
    closing_journal_entry_id BIGINT UNSIGNED NOT NULL,
    revenue_amount DECIMAL(19,4) NOT NULL,
    expense_amount DECIMAL(19,4) NOT NULL,
    profit_loss_amount DECIMAL(19,4) NOT NULL,
    closing_amount DECIMAL(19,4) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    closed_by_member_id BIGINT UNSIGNED NOT NULL,
    closed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounting_year_end_closes_public (organisation_id, public_id),
    UNIQUE KEY uq_accounting_year_end_closes_id_organisation (id, organisation_id),
    UNIQUE KEY uq_accounting_year_end_closes_sequence (organisation_id, financial_year_id, currency_code, close_sequence),
    UNIQUE KEY uq_accounting_year_end_closes_journal (organisation_id, closing_journal_entry_id),
    KEY idx_accounting_year_end_closes_year (financial_year_id, organisation_id, currency_code, close_sequence),

    CONSTRAINT fk_accounting_year_end_closes_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_year_end_closes_year
        FOREIGN KEY (financial_year_id, organisation_id)
        REFERENCES accounting_financial_years (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_year_end_closes_retained_earnings
        FOREIGN KEY (retained_earnings_account_id, organisation_id)
        REFERENCES accounting_accounts (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_year_end_closes_journal
        FOREIGN KEY (closing_journal_entry_id, organisation_id)
        REFERENCES accounting_journal_entries (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_year_end_closes_member
        FOREIGN KEY (closed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_year_end_closes_sequence
        CHECK (close_sequence > 0),
    CONSTRAINT ck_accounting_year_end_closes_amount
        CHECK (closing_amount > 0),
    CONSTRAINT ck_accounting_year_end_closes_result
        CHECK (profit_loss_amount = revenue_amount - expense_amount)
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
    UNIQUE KEY uq_accounting_year_end_close_reversals_context (year_end_close_id, organisation_id),
    UNIQUE KEY uq_accounting_year_end_close_reversals_journal (organisation_id, reversal_journal_entry_id),

    CONSTRAINT fk_accounting_year_end_close_reversals_close
        FOREIGN KEY (year_end_close_id, organisation_id)
        REFERENCES accounting_year_end_closes (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_year_end_close_reversals_journal
        FOREIGN KEY (reversal_journal_entry_id, organisation_id)
        REFERENCES accounting_journal_entries (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_year_end_close_reversals_member
        FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

INSERT INTO permissions (capability_id, permission_key, name, description, is_active)
VALUES
    (NULL, 'finance.accounting.year_end.close', 'Post year-end close', 'Create a controlled year-end closing journal that transfers governed revenue and expense balances into retained earnings.', TRUE),
    (NULL, 'finance.accounting.year_end.reverse', 'Reverse year-end close', 'Reverse a year-end closing journal after explicit accounting-period reopen evidence.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role.organisation_id, role.id, permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission
    ON permission.permission_key IN (
        'finance.accounting.year_end.close',
        'finance.accounting.year_end.reverse'
    )
WHERE role.name IN ('Owner', 'Administrator')
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Year-end close and reversal evidence is forward-only.
SELECT 1;
