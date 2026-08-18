-- NuBlox Package 004M controlled accounting periods and close governance
-- Adds tenant financial-year/period facts and additive period-state evidence.
-- Journal/source facts remain immutable; period governance only controls accounting-date eligibility.
-- migrate:up transaction:false

CREATE TABLE accounting_financial_years (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    year_code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounting_financial_years_public (organisation_id, public_id),
    UNIQUE KEY uq_accounting_financial_years_code (organisation_id, year_code),
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
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    financial_year_id BIGINT UNSIGNED NOT NULL,
    period_number SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounting_periods_public (organisation_id, public_id),
    UNIQUE KEY uq_accounting_periods_id_organisation (id, organisation_id),
    UNIQUE KEY uq_accounting_periods_year_number (organisation_id, financial_year_id, period_number),
    KEY idx_accounting_periods_dates (organisation_id, starts_on, ends_on, status),
    KEY idx_accounting_periods_year (financial_year_id, organisation_id, period_number),

    CONSTRAINT fk_accounting_periods_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_periods_year
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
    CONSTRAINT ck_accounting_periods_status
        CHECK (status IN ('open', 'soft_closed', 'hard_closed'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE accounting_period_status_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    accounting_period_id BIGINT UNSIGNED NOT NULL,
    from_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    to_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    changed_by_member_id BIGINT UNSIGNED NOT NULL,
    changed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounting_period_status_events_public (organisation_id, public_id),
    UNIQUE KEY uq_accounting_period_status_events_id_organisation (id, organisation_id),
    KEY idx_accounting_period_status_events_period (accounting_period_id, organisation_id, changed_at),

    CONSTRAINT fk_accounting_period_status_events_period
        FOREIGN KEY (accounting_period_id, organisation_id)
        REFERENCES accounting_periods (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounting_period_status_events_member
        FOREIGN KEY (changed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_accounting_period_status_events_from
        CHECK (from_status IN ('open', 'soft_closed', 'hard_closed')),
    CONSTRAINT ck_accounting_period_status_events_to
        CHECK (to_status IN ('open', 'soft_closed', 'hard_closed')),
    CONSTRAINT ck_accounting_period_status_events_change
        CHECK (from_status <> to_status)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

INSERT INTO permissions (capability_id, permission_key, name, description, is_active)
VALUES
    (NULL, 'finance.accounting.period.configure', 'Configure accounting periods', 'Create tenant financial years and accounting periods.', TRUE),
    (NULL, 'finance.accounting.period.close', 'Close accounting periods', 'Soft-close and hard-close accounting periods under controlled accounting policy.', TRUE),
    (NULL, 'finance.accounting.period.reopen', 'Reopen accounting periods', 'Reopen a soft-closed or hard-closed accounting period with explicit reasoned evidence.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role.organisation_id, role.id, permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission
    ON permission.permission_key IN (
        'finance.accounting.period.configure',
        'finance.accounting.period.close',
        'finance.accounting.period.reopen'
    )
WHERE role.name IN ('Owner', 'Administrator')
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Financial-year/period governance evidence is forward-only.
SELECT 1;
