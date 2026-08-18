-- NuBlox Package 004L controlled general-ledger posting and accounting export evidence
-- Adds a tenant chart of accounts, semantic account-role mappings, immutable balanced journal entries,
-- additive journal reversals and provider-neutral export evidence linked to immutable operational source events.
-- Operational finance facts remain authoritative and are never rewritten by accounting posting.
-- migrate:up transaction:false

CREATE TABLE accounting_accounts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    account_code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    account_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    normal_balance VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounting_accounts_public (organisation_id, public_id),
    UNIQUE KEY uq_accounting_accounts_code (organisation_id, account_code),
    UNIQUE KEY uq_accounting_accounts_id_organisation (id, organisation_id),
    KEY idx_accounting_accounts_active (organisation_id, is_active, account_type, account_code),

    CONSTRAINT fk_accounting_accounts_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_accounts_created_by
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_accounts_type
        CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    CONSTRAINT ck_accounting_accounts_normal_balance
        CHECK (normal_balance IN ('debit', 'credit'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounting_account_mappings (
    organisation_id BIGINT UNSIGNED NOT NULL,
    mapping_key VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    accounting_account_id BIGINT UNSIGNED NOT NULL,
    assigned_by_member_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,

    PRIMARY KEY (organisation_id, mapping_key),
    KEY idx_accounting_account_mappings_account (accounting_account_id, organisation_id),

    CONSTRAINT fk_accounting_account_mappings_account
        FOREIGN KEY (accounting_account_id, organisation_id)
        REFERENCES accounting_accounts (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_account_mappings_member
        FOREIGN KEY (assigned_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_account_mappings_key
        CHECK (mapping_key IN (
            'accounts_receivable',
            'sales_revenue',
            'vat_control',
            'cash_receipts',
            'customer_unapplied_cash',
            'bad_debt_expense',
            'bad_debt_recovery_income'
        ))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounting_journal_entries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    journal_number VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_type VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_public_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_event_at DATETIME(6) NOT NULL,
    source_amount DECIMAL(19,4) NOT NULL,
    source_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    accounting_date DATE NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    memo VARCHAR(1000) NOT NULL,
    posted_by_member_id BIGINT UNSIGNED NOT NULL,
    posted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounting_journal_entries_public (organisation_id, public_id),
    UNIQUE KEY uq_accounting_journal_entries_number (organisation_id, journal_number),
    UNIQUE KEY uq_accounting_journal_entries_id_organisation (id, organisation_id),
    KEY idx_accounting_journal_entries_source (organisation_id, source_type, source_public_id, posted_at),
    KEY idx_accounting_journal_entries_date (organisation_id, accounting_date, journal_number),

    CONSTRAINT fk_accounting_journal_entries_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_journal_entries_posted_by
        FOREIGN KEY (posted_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_journal_entries_source_type
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
            'journal_reversal'
        )),
    CONSTRAINT ck_accounting_journal_entries_source_amount
        CHECK (source_amount > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounting_journal_lines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    journal_entry_id BIGINT UNSIGNED NOT NULL,
    accounting_account_id BIGINT UNSIGNED NOT NULL,
    line_number SMALLINT UNSIGNED NOT NULL,
    description VARCHAR(500) NOT NULL,
    debit_amount DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    credit_amount DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounting_journal_lines_number (organisation_id, journal_entry_id, line_number),
    KEY idx_accounting_journal_lines_account (accounting_account_id, organisation_id, journal_entry_id),

    CONSTRAINT fk_accounting_journal_lines_entry
        FOREIGN KEY (journal_entry_id, organisation_id)
        REFERENCES accounting_journal_entries (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_journal_lines_account
        FOREIGN KEY (accounting_account_id, organisation_id)
        REFERENCES accounting_accounts (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_journal_lines_side
        CHECK (
            (debit_amount > 0 AND credit_amount = 0)
            OR
            (credit_amount > 0 AND debit_amount = 0)
        ),
    CONSTRAINT ck_accounting_journal_lines_number
        CHECK (line_number > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounting_journal_entry_reversals (
    journal_entry_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    reversal_journal_entry_id BIGINT UNSIGNED NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (journal_entry_id),
    UNIQUE KEY uq_accounting_journal_entry_reversals_context (journal_entry_id, organisation_id),
    UNIQUE KEY uq_accounting_journal_entry_reversals_reversal (organisation_id, reversal_journal_entry_id),

    CONSTRAINT fk_accounting_journal_entry_reversals_original
        FOREIGN KEY (journal_entry_id, organisation_id)
        REFERENCES accounting_journal_entries (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_journal_entry_reversals_reversal
        FOREIGN KEY (reversal_journal_entry_id, organisation_id)
        REFERENCES accounting_journal_entries (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_journal_entry_reversals_member
        FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_journal_entry_reversals_distinct
        CHECK (journal_entry_id <> reversal_journal_entry_id)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounting_export_batches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    export_number VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    export_format VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    row_count INT UNSIGNED NOT NULL,
    content_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounting_export_batches_public (organisation_id, public_id),
    UNIQUE KEY uq_accounting_export_batches_number (organisation_id, export_number),
    UNIQUE KEY uq_accounting_export_batches_id_organisation (id, organisation_id),
    KEY idx_accounting_export_batches_period (organisation_id, period_end, export_number),

    CONSTRAINT fk_accounting_export_batches_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_export_batches_created_by
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_export_batches_format
        CHECK (export_format IN ('generic_csv')),
    CONSTRAINT ck_accounting_export_batches_period
        CHECK (period_end >= period_start),
    CONSTRAINT ck_accounting_export_batches_rows
        CHECK (row_count > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounting_export_batch_entries (
    accounting_export_batch_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    journal_entry_id BIGINT UNSIGNED NOT NULL,
    sequence_number INT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (accounting_export_batch_id, journal_entry_id),
    UNIQUE KEY uq_accounting_export_batch_entries_sequence (organisation_id, accounting_export_batch_id, sequence_number),
    KEY idx_accounting_export_batch_entries_journal (journal_entry_id, organisation_id),

    CONSTRAINT fk_accounting_export_batch_entries_batch
        FOREIGN KEY (accounting_export_batch_id, organisation_id)
        REFERENCES accounting_export_batches (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_export_batch_entries_journal
        FOREIGN KEY (journal_entry_id, organisation_id)
        REFERENCES accounting_journal_entries (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_export_batch_entries_sequence
        CHECK (sequence_number > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounting_export_reversals (
    accounting_export_batch_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (accounting_export_batch_id),
    UNIQUE KEY uq_accounting_export_reversals_context (accounting_export_batch_id, organisation_id),

    CONSTRAINT fk_accounting_export_reversals_batch
        FOREIGN KEY (accounting_export_batch_id, organisation_id)
        REFERENCES accounting_export_batches (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_export_reversals_member
        FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

INSERT INTO permissions (capability_id, permission_key, name, description, is_active)
VALUES
    (NULL, 'finance.accounting.view', 'View accounting', 'View chart-of-account mappings, journal evidence and accounting export evidence.', TRUE),
    (NULL, 'finance.accounting.configure', 'Configure accounting', 'Create tenant accounting accounts and assign semantic account-role mappings.', TRUE),
    (NULL, 'finance.accounting.post', 'Post accounting journal', 'Create a balanced immutable journal entry derived from an eligible operational source event.', TRUE),
    (NULL, 'finance.accounting.reverse', 'Reverse accounting journal', 'Create an additive balanced reversal journal linked to an existing accounting journal entry.', TRUE),
    (NULL, 'finance.accounting.export', 'Create accounting export', 'Create provider-neutral accounting export evidence from posted journal entries.', TRUE),
    (NULL, 'finance.accounting.export.reverse', 'Reverse accounting export evidence', 'Reverse export evidence without deleting the original export batch.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role.organisation_id, role.id, permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission
    ON permission.permission_key IN (
        'finance.accounting.view',
        'finance.accounting.configure',
        'finance.accounting.post',
        'finance.accounting.reverse',
        'finance.accounting.export',
        'finance.accounting.export.reverse'
    )
WHERE role.name IN ('Owner', 'Administrator')
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role.organisation_id, role.id, permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission
    ON permission.permission_key = 'finance.accounting.view'
WHERE role.name = 'Finance/Commercial'
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Accounting journal/export evidence is forward-only.
SELECT 1;
