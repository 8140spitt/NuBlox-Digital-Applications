-- NuBlox bank reconciliation and accounting close-readiness digital thread
-- Connects executed supplier payments to bank statement evidence and blocks hard close until
-- active supplier-payment cash journals in the period have active bank settlement evidence.
-- migrate:up transaction:false

CREATE TABLE bank_accounts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    accounting_account_id BIGINT UNSIGNED NOT NULL,
    account_name VARCHAR(160) NOT NULL,
    institution_name VARCHAR(160) NOT NULL,
    account_identifier_last4 CHAR(4) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_bank_accounts_public (organisation_id, public_id),
    UNIQUE KEY uq_bank_accounts_id_organisation (id, organisation_id),
    KEY idx_bank_accounts_accounting (accounting_account_id, organisation_id),
    KEY idx_bank_accounts_active (organisation_id, lifecycle_status, currency_code, account_name),

    CONSTRAINT fk_bank_accounts_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_bank_accounts_accounting
        FOREIGN KEY (accounting_account_id, organisation_id) REFERENCES accounting_accounts (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_bank_accounts_created_by
        FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_bank_accounts_status CHECK (lifecycle_status IN ('active', 'closed'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE bank_statements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    bank_account_id BIGINT UNSIGNED NOT NULL,
    statement_reference VARCHAR(160) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    opening_balance DECIMAL(19,4) NOT NULL,
    closing_balance DECIMAL(19,4) NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_bank_statements_public (organisation_id, public_id),
    UNIQUE KEY uq_bank_statements_reference (organisation_id, bank_account_id, statement_reference),
    UNIQUE KEY uq_bank_statements_id_account_organisation (id, bank_account_id, organisation_id),
    KEY idx_bank_statements_period (organisation_id, bank_account_id, period_start, period_end),

    CONSTRAINT fk_bank_statements_account
        FOREIGN KEY (bank_account_id, organisation_id) REFERENCES bank_accounts (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_bank_statements_created_by
        FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_bank_statements_period CHECK (period_end >= period_start)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE bank_statement_lines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    bank_statement_id BIGINT UNSIGNED NOT NULL,
    bank_account_id BIGINT UNSIGNED NOT NULL,
    external_transaction_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    booked_on DATE NOT NULL,
    value_on DATE NULL,
    direction VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    description VARCHAR(500) NOT NULL,
    bank_reference VARCHAR(160) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_bank_statement_lines_public (organisation_id, public_id),
    UNIQUE KEY uq_bank_statement_lines_external (organisation_id, bank_account_id, external_transaction_id),
    UNIQUE KEY uq_bank_statement_lines_id_organisation (id, organisation_id),
    KEY idx_bank_statement_lines_statement (bank_statement_id, bank_account_id, organisation_id, booked_on),

    CONSTRAINT fk_bank_statement_lines_statement
        FOREIGN KEY (bank_statement_id, bank_account_id, organisation_id)
        REFERENCES bank_statements (id, bank_account_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_bank_statement_lines_direction CHECK (direction IN ('debit', 'credit')),
    CONSTRAINT ck_bank_statement_lines_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE bank_reconciliation_matches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    bank_statement_line_id BIGINT UNSIGNED NOT NULL,
    supplier_payment_id BIGINT UNSIGNED NOT NULL,
    matched_amount DECIMAL(19,4) NOT NULL,
    matched_by_member_id BIGINT UNSIGNED NOT NULL,
    matched_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_bank_reconciliation_matches_public (organisation_id, public_id),
    UNIQUE KEY uq_bank_reconciliation_matches_id_organisation (id, organisation_id),
    KEY idx_bank_reconciliation_matches_line (bank_statement_line_id, organisation_id, matched_at),
    KEY idx_bank_reconciliation_matches_payment (supplier_payment_id, organisation_id, matched_at),

    CONSTRAINT fk_bank_reconciliation_matches_line
        FOREIGN KEY (bank_statement_line_id, organisation_id) REFERENCES bank_statement_lines (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_bank_reconciliation_matches_payment
        FOREIGN KEY (supplier_payment_id, organisation_id)
        REFERENCES accounts_payable_supplier_payments (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_bank_reconciliation_matches_member
        FOREIGN KEY (matched_by_member_id, organisation_id) REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_bank_reconciliation_matches_amount CHECK (matched_amount > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE bank_reconciliation_match_reversals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    bank_reconciliation_match_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_bank_reconciliation_match_reversals_public (organisation_id, public_id),
    UNIQUE KEY uq_bank_reconciliation_match_reversals_match (organisation_id, bank_reconciliation_match_id),
    CONSTRAINT fk_bank_reconciliation_match_reversals_match
        FOREIGN KEY (bank_reconciliation_match_id, organisation_id)
        REFERENCES bank_reconciliation_matches (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_bank_reconciliation_match_reversals_member
        FOREIGN KEY (reversed_by_member_id, organisation_id) REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

INSERT INTO permissions (capability_id, permission_key, name, description, is_active)
VALUES
    (NULL, 'finance.bank.view', 'View bank reconciliation', 'View governed bank accounts, statements, statement lines and settlement evidence.', TRUE),
    (NULL, 'finance.bank.account.manage', 'Manage bank accounts', 'Configure bank accounts linked to accounting cash accounts.', TRUE),
    (NULL, 'finance.bank.statement.record', 'Record bank statements', 'Record provider-neutral bank statement evidence and transaction lines.', TRUE),
    (NULL, 'finance.bank.reconcile', 'Reconcile bank transactions', 'Match executed supplier payments to bank statement settlement evidence.', TRUE),
    (NULL, 'finance.bank.reconcile.reverse', 'Reverse bank reconciliation matches', 'Additively reverse incorrect bank settlement matches with evidence.', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), is_active = TRUE;

INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role.organisation_id, role.id, permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission ON permission.permission_key LIKE 'finance.bank.%'
WHERE role.name IN ('Owner', 'Administrator', 'Finance/Commercial')
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Bank reconciliation evidence is forward-only because it can participate in period-close assurance.
SELECT 1;
