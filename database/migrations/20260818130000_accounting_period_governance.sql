-- NuBlox Package 004M controlled accounting periods and close governance
-- Adds tenant financial years, accounting periods, additive state transitions and additive reopen evidence.
-- Period governance constrains future accounting evidence and never rewrites operational source facts or posted journals.
-- migrate:up transaction:false

CREATE TABLE accounting_financial_years (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(80) NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounting_financial_years_public (organisation_id, public_id),
    UNIQUE KEY uq_accounting_financial_years_dates (organisation_id, starts_on, ends_on),
    UNIQUE KEY uq_accounting_financial_years_id_organisation (id, organisation_id),
    KEY idx_accounting_financial_years_dates (organisation_id, starts_on, ends_on),

    CONSTRAINT fk_accounting_financial_years_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_financial_years_created_by
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_financial_years_dates
        CHECK (ends_on >= starts_on)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounting_periods (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    financial_year_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    period_number SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(80) NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    state VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    state_version INT UNSIGNED NOT NULL DEFAULT 1,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounting_periods_public (organisation_id, public_id),
    UNIQUE KEY uq_accounting_periods_year_number (organisation_id, financial_year_id, period_number),
    UNIQUE KEY uq_accounting_periods_dates (organisation_id, starts_on, ends_on),
    UNIQUE KEY uq_accounting_periods_id_organisation (id, organisation_id),
    KEY idx_accounting_periods_lookup (organisation_id, starts_on, ends_on, state),

    CONSTRAINT fk_accounting_periods_financial_year
        FOREIGN KEY (financial_year_id, organisation_id)
        REFERENCES accounting_financial_years (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_periods_created_by
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_periods_number
        CHECK (period_number > 0),
    CONSTRAINT ck_accounting_periods_dates
        CHECK (ends_on >= starts_on),
    CONSTRAINT ck_accounting_periods_state
        CHECK (state IN ('open', 'soft_closed', 'hard_closed')),
    CONSTRAINT ck_accounting_periods_state_version
        CHECK (state_version > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounting_period_state_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    accounting_period_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    from_state VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    to_state VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    state_version INT UNSIGNED NOT NULL,
    acted_by_member_id BIGINT UNSIGNED NOT NULL,
    acted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounting_period_state_events_public (organisation_id, public_id),
    UNIQUE KEY uq_accounting_period_state_events_version (organisation_id, accounting_period_id, state_version),
    KEY idx_accounting_period_state_events_period (accounting_period_id, organisation_id, acted_at),

    CONSTRAINT fk_accounting_period_state_events_period
        FOREIGN KEY (accounting_period_id, organisation_id)
        REFERENCES accounting_periods (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_period_state_events_member
        FOREIGN KEY (acted_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_period_state_events_from
        CHECK (from_state IN ('open', 'soft_closed', 'hard_closed')),
    CONSTRAINT ck_accounting_period_state_events_to
        CHECK (to_state IN ('open', 'soft_closed', 'hard_closed')),
    CONSTRAINT ck_accounting_period_state_events_changed
        CHECK (from_state <> to_state),
    CONSTRAINT ck_accounting_period_state_events_version
        CHECK (state_version > 1)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounting_period_reopen_authorities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    accounting_period_id BIGINT UNSIGNED NOT NULL,
    state_event_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    prior_state VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    authorised_by_member_id BIGINT UNSIGNED NOT NULL,
    authorised_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounting_period_reopen_authorities_public (organisation_id, public_id),
    UNIQUE KEY uq_accounting_period_reopen_authorities_event (organisation_id, state_event_id),
    KEY idx_accounting_period_reopen_authorities_period (accounting_period_id, organisation_id, authorised_at),

    CONSTRAINT fk_accounting_period_reopen_authorities_period
        FOREIGN KEY (accounting_period_id, organisation_id)
        REFERENCES accounting_periods (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_period_reopen_authorities_event
        FOREIGN KEY (state_event_id, organisation_id)
        REFERENCES accounting_period_state_events (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_period_reopen_authorities_member
        FOREIGN KEY (authorised_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_period_reopen_authorities_prior
        CHECK (prior_state IN ('soft_closed', 'hard_closed'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

INSERT INTO permissions (capability_id, permission_key, name, description, is_active)
VALUES
    (NULL, 'finance.accounting.period.view', 'View accounting periods', 'View financial years, accounting periods and immutable close/reopen evidence.', TRUE),
    (NULL, 'finance.accounting.period.configure', 'Configure accounting periods', 'Create tenant financial years and accounting periods.', TRUE),
    (NULL, 'finance.accounting.period.soft-close', 'Soft-close accounting period', 'Soft-close an open accounting period to block routine posting while preserving controlled correction paths.', TRUE),
    (NULL, 'finance.accounting.period.hard-close', 'Hard-close accounting period', 'Hard-close an accounting period so no new accounting evidence may be dated into it without an explicit reopen.', TRUE),
    (NULL, 'finance.accounting.period.reopen', 'Reopen accounting period', 'Reopen a closed accounting period with additive strong-authority evidence and a mandatory reason.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role.organisation_id, role.id, permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission
    ON permission.permission_key IN (
        'finance.accounting.period.view',
        'finance.accounting.period.configure',
        'finance.accounting.period.soft-close',
        'finance.accounting.period.hard-close',
        'finance.accounting.period.reopen'
    )
WHERE role.name IN ('Owner', 'Administrator')
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role.organisation_id, role.id, permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission
    ON permission.permission_key = 'finance.accounting.period.view'
WHERE role.name = 'Finance/Commercial'
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Accounting close/reopen evidence is forward-only.
SELECT 1;
