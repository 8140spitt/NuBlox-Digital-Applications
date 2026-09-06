-- F01 Strategy & Enterprise Planning — Tranche A
-- Canonical organisation-owned strategic intent, environmental analysis, strategic options and objectives.
-- migrate:up transaction:false

CREATE TABLE strategy_frameworks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    framework_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    horizon_start DATE NOT NULL,
    horizon_end DATE NOT NULL,
    purpose_text TEXT NOT NULL,
    vision_text TEXT NOT NULL,
    mission_text TEXT NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    supersedes_strategy_framework_id BIGINT UNSIGNED NULL,
    owner_member_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    approved_by_member_id BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_framework_public (organisation_id, public_id),
    UNIQUE KEY uq_strategy_framework_version (organisation_id, framework_code, version_number),
    KEY ix_strategy_framework_status (organisation_id, framework_code, lifecycle_status),
    CONSTRAINT fk_strategy_framework_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_framework_supersedes
        FOREIGN KEY (supersedes_strategy_framework_id) REFERENCES strategy_frameworks(id),
    CONSTRAINT fk_strategy_framework_owner
        FOREIGN KEY (owner_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_framework_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_framework_approved_by
        FOREIGN KEY (approved_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_framework_version CHECK (version_number >= 1),
    CONSTRAINT chk_strategy_framework_horizon CHECK (horizon_end >= horizon_start),
    CONSTRAINT chk_strategy_framework_status CHECK (lifecycle_status IN ('draft', 'approved', 'superseded'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_environment_factors (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_framework_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    context_scope VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    dimension VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    direction VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    analysis_text TEXT NOT NULL,
    evidence_reference TEXT NULL,
    observed_on DATE NULL,
    likelihood_score TINYINT UNSIGNED NULL,
    impact_score TINYINT UNSIGNED NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    owner_member_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_environment_factor_public (organisation_id, public_id),
    KEY ix_strategy_environment_factor_framework (strategy_framework_id, dimension, direction),
    CONSTRAINT fk_strategy_environment_factor_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_environment_factor_framework
        FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id),
    CONSTRAINT fk_strategy_environment_factor_owner
        FOREIGN KEY (owner_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_environment_factor_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_environment_scope CHECK (context_scope IN ('internal', 'external')),
    CONSTRAINT chk_strategy_environment_dimension CHECK (dimension IN ('economic', 'competitive', 'market', 'technology', 'regulatory', 'operational', 'other')),
    CONSTRAINT chk_strategy_environment_direction CHECK (direction IN ('strength', 'weakness', 'opportunity', 'threat', 'neutral')),
    CONSTRAINT chk_strategy_environment_likelihood CHECK (likelihood_score IS NULL OR likelihood_score BETWEEN 1 AND 5),
    CONSTRAINT chk_strategy_environment_impact CHECK (impact_score IS NULL OR impact_score BETWEEN 1 AND 5),
    CONSTRAINT chk_strategy_environment_status CHECK (lifecycle_status IN ('active', 'retired'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_options (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_framework_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    evaluation_summary TEXT NULL,
    decision_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'proposed',
    decision_rationale TEXT NULL,
    priority_rank INT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    decided_by_member_id BIGINT UNSIGNED NULL,
    decided_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_option_public (organisation_id, public_id),
    KEY ix_strategy_option_framework (strategy_framework_id, decision_status, priority_rank),
    CONSTRAINT fk_strategy_option_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_option_framework
        FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id),
    CONSTRAINT fk_strategy_option_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_option_decided_by
        FOREIGN KEY (decided_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_option_status CHECK (decision_status IN ('proposed', 'selected', 'rejected')),
    CONSTRAINT chk_strategy_option_priority CHECK (priority_rank IS NULL OR priority_rank >= 1)
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_objectives (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_framework_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    objective_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority_rank INT UNSIGNED NOT NULL,
    owner_member_id BIGINT UNSIGNED NULL,
    target_date DATE NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_objective_public (organisation_id, public_id),
    UNIQUE KEY uq_strategy_objective_code (strategy_framework_id, objective_code),
    KEY ix_strategy_objective_framework (strategy_framework_id, lifecycle_status, priority_rank),
    CONSTRAINT fk_strategy_objective_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_objective_framework
        FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id),
    CONSTRAINT fk_strategy_objective_owner
        FOREIGN KEY (owner_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_objective_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_objective_status CHECK (lifecycle_status IN ('draft', 'active', 'achieved', 'retired')),
    CONSTRAINT chk_strategy_objective_priority CHECK (priority_rank >= 1)
)
ENGINE=InnoDB
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
    (NULL, 'strategy.view', 'View enterprise strategy', 'View organisation strategic frameworks, environmental analysis, options and objectives.', TRUE),
    (NULL, 'strategy.manage', 'Manage enterprise strategy', 'Create and revise organisation strategic intent, analysis, options and objectives.', TRUE),
    (NULL, 'strategy.approve', 'Approve enterprise strategy', 'Approve a strategy version and supersede the previously approved version.', TRUE)
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
    ON (
        (
            role.name IN ('Owner', 'Administrator', 'Manager')
            AND permission.permission_key IN ('strategy.view', 'strategy.manage', 'strategy.approve')
        )
        OR (
            role.name IN ('Member/Professional', 'Finance/Commercial', 'Read Only')
            AND permission.permission_key = 'strategy.view'
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Strategy records and released permission grants are forward-only because approved
-- versions are attributable enterprise evidence. Non-production environments are rebuilt.
SELECT 1;
