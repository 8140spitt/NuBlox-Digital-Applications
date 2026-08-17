-- NuBlox Package 004H collections automation policy
-- Adds versioned dunning policy, generated reminder evidence and delivery attempts.
-- No table introduced here stores or mutates authoritative receivable balances.
-- migrate:up transaction:false

CREATE TABLE receivable_collection_policies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    name VARCHAR(160) NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    activated_by_member_id BIGINT UNSIGNED NULL,
    activated_at DATETIME(6) NULL,
    retired_at DATETIME(6) NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_collection_policies_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_collection_policies_id_organisation (id, organisation_id),
    UNIQUE KEY uq_receivable_collection_policies_version (organisation_id, version_number),
    KEY idx_receivable_collection_policies_status (organisation_id, status, version_number),

    CONSTRAINT fk_receivable_collection_policies_created_by
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_policies_activated_by
        FOREIGN KEY (activated_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_collection_policies_status
        CHECK (status IN ('draft', 'active', 'retired')),
    CONSTRAINT ck_receivable_collection_policies_lifecycle
        CHECK (
            (status = 'draft' AND activated_by_member_id IS NULL AND activated_at IS NULL AND retired_at IS NULL)
            OR
            (status = 'active' AND activated_by_member_id IS NOT NULL AND activated_at IS NOT NULL AND retired_at IS NULL)
            OR
            (status = 'retired' AND activated_by_member_id IS NOT NULL AND activated_at IS NOT NULL AND retired_at IS NOT NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_collection_policy_stages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    collection_policy_id BIGINT UNSIGNED NOT NULL,
    sequence_number SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(160) NOT NULL,
    trigger_days_overdue SMALLINT UNSIGNED NOT NULL,
    delivery_channel VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'email',
    subject_template VARCHAR(255) NOT NULL,
    body_template TEXT NOT NULL,
    suppress_on_open_dispute TINYINT(1) NOT NULL DEFAULT 1,
    suppress_on_current_promise TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_collection_policy_stages_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_collection_policy_stages_id_organisation (id, organisation_id),
    UNIQUE KEY uq_receivable_collection_policy_stages_policy_sequence (collection_policy_id, organisation_id, sequence_number),
    UNIQUE KEY uq_receivable_collection_policy_stages_policy_trigger (collection_policy_id, organisation_id, trigger_days_overdue),

    CONSTRAINT fk_receivable_collection_policy_stages_policy
        FOREIGN KEY (collection_policy_id, organisation_id)
        REFERENCES receivable_collection_policies (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_collection_policy_stages_sequence
        CHECK (sequence_number > 0),
    CONSTRAINT ck_receivable_collection_policy_stages_trigger
        CHECK (trigger_days_overdue > 0),
    CONSTRAINT ck_receivable_collection_policy_stages_channel
        CHECK (delivery_channel = 'email'),
    CONSTRAINT ck_receivable_collection_policy_stages_suppression
        CHECK (suppress_on_open_dispute IN (0, 1) AND suppress_on_current_promise IN (0, 1))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_collection_reminders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    collection_case_id BIGINT UNSIGNED NOT NULL,
    collection_policy_id BIGINT UNSIGNED NOT NULL,
    policy_stage_id BIGINT UNSIGNED NOT NULL,
    customer_party_id BIGINT UNSIGNED NOT NULL,
    recipient_party_id BIGINT UNSIGNED NULL,
    recipient_email VARCHAR(320) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message_body TEXT NOT NULL,
    as_of_date DATE NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    generated_by_member_id BIGINT UNSIGNED NOT NULL,
    generated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    sent_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_collection_reminders_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_collection_reminders_id_organisation (id, organisation_id),
    UNIQUE KEY uq_receivable_collection_reminders_case_stage (collection_case_id, organisation_id, policy_stage_id),
    KEY idx_receivable_collection_reminders_status (organisation_id, status, generated_at),
    KEY idx_receivable_collection_reminders_customer (customer_party_id, organisation_id, generated_at),

    CONSTRAINT fk_receivable_collection_reminders_case
        FOREIGN KEY (collection_case_id, organisation_id)
        REFERENCES receivable_collection_cases (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_reminders_policy
        FOREIGN KEY (collection_policy_id, organisation_id)
        REFERENCES receivable_collection_policies (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_reminders_stage
        FOREIGN KEY (policy_stage_id, organisation_id)
        REFERENCES receivable_collection_policy_stages (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_reminders_customer
        FOREIGN KEY (customer_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_reminders_recipient
        FOREIGN KEY (recipient_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_reminders_generated_by
        FOREIGN KEY (generated_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_collection_reminders_status
        CHECK (status IN ('pending', 'sent')),
    CONSTRAINT ck_receivable_collection_reminders_sent
        CHECK ((status = 'pending' AND sent_at IS NULL) OR (status = 'sent' AND sent_at IS NOT NULL))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE receivable_collection_reminder_deliveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reminder_id BIGINT UNSIGNED NOT NULL,
    attempt_number SMALLINT UNSIGNED NOT NULL,
    attempted_by_member_id BIGINT UNSIGNED NOT NULL,
    attempted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    outcome VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    error_message VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_receivable_collection_reminder_deliveries_public (organisation_id, public_id),
    UNIQUE KEY uq_receivable_collection_reminder_deliveries_id_organisation (id, organisation_id),
    UNIQUE KEY uq_receivable_collection_reminder_deliveries_attempt (reminder_id, organisation_id, attempt_number),

    CONSTRAINT fk_receivable_collection_reminder_deliveries_reminder
        FOREIGN KEY (reminder_id, organisation_id)
        REFERENCES receivable_collection_reminders (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_receivable_collection_reminder_deliveries_attempted_by
        FOREIGN KEY (attempted_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_receivable_collection_reminder_deliveries_attempt
        CHECK (attempt_number > 0),
    CONSTRAINT ck_receivable_collection_reminder_deliveries_outcome
        CHECK (outcome IN ('sent', 'failed')),
    CONSTRAINT ck_receivable_collection_reminder_deliveries_error
        CHECK ((outcome = 'sent' AND error_message IS NULL) OR (outcome = 'failed' AND error_message IS NOT NULL))
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
    (NULL, 'finance.collections.policy.manage', 'Manage collections policy', 'Create and activate versioned collections escalation policy and customer-facing reminder templates.', TRUE),
    (NULL, 'finance.collections.reminder.generate', 'Generate collections reminders', 'Generate immutable reminder snapshots from an active collections policy after revalidating live overdue eligibility.', TRUE),
    (NULL, 'finance.collections.reminder.dispatch', 'Dispatch collections reminders', 'Dispatch generated reminder snapshots through the configured provider-neutral delivery boundary and retain delivery-attempt evidence.', TRUE)
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
        'finance.collections.policy.manage',
        'finance.collections.reminder.generate',
        'finance.collections.reminder.dispatch'
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
        'finance.collections.reminder.generate',
        'finance.collections.reminder.dispatch'
    )
WHERE role.name = 'Finance/Commercial'
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released collections automation policy and delivery evidence are forward-only.
SELECT 1;
