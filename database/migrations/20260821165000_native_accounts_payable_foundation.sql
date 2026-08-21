-- NuBlox Wave A1 native accounts-payable and three-way-match foundation
-- Extends canonical Party, Project, Purchase Order, Receipt, Tax and member models.
-- No accounting journal posting or supplier payment execution is introduced by A1.
-- migrate:up transaction:false

ALTER TABLE purchase_order_receipt_items
    ADD UNIQUE KEY uq_purchase_order_receipt_items_id_organisation (id, organisation_id);

CREATE TABLE accounts_payable_documents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    document_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    supplier_party_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    purchase_order_id BIGINT UNSIGNED NULL,
    supplier_document_number VARCHAR(160) NOT NULL,
    invoice_date DATE NOT NULL,
    tax_date DATE NULL,
    due_date DATE NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    net_amount DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    tax_amount DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    gross_amount DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    submitted_at DATETIME(6) NULL,
    approved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounts_payable_documents_public (organisation_id, public_id),
    UNIQUE KEY uq_accounts_payable_documents_id_organisation (id, organisation_id),
    UNIQUE KEY uq_accounts_payable_documents_supplier_reference (
        organisation_id, supplier_party_id, document_type, supplier_document_number
    ),
    KEY idx_accounts_payable_documents_status (organisation_id, lifecycle_status, due_date),
    KEY idx_accounts_payable_documents_supplier (supplier_party_id, organisation_id, invoice_date),
    KEY idx_accounts_payable_documents_project (project_id, organisation_id, invoice_date),
    KEY idx_accounts_payable_documents_po (purchase_order_id, organisation_id),

    CONSTRAINT fk_accounts_payable_documents_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_documents_supplier
        FOREIGN KEY (supplier_party_id, organisation_id) REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_documents_project
        FOREIGN KEY (project_id, organisation_id) REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_documents_po
        FOREIGN KEY (purchase_order_id, organisation_id) REFERENCES purchase_orders (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_documents_created_by
        FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_accounts_payable_documents_type
        CHECK (document_type IN ('invoice', 'credit_note')),
    CONSTRAINT ck_accounts_payable_documents_status
        CHECK (lifecycle_status IN ('draft', 'submitted', 'matching', 'exception', 'approved', 'rejected', 'void')),
    CONSTRAINT ck_accounts_payable_documents_amounts
        CHECK (net_amount >= 0 AND tax_amount >= 0 AND gross_amount = net_amount + tax_amount)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounts_payable_document_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    accounts_payable_document_id BIGINT UNSIGNED NOT NULL,
    source_purchase_order_item_id BIGINT UNSIGNED NULL,
    unit_of_measure_id SMALLINT UNSIGNED NULL,
    line_number INT UNSIGNED NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(19,6) NOT NULL,
    unit_rate DECIMAL(19,4) NOT NULL,
    net_amount DECIMAL(19,4) NOT NULL,
    tax_amount DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    gross_amount DECIMAL(19,4) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounts_payable_document_items_id_organisation (id, organisation_id),
    UNIQUE KEY uq_accounts_payable_document_items_line (organisation_id, accounts_payable_document_id, line_number),
    KEY idx_accounts_payable_document_items_po_item (source_purchase_order_item_id, organisation_id),

    CONSTRAINT fk_accounts_payable_document_items_document
        FOREIGN KEY (accounts_payable_document_id, organisation_id)
        REFERENCES accounts_payable_documents (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_document_items_po_item
        FOREIGN KEY (source_purchase_order_item_id, organisation_id)
        REFERENCES purchase_order_items (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_document_items_unit
        FOREIGN KEY (unit_of_measure_id) REFERENCES units_of_measure (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_accounts_payable_document_items_line CHECK (line_number > 0),
    CONSTRAINT ck_accounts_payable_document_items_quantity CHECK (quantity > 0),
    CONSTRAINT ck_accounts_payable_document_items_rate CHECK (unit_rate >= 0),
    CONSTRAINT ck_accounts_payable_document_items_amounts
        CHECK (net_amount >= 0 AND tax_amount >= 0 AND gross_amount = net_amount + tax_amount)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounts_payable_document_item_taxes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    accounts_payable_document_item_id BIGINT UNSIGNED NOT NULL,
    tax_category_id BIGINT UNSIGNED NOT NULL,
    applied_rate_percent DECIMAL(9,4) NOT NULL,
    taxable_amount DECIMAL(19,4) NOT NULL,
    tax_amount DECIMAL(19,4) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounts_payable_document_item_taxes_id_organisation (id, organisation_id),
    UNIQUE KEY uq_accounts_payable_document_item_taxes_category (
        organisation_id, accounts_payable_document_item_id, tax_category_id
    ),
    CONSTRAINT fk_accounts_payable_document_item_taxes_item
        FOREIGN KEY (accounts_payable_document_item_id, organisation_id)
        REFERENCES accounts_payable_document_items (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_document_item_taxes_category
        FOREIGN KEY (tax_category_id, organisation_id) REFERENCES tax_categories (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_accounts_payable_document_item_taxes_rate
        CHECK (applied_rate_percent >= 0.0000 AND applied_rate_percent <= 100.0000),
    CONSTRAINT ck_accounts_payable_document_item_taxes_amounts
        CHECK (taxable_amount >= 0 AND tax_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounts_payable_supplier_snapshots (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    accounts_payable_document_id BIGINT UNSIGNED NOT NULL,
    supplier_party_id BIGINT UNSIGNED NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(320) NULL,
    tax_registration_number VARCHAR(80) NULL,
    address_line_1 VARCHAR(255) NULL,
    address_line_2 VARCHAR(255) NULL,
    address_line_3 VARCHAR(255) NULL,
    locality VARCHAR(160) NULL,
    city VARCHAR(160) NULL,
    region VARCHAR(160) NULL,
    postal_code VARCHAR(32) NULL,
    country_code CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NULL,
    captured_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounts_payable_supplier_snapshots_document (organisation_id, accounts_payable_document_id),
    UNIQUE KEY uq_accounts_payable_supplier_snapshots_id_organisation (id, organisation_id),
    CONSTRAINT fk_accounts_payable_supplier_snapshots_document
        FOREIGN KEY (accounts_payable_document_id, organisation_id)
        REFERENCES accounts_payable_documents (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_supplier_snapshots_party
        FOREIGN KEY (supplier_party_id, organisation_id) REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounts_payable_match_allocations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    accounts_payable_document_item_id BIGINT UNSIGNED NOT NULL,
    purchase_order_item_id BIGINT UNSIGNED NOT NULL,
    purchase_order_receipt_item_id BIGINT UNSIGNED NULL,
    matched_quantity DECIMAL(19,6) NOT NULL,
    matched_net_amount DECIMAL(19,4) NOT NULL,
    matched_by_member_id BIGINT UNSIGNED NOT NULL,
    matched_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounts_payable_match_allocations_id_organisation (id, organisation_id),
    KEY idx_accounts_payable_match_allocations_document_item (accounts_payable_document_item_id, organisation_id),
    KEY idx_accounts_payable_match_allocations_po_item (purchase_order_item_id, organisation_id),
    KEY idx_accounts_payable_match_allocations_receipt_item (purchase_order_receipt_item_id, organisation_id),
    CONSTRAINT fk_accounts_payable_match_allocations_document_item
        FOREIGN KEY (accounts_payable_document_item_id, organisation_id)
        REFERENCES accounts_payable_document_items (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_match_allocations_po_item
        FOREIGN KEY (purchase_order_item_id, organisation_id)
        REFERENCES purchase_order_items (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_match_allocations_receipt_item
        FOREIGN KEY (purchase_order_receipt_item_id, organisation_id)
        REFERENCES purchase_order_receipt_items (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_match_allocations_member
        FOREIGN KEY (matched_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_accounts_payable_match_allocations_quantity CHECK (matched_quantity > 0),
    CONSTRAINT ck_accounts_payable_match_allocations_amount CHECK (matched_net_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounts_payable_exceptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    accounts_payable_document_id BIGINT UNSIGNED NOT NULL,
    accounts_payable_document_item_id BIGINT UNSIGNED NULL,
    exception_code VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    severity VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'blocking',
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    message VARCHAR(1000) NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    resolved_by_member_id BIGINT UNSIGNED NULL,
    resolution_note VARCHAR(1000) NULL,
    resolved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounts_payable_exceptions_public (organisation_id, public_id),
    UNIQUE KEY uq_accounts_payable_exceptions_id_organisation (id, organisation_id),
    KEY idx_accounts_payable_exceptions_document (accounts_payable_document_id, organisation_id, status),
    CONSTRAINT fk_accounts_payable_exceptions_document
        FOREIGN KEY (accounts_payable_document_id, organisation_id)
        REFERENCES accounts_payable_documents (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_exceptions_item
        FOREIGN KEY (accounts_payable_document_item_id, organisation_id)
        REFERENCES accounts_payable_document_items (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_exceptions_created_by
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_exceptions_resolved_by
        FOREIGN KEY (resolved_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_accounts_payable_exceptions_severity CHECK (severity IN ('warning', 'blocking')),
    CONSTRAINT ck_accounts_payable_exceptions_status CHECK (status IN ('open', 'resolved', 'waived'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounts_payable_approval_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    accounts_payable_document_id BIGINT UNSIGNED NOT NULL,
    decision VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    decided_by_member_id BIGINT UNSIGNED NOT NULL,
    decision_note VARCHAR(1000) NULL,
    decided_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounts_payable_approval_events_public (organisation_id, public_id),
    UNIQUE KEY uq_accounts_payable_approval_events_id_organisation (id, organisation_id),
    KEY idx_accounts_payable_approval_events_document (accounts_payable_document_id, organisation_id, decided_at),
    CONSTRAINT fk_accounts_payable_approval_events_document
        FOREIGN KEY (accounts_payable_document_id, organisation_id)
        REFERENCES accounts_payable_documents (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_payable_approval_events_member
        FOREIGN KEY (decided_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_accounts_payable_approval_events_decision
        CHECK (decision IN ('approved', 'rejected', 'returned'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

INSERT INTO permissions (capability_id, permission_key, name, description, is_active)
VALUES
    (NULL, 'finance.ap.view', 'View accounts payable', 'View supplier invoices, matching evidence, exceptions and approval status.', TRUE),
    (NULL, 'finance.ap.invoice.create', 'Create supplier invoices', 'Capture native supplier invoices and credit notes.', TRUE),
    (NULL, 'finance.ap.invoice.draft.manage', 'Manage supplier invoice drafts', 'Edit supplier invoices before controlled submission.', TRUE),
    (NULL, 'finance.ap.invoice.submit', 'Submit supplier invoices', 'Submit supplier invoices for matching and approval.', TRUE),
    (NULL, 'finance.ap.match.manage', 'Manage invoice matching', 'Create controlled supplier-invoice allocations against purchase-order and receipt facts.', TRUE),
    (NULL, 'finance.ap.exception.resolve', 'Resolve AP exceptions', 'Resolve or waive supplier-invoice matching exceptions with evidence.', TRUE),
    (NULL, 'finance.ap.approve', 'Approve supplier invoices', 'Approve a matched supplier invoice under maker-checker controls.', TRUE),
    (NULL, 'finance.ap.invoice.void', 'Void supplier invoice', 'Void an eligible pre-posting supplier invoice without deleting its evidence.', TRUE)
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
    'finance.ap.view', 'finance.ap.invoice.create', 'finance.ap.invoice.draft.manage',
    'finance.ap.invoice.submit', 'finance.ap.match.manage', 'finance.ap.exception.resolve',
    'finance.ap.approve', 'finance.ap.invoice.void'
)
WHERE role.name = 'Finance/Commercial' AND role.is_active = TRUE AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- AP financial evidence is forward-only.
SELECT 1;
