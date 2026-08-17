-- NuBlox Package 004I controlled credit limits and credit holds
-- Adds append-evidenced customer credit-limit policy, hold lifecycle and explicit override evidence.
-- Credit utilisation remains derived from authoritative issued receivable facts; no shadow balance is stored.
-- migrate:up transaction:false

CREATE TABLE receivable_credit_policies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    customer_party_id BIGINT UNSIGNED NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_credit_policies_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_credit_policies_id_organisation (id, organisation_id),
    UNIQUE KEY uq_receivable_credit_policies_customer_currency (organisation_id, customer_party_id, currency_code),
    KEY idx_receivable_credit_policies_customer (customer_party_id, organisation_id, currency_code),

    CONSTRAINT fk_receivable_credit_policies_customer
        FOREIGN KEY (customer_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_credit_policies_created_by
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_credit_policies_currency
        CHECK (currency_code REGEXP '^[A-Z]{3}$')
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_credit_policy_revisions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    credit_policy_id BIGINT UNSIGNED NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    credit_limit_amount DECIMAL(19,4) NULL,
    reason VARCHAR(1000) NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_credit_policy_revisions_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_credit_policy_revisions_id_organisation (id, organisation_id),
    UNIQUE KEY uq_receivable_credit_policy_revisions_policy_version (credit_policy_id, organisation_id, version_number),
    KEY idx_receivable_credit_policy_revisions_current (organisation_id, credit_policy_id, version_number),

    CONSTRAINT fk_receivable_credit_policy_revisions_policy
        FOREIGN KEY (credit_policy_id, organisation_id)
        REFERENCES receivable_credit_policies (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_credit_policy_revisions_created_by
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_credit_policy_revisions_version
        CHECK (version_number > 0),
    CONSTRAINT ck_receivable_credit_policy_revisions_limit
        CHECK (
            (is_enabled = 0 AND credit_limit_amount IS NULL)
            OR
            (is_enabled = 1 AND credit_limit_amount IS NOT NULL AND credit_limit_amount > 0)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_credit_holds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    customer_party_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    placed_reason VARCHAR(1000) NOT NULL,
    placed_by_member_id BIGINT UNSIGNED NOT NULL,
    placed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    released_reason VARCHAR(1000) NULL,
    released_by_member_id BIGINT UNSIGNED NULL,
    released_at DATETIME(6) NULL,
    active_customer_party_id BIGINT UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN status = 'active' THEN customer_party_id ELSE NULL END
    ) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_credit_holds_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_credit_holds_id_organisation (id, organisation_id),
    UNIQUE KEY uq_receivable_credit_holds_one_active (organisation_id, active_customer_party_id),
    KEY idx_receivable_credit_holds_customer (customer_party_id, organisation_id, status, placed_at),

    CONSTRAINT fk_receivable_credit_holds_customer
        FOREIGN KEY (customer_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_credit_holds_placed_by
        FOREIGN KEY (placed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_credit_holds_released_by
        FOREIGN KEY (released_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_credit_holds_status
        CHECK (status IN ('active', 'released')),
    CONSTRAINT ck_receivable_credit_holds_lifecycle
        CHECK (
            (status = 'active' AND released_reason IS NULL AND released_by_member_id IS NULL AND released_at IS NULL)
            OR
            (status = 'released' AND released_reason IS NOT NULL AND released_by_member_id IS NOT NULL AND released_at IS NOT NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_credit_control_overrides (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    customer_party_id BIGINT UNSIGNED NOT NULL,
    credit_policy_id BIGINT UNSIGNED NULL,
    credit_hold_id BIGINT UNSIGNED NULL,
    workflow_type VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    subject_public_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    outstanding_amount DECIMAL(19,4) NOT NULL,
    credit_limit_amount DECIMAL(19,4) NULL,
    reason VARCHAR(1000) NOT NULL,
    authorised_by_member_id BIGINT UNSIGNED NOT NULL,
    authorised_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_credit_control_overrides_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_credit_control_overrides_id_organisation (id, organisation_id),
    KEY idx_receivable_credit_control_overrides_customer (customer_party_id, organisation_id, authorised_at),
    KEY idx_receivable_credit_control_overrides_subject (organisation_id, workflow_type, subject_public_id, authorised_at),

    CONSTRAINT fk_receivable_credit_control_overrides_customer
        FOREIGN KEY (customer_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_credit_control_overrides_policy
        FOREIGN KEY (credit_policy_id, organisation_id)
        REFERENCES receivable_credit_policies (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_credit_control_overrides_hold
        FOREIGN KEY (credit_hold_id, organisation_id)
        REFERENCES receivable_credit_holds (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_credit_control_overrides_authorised_by
        FOREIGN KEY (authorised_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_credit_control_overrides_workflow
        CHECK (workflow_type IN ('quotation_conversion', 'contract_execution')),
    CONSTRAINT ck_receivable_credit_control_overrides_currency
        CHECK (currency_code REGEXP '^[A-Z]{3}$'),
    CONSTRAINT ck_receivable_credit_control_overrides_amounts
        CHECK (outstanding_amount >= 0 AND (credit_limit_amount IS NULL OR credit_limit_amount > 0)),
    CONSTRAINT ck_receivable_credit_control_overrides_evidence
        CHECK (credit_policy_id IS NOT NULL OR credit_hold_id IS NOT NULL)
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
    (NULL, 'finance.credit_control.view', 'View credit control', 'View customer credit limits, derived utilisation, active credit holds and override evidence.', TRUE),
    (NULL, 'finance.credit_control.policy.manage', 'Manage credit limits', 'Create, revise and disable customer credit-limit policy by currency.', TRUE),
    (NULL, 'finance.credit_control.hold.manage', 'Manage credit holds', 'Place and release explicit customer stop-trading credit holds with reasoned evidence.', TRUE),
    (NULL, 'finance.credit_control.override', 'Override credit control', 'Override an active credit hold or exhausted customer credit limit at a named commitment boundary with an explicit reason.', TRUE)
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
        'finance.credit_control.view',
        'finance.credit_control.policy.manage',
        'finance.credit_control.hold.manage',
        'finance.credit_control.override'
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
        'finance.credit_control.view',
        'finance.credit_control.policy.manage',
        'finance.credit_control.hold.manage'
    )
WHERE role.name = 'Finance/Commercial'
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released credit policy, hold and override evidence are forward-only.
SELECT 1;
