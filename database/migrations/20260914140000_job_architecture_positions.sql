-- NuBlox job architecture operational bridge.
-- Canonical generated job profiles remain reproducible reference data; tenant positions and assignments are operational records.
-- migrate:up transaction:false

SET NAMES utf8mb4;
SET time_zone = '+00:00';

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'organisation.structure.view', 'View organisation structure', 'View canonical job architecture, tenant positions and position assignments.', TRUE),
    (NULL, 'organisation.structure.manage', 'Manage organisation structure', 'Create and maintain tenant positions and assign organisation members to governed positions.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

CREATE TABLE organisation_positions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    position_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    job_profile_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title_override VARCHAR(200) NULL,
    reports_to_position_id BIGINT UNSIGNED NULL,
    fte DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    valid_from DATE NULL,
    valid_to DATE NULL,
    position_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_organisation_position_public (organisation_id, public_id),
    UNIQUE KEY uq_organisation_position_code (organisation_id, position_code),
    UNIQUE KEY uq_organisation_position_tenant (id, organisation_id),
    KEY ix_organisation_position_profile (organisation_id, job_profile_key, position_status),
    KEY ix_organisation_position_reports_to (organisation_id, reports_to_position_id),
    CONSTRAINT fk_organisation_position_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_organisation_position_reports_to
        FOREIGN KEY (reports_to_position_id, organisation_id)
        REFERENCES organisation_positions(id, organisation_id),
    CONSTRAINT fk_organisation_position_created_by
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members(id, organisation_id),
    CONSTRAINT chk_organisation_position_status CHECK (
        position_status IN ('planned', 'open', 'frozen', 'closed')
    ),
    CONSTRAINT chk_organisation_position_fte CHECK (fte > 0 AND fte <= 1.00),
    CONSTRAINT chk_organisation_position_dates CHECK (
        valid_from IS NULL OR valid_to IS NULL OR valid_to >= valid_from
    )
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE position_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    position_id BIGINT UNSIGNED NOT NULL,
    organisation_member_id BIGINT UNSIGNED NOT NULL,
    assignment_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'primary',
    allocation_percent DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    assignment_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_position_assignment_public (organisation_id, public_id),
    UNIQUE KEY uq_position_assignment_start (
        organisation_id, position_id, organisation_member_id, assignment_type, start_date
    ),
    KEY ix_position_assignment_member (organisation_id, organisation_member_id, assignment_status),
    KEY ix_position_assignment_position (organisation_id, position_id, assignment_status),
    CONSTRAINT fk_position_assignment_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_position_assignment_position
        FOREIGN KEY (position_id, organisation_id)
        REFERENCES organisation_positions(id, organisation_id),
    CONSTRAINT fk_position_assignment_member
        FOREIGN KEY (organisation_member_id, organisation_id)
        REFERENCES organisation_members(id, organisation_id),
    CONSTRAINT fk_position_assignment_created_by
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members(id, organisation_id),
    CONSTRAINT chk_position_assignment_type CHECK (
        assignment_type IN ('primary', 'acting', 'secondary')
    ),
    CONSTRAINT chk_position_assignment_status CHECK (
        assignment_status IN ('planned', 'active', 'ended')
    ),
    CONSTRAINT chk_position_assignment_allocation CHECK (
        allocation_percent > 0 AND allocation_percent <= 100.00
    ),
    CONSTRAINT chk_position_assignment_dates CHECK (
        end_date IS NULL OR end_date >= start_date
    )
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role_permission.organisation_id, role_permission.organisation_role_id, structure_permission.id
FROM role_permissions role_permission
JOIN permissions organisation_permission
  ON organisation_permission.id = role_permission.permission_id
 AND organisation_permission.permission_key = 'organisation.manage'
 AND organisation_permission.is_active = TRUE
JOIN permissions structure_permission
  ON structure_permission.permission_key IN ('organisation.structure.view', 'organisation.structure.manage')
 AND structure_permission.is_active = TRUE;

-- migrate:down transaction:false
DROP TABLE position_assignments;
DROP TABLE organisation_positions;

-- Released permission catalogue rows are intentionally retained on rollback.
SELECT 1;
