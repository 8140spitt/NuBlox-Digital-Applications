-- migrate:up

-- Package 004J — Controlled Bad Debt, Write-off and Recovery

INSERT INTO permissions (public_id, permission_key, name, description, is_active)
VALUES
(UUID(), 'finance.bad_debt.view', 'View bad debt', 'View controlled receivable write-off and recovery evidence.', TRUE),
(UUID(), 'finance.bad_debt.write_off', 'Write off receivable', 'Record a controlled partial or full receivable write-off.', TRUE),
(UUID(), 'finance.bad_debt.write_off.reverse', 'Reverse receivable write-off', 'Reverse an existing receivable write-off with evidence.', TRUE),
(UUID(), 'finance.bad_debt.recovery', 'Record bad-debt recovery', 'Apply an otherwise unallocated customer payment as recovery against written-off debt.', TRUE),
(UUID(), 'finance.bad_debt.recovery.reverse', 'Reverse bad-debt recovery', 'Reverse a bad-debt recovery with evidence.', TRUE)
ON DUPLICATE KEY UPDATE
name = VALUES(name), description = VALUES(description), is_active = VALUES(is_active);

UPDATE permissions SET umbrella_permission_key = 'finance.manage'
WHERE permission_key IN (
'finance.bad_debt.view','finance.bad_debt.write_off','finance.bad_debt.write_off.reverse',
'finance.bad_debt.recovery','finance.bad_debt.recovery.reverse');

CREATE TABLE receivable_write_offs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    invoice_document_id BIGINT UNSIGNED NOT NULL,
    customer_party_id BIGINT UNSIGNED NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    authorised_by_member_id BIGINT UNSIGNED NOT NULL,
    written_off_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_write_offs_public_id (public_id),
    UNIQUE KEY uq_receivable_write_offs_id_org (id, organisation_id),
    KEY idx_receivable_write_offs_invoice (invoice_document_id, organisation_id),
    KEY idx_receivable_write_offs_customer (customer_party_id, organisation_id, currency_code),
    CONSTRAINT fk_receivable_write_offs_invoice FOREIGN KEY (invoice_document_id, organisation_id)
        REFERENCES financial_documents (id, organisation_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_write_offs_customer FOREIGN KEY (customer_party_id, organisation_id)
        REFERENCES parties (id, organisation_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_write_offs_member FOREIGN KEY (authorised_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_write_offs_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_write_off_reversals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    write_off_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_write_off_reversals_public_id (public_id),
    UNIQUE KEY uq_receivable_write_off_reversals_writeoff (organisation_id, write_off_id),
    CONSTRAINT fk_receivable_write_off_reversals_writeoff FOREIGN KEY (write_off_id, organisation_id)
        REFERENCES receivable_write_offs (id, organisation_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_write_off_reversals_member FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_recoveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    write_off_id BIGINT UNSIGNED NOT NULL,
    payment_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    recorded_by_member_id BIGINT UNSIGNED NOT NULL,
    recovered_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_recoveries_public_id (public_id),
    UNIQUE KEY uq_receivable_recoveries_id_org (id, organisation_id),
    KEY idx_receivable_recoveries_writeoff (write_off_id, organisation_id),
    KEY idx_receivable_recoveries_payment (payment_id, organisation_id),
    CONSTRAINT fk_receivable_recoveries_writeoff FOREIGN KEY (write_off_id, organisation_id)
        REFERENCES receivable_write_offs (id, organisation_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_recoveries_payment FOREIGN KEY (payment_id, organisation_id)
        REFERENCES payments (id, organisation_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_recoveries_member FOREIGN KEY (recorded_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_recoveries_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_recovery_reversals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    recovery_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_recovery_reversals_public_id (public_id),
    UNIQUE KEY uq_receivable_recovery_reversals_recovery (organisation_id, recovery_id),
    CONSTRAINT fk_receivable_recovery_reversals_recovery FOREIGN KEY (recovery_id, organisation_id)
        REFERENCES receivable_recoveries (id, organisation_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_recovery_reversals_member FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM organisation_roles r JOIN permissions p
WHERE r.is_standard = TRUE
AND r.name IN ('Owner','Administrator','Finance/Commercial')
AND p.permission_key IN (
'finance.bad_debt.view','finance.bad_debt.write_off','finance.bad_debt.write_off.reverse',
'finance.bad_debt.recovery','finance.bad_debt.recovery.reverse');