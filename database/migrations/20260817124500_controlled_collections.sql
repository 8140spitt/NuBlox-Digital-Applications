-- NuBlox Package 004G controlled collections and dunning
-- Adds operational collections workflow facts without duplicating receivable balances.
-- migrate:up transaction:false

CREATE TABLE receivable_collection_cases (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    customer_party_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    assigned_member_id BIGINT UNSIGNED NULL,
    opened_by_member_id BIGINT UNSIGNED NOT NULL,
    opened_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    closed_by_member_id BIGINT UNSIGNED NULL,
    closed_at DATETIME(6) NULL,
    close_reason VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_collection_cases_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_collection_cases_id_organisation (id, organisation_id),
    KEY idx_receivable_collection_cases_customer (customer_party_id, organisation_id, status),
    KEY idx_receivable_collection_cases_assignee (assigned_member_id, organisation_id, status),

    CONSTRAINT fk_receivable_collection_cases_customer
        FOREIGN KEY (customer_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_cases_assignee
        FOREIGN KEY (assigned_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_cases_opened_by
        FOREIGN KEY (opened_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_cases_closed_by
        FOREIGN KEY (closed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_collection_cases_status
        CHECK (status IN ('open', 'paused', 'closed')),
    CONSTRAINT ck_receivable_collection_cases_closure
        CHECK (
            (status = 'closed' AND closed_by_member_id IS NOT NULL AND closed_at IS NOT NULL AND close_reason IS NOT NULL)
            OR
            (status IN ('open', 'paused') AND closed_by_member_id IS NULL AND closed_at IS NULL AND close_reason IS NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_promises_to_pay (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    collection_case_id BIGINT UNSIGNED NOT NULL,
    invoice_document_id BIGINT UNSIGNED NULL,
    promised_amount DECIMAL(19,4) NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    due_on DATE NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    recorded_by_member_id BIGINT UNSIGNED NOT NULL,
    recorded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    resolved_by_member_id BIGINT UNSIGNED NULL,
    resolved_at DATETIME(6) NULL,
    resolution_note VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_promises_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_promises_id_organisation (id, organisation_id),
    KEY idx_receivable_promises_case (collection_case_id, organisation_id, status, due_on),
    KEY idx_receivable_promises_invoice (invoice_document_id, organisation_id),

    CONSTRAINT fk_receivable_promises_case
        FOREIGN KEY (collection_case_id, organisation_id)
        REFERENCES receivable_collection_cases (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_promises_invoice
        FOREIGN KEY (invoice_document_id, organisation_id)
        REFERENCES invoices (financial_document_id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_promises_recorded_by
        FOREIGN KEY (recorded_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_promises_resolved_by
        FOREIGN KEY (resolved_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_promises_amount
        CHECK (promised_amount > 0),
    CONSTRAINT ck_receivable_promises_status
        CHECK (status IN ('open', 'kept', 'broken', 'cancelled')),
    CONSTRAINT ck_receivable_promises_resolution
        CHECK (
            (status = 'open' AND resolved_by_member_id IS NULL AND resolved_at IS NULL AND resolution_note IS NULL)
            OR
            (status IN ('kept', 'broken', 'cancelled') AND resolved_by_member_id IS NOT NULL AND resolved_at IS NOT NULL AND resolution_note IS NOT NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_disputes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    collection_case_id BIGINT UNSIGNED NOT NULL,
    invoice_document_id BIGINT UNSIGNED NULL,
    disputed_amount DECIMAL(19,4) NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
    reason TEXT NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    opened_by_member_id BIGINT UNSIGNED NOT NULL,
    opened_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    resolved_by_member_id BIGINT UNSIGNED NULL,
    resolved_at DATETIME(6) NULL,
    resolution_note VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_disputes_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_disputes_id_organisation (id, organisation_id),
    KEY idx_receivable_disputes_case (collection_case_id, organisation_id, status),
    KEY idx_receivable_disputes_invoice (invoice_document_id, organisation_id),

    CONSTRAINT fk_receivable_disputes_case
        FOREIGN KEY (collection_case_id, organisation_id)
        REFERENCES receivable_collection_cases (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_disputes_invoice
        FOREIGN KEY (invoice_document_id, organisation_id)
        REFERENCES invoices (financial_document_id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_disputes_opened_by
        FOREIGN KEY (opened_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_disputes_resolved_by
        FOREIGN KEY (resolved_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_disputes_status
        CHECK (status IN ('open', 'resolved', 'withdrawn')),
    CONSTRAINT ck_receivable_disputes_amount_currency
        CHECK (
            (disputed_amount IS NULL AND currency_code IS NULL)
            OR
            (disputed_amount IS NOT NULL AND disputed_amount > 0 AND currency_code IS NOT NULL)
        ),
    CONSTRAINT ck_receivable_disputes_resolution
        CHECK (
            (status = 'open' AND resolved_by_member_id IS NULL AND resolved_at IS NULL AND resolution_note IS NULL)
            OR
            (status IN ('resolved', 'withdrawn') AND resolved_by_member_id IS NOT NULL AND resolved_at IS NOT NULL AND resolution_note IS NOT NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_collection_actions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    collection_case_id BIGINT UNSIGNED NOT NULL,
    action_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    delivery_channel VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    recorded_by_member_id BIGINT UNSIGNED NOT NULL,
    contact_party_id BIGINT UNSIGNED NULL,
    invoice_document_id BIGINT UNSIGNED NULL,
    promise_to_pay_id BIGINT UNSIGNED NULL,
    dispute_id BIGINT UNSIGNED NULL,
    subject VARCHAR(255) NULL,
    message_body TEXT NULL,
    outcome VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_collection_actions_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_collection_actions_id_organisation (id, organisation_id),
    KEY idx_receivable_collection_actions_case (collection_case_id, organisation_id, occurred_at),
    KEY idx_receivable_collection_actions_invoice (invoice_document_id, organisation_id),
    KEY idx_receivable_collection_actions_promise (promise_to_pay_id, organisation_id),
    KEY idx_receivable_collection_actions_dispute (dispute_id, organisation_id),

    CONSTRAINT fk_receivable_collection_actions_case
        FOREIGN KEY (collection_case_id, organisation_id)
        REFERENCES receivable_collection_cases (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_actions_recorded_by
        FOREIGN KEY (recorded_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_actions_contact
        FOREIGN KEY (contact_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_actions_invoice
        FOREIGN KEY (invoice_document_id, organisation_id)
        REFERENCES invoices (financial_document_id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_actions_promise
        FOREIGN KEY (promise_to_pay_id, organisation_id)
        REFERENCES receivable_promises_to_pay (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_actions_dispute
        FOREIGN KEY (dispute_id, organisation_id)
        REFERENCES receivable_disputes (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_collection_actions_type
        CHECK (action_type IN (
            'case_opened',
            'case_paused',
            'case_resumed',
            'case_closed',
            'reminder',
            'phone_call',
            'note',
            'promise_recorded',
            'promise_kept',
            'promise_broken',
            'promise_cancelled',
            'dispute_opened',
            'dispute_resolved',
            'dispute_withdrawn'
        )),
    CONSTRAINT ck_receivable_collection_actions_channel
        CHECK (delivery_channel IS NULL OR delivery_channel IN ('email', 'portal', 'phone', 'letter', 'manual', 'other'))
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
    (NULL, 'finance.collections.view', 'View collections', 'View controlled collections cases, reminders, promises to pay and dispute evidence.', TRUE),
    (NULL, 'finance.collections.case.manage', 'Manage collections cases', 'Open, pause, resume and close customer collections cases.', TRUE),
    (NULL, 'finance.collections.action.record', 'Record collection actions', 'Record immutable reminders, calls and collection notes against an active customer collections case.', TRUE),
    (NULL, 'finance.collections.promise.manage', 'Manage promises to pay', 'Record and resolve controlled promises to pay without changing the receivable ledger.', TRUE),
    (NULL, 'finance.collections.dispute.manage', 'Manage receivable disputes', 'Record and resolve customer receivable disputes without changing issued financial-document facts.', TRUE)
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
        'finance.collections.view',
        'finance.collections.case.manage',
        'finance.collections.action.record',
        'finance.collections.promise.manage',
        'finance.collections.dispute.manage'
    )
WHERE role.name IN ('Owner', 'Administrator', 'Finance/Commercial')
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released operational collections facts and permission catalogue are forward-only.
SELECT 1;
