-- NuBlox supplier-payment digital thread
-- Extends native Accounts Payable through controlled liability settlement and accounting consequences.
-- migrate:up transaction:false

CREATE TABLE accounts_payable_supplier_payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    supplier_party_id BIGINT UNSIGNED NOT NULL,
    payment_method_id SMALLINT UNSIGNED NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    requested_payment_date DATE NOT NULL,
    payment_reference VARCHAR(160) NULL,
    payment_amount DECIMAL(19,4) NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending_approval',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    approved_by_member_id BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    executed_by_member_id BIGINT UNSIGNED NULL,
    executed_at DATETIME(6) NULL,
    cancelled_by_member_id BIGINT UNSIGNED NULL,
    cancellation_reason VARCHAR(1000) NULL,
    cancelled_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounts_payable_supplier_payments_public (organisation_id, public_id),
    UNIQUE KEY uq_accounts_payable_supplier_payments_id_organisation (id, organisation_id),
    KEY idx_accounts_payable_supplier_payments_supplier (supplier_party_id, organisation_id, requested_payment_date),
    KEY idx_accounts_payable_supplier_payments_status (organisation_id, lifecycle_status, requested_payment_date),

    CONSTRAINT fk_accounts_payable_supplier_payments_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_supplier_payments_supplier
        FOREIGN KEY (supplier_party_id, organisation_id) REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_supplier_payments_method
        FOREIGN KEY (payment_method_id) REFERENCES payment_methods (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_supplier_payments_created_by
        FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_supplier_payments_approved_by
        FOREIGN KEY (approved_by_member_id, organisation_id) REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_supplier_payments_executed_by
        FOREIGN KEY (executed_by_member_id, organisation_id) REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_supplier_payments_cancelled_by
        FOREIGN KEY (cancelled_by_member_id, organisation_id) REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_accounts_payable_supplier_payments_amount CHECK (payment_amount > 0),
    CONSTRAINT ck_accounts_payable_supplier_payments_status
        CHECK (lifecycle_status IN ('pending_approval', 'approved', 'executed', 'cancelled')),
    CONSTRAINT ck_accounts_payable_supplier_payments_approval_evidence
        CHECK ((approved_by_member_id IS NULL) = (approved_at IS NULL)),
    CONSTRAINT ck_accounts_payable_supplier_payments_execution_evidence
        CHECK ((executed_by_member_id IS NULL) = (executed_at IS NULL)),
    CONSTRAINT ck_accounts_payable_supplier_payments_cancellation_evidence
        CHECK ((cancelled_by_member_id IS NULL) = (cancelled_at IS NULL))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounts_payable_supplier_payment_allocations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    supplier_payment_id BIGINT UNSIGNED NOT NULL,
    accounts_payable_document_id BIGINT UNSIGNED NOT NULL,
    allocated_amount DECIMAL(19,4) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounts_payable_supplier_payment_allocations_id_organisation (id, organisation_id),
    UNIQUE KEY uq_accounts_payable_supplier_payment_allocations_document (
        organisation_id, supplier_payment_id, accounts_payable_document_id
    ),
    KEY idx_accounts_payable_supplier_payment_allocations_document (
        accounts_payable_document_id, organisation_id
    ),
    CONSTRAINT fk_accounts_payable_supplier_payment_allocations_payment
        FOREIGN KEY (supplier_payment_id, organisation_id)
        REFERENCES accounts_payable_supplier_payments (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_supplier_payment_allocations_document
        FOREIGN KEY (accounts_payable_document_id, organisation_id)
        REFERENCES accounts_payable_documents (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_accounts_payable_supplier_payment_allocations_amount CHECK (allocated_amount > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounts_payable_supplier_payment_reversals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    supplier_payment_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounts_payable_supplier_payment_reversals_public (organisation_id, public_id),
    UNIQUE KEY uq_accounts_payable_supplier_payment_reversals_payment (organisation_id, supplier_payment_id),
    UNIQUE KEY uq_accounts_payable_supplier_payment_reversals_id_organisation (id, organisation_id),
    CONSTRAINT fk_accounts_payable_supplier_payment_reversals_payment
        FOREIGN KEY (supplier_payment_id, organisation_id)
        REFERENCES accounts_payable_supplier_payments (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_supplier_payment_reversals_member
        FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE accounting_journal_entries
    DROP CHECK ck_accounting_journal_entries_source_type,
    ADD CONSTRAINT ck_accounting_journal_entries_source_type CHECK (
        source_type IN (
            'invoice_issue',
            'invoice_void',
            'credit_note_issue',
            'accounts_payable_invoice_approval',
            'accounts_payable_credit_note_approval',
            'supplier_payment_execution',
            'supplier_payment_reversal',
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
        )
    );

ALTER TABLE accounting_account_mappings
    DROP CHECK ck_accounting_account_mappings_key,
    ADD CONSTRAINT ck_accounting_account_mappings_key CHECK (
        mapping_key IN (
            'accounts_receivable',
            'sales_revenue',
            'vat_control',
            'cash_receipts',
            'customer_unapplied_cash',
            'bad_debt_expense',
            'bad_debt_recovery_income',
            'accounts_payable',
            'purchase_expense',
            'cash_disbursements',
            'retained_earnings'
        )
    );

INSERT INTO permissions (capability_id, permission_key, name, description, is_active)
VALUES
    (NULL, 'finance.ap.payment.create', 'Create supplier payments', 'Create controlled supplier-payment requests against posted AP liabilities.', TRUE),
    (NULL, 'finance.ap.payment.approve', 'Approve supplier payments', 'Approve supplier-payment requests under maker-checker controls.', TRUE),
    (NULL, 'finance.ap.payment.execute', 'Execute supplier payments', 'Record controlled execution of approved supplier payments.', TRUE),
    (NULL, 'finance.ap.payment.cancel', 'Cancel supplier payments', 'Cancel unexecuted supplier-payment requests with evidence.', TRUE),
    (NULL, 'finance.ap.payment.reverse', 'Reverse supplier payments', 'Record additive reversal of an executed supplier payment.', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), is_active = TRUE;

INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role.organisation_id, role.id, permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission ON permission.permission_key LIKE 'finance.ap.%'
WHERE role.name IN ('Owner', 'Administrator') AND role.is_active = TRUE AND permission.is_active = TRUE;

INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role.organisation_id, role.id, permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission ON permission.permission_key IN (
    'finance.ap.payment.create', 'finance.ap.payment.approve', 'finance.ap.payment.execute',
    'finance.ap.payment.cancel', 'finance.ap.payment.reverse'
)
WHERE role.name = 'Finance/Commercial' AND role.is_active = TRUE AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Supplier-payment financial evidence is forward-only.
SELECT 1;
