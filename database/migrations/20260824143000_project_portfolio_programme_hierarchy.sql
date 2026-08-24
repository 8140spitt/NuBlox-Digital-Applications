-- NuBlox portfolio, programme and project hierarchy foundation
-- Adds organisation-owned portfolio/programme records and an optional programme parent for projects.
-- Existing standalone projects remain valid and are not backfilled into artificial hierarchy records.
-- migrate:up transaction:false

CREATE TABLE portfolios (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    portfolio_number VARCHAR(80) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    archived_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_portfolios_public_id (public_id),
    UNIQUE KEY uq_portfolios_organisation_number (organisation_id, portfolio_number),
    UNIQUE KEY uq_portfolios_id_organisation (id, organisation_id),
    KEY idx_portfolios_organisation_status (organisation_id, lifecycle_status),
    CONSTRAINT fk_portfolios_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id),
    CONSTRAINT fk_portfolios_created_by_member
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT chk_portfolios_lifecycle_status
        CHECK (lifecycle_status IN ('active', 'on_hold', 'closed', 'archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE programmes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    portfolio_id BIGINT UNSIGNED NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    programme_number VARCHAR(80) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    archived_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_programmes_public_id (public_id),
    UNIQUE KEY uq_programmes_organisation_number (organisation_id, programme_number),
    UNIQUE KEY uq_programmes_id_organisation (id, organisation_id),
    KEY idx_programmes_organisation_portfolio (organisation_id, portfolio_id),
    KEY idx_programmes_organisation_status (organisation_id, lifecycle_status),
    CONSTRAINT fk_programmes_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id),
    CONSTRAINT fk_programmes_portfolio_organisation
        FOREIGN KEY (portfolio_id, organisation_id)
        REFERENCES portfolios (id, organisation_id),
    CONSTRAINT fk_programmes_created_by_member
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT chk_programmes_lifecycle_status
        CHECK (lifecycle_status IN ('active', 'on_hold', 'closed', 'archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE projects
    ADD COLUMN programme_id BIGINT UNSIGNED NULL AFTER owning_organisation_id,
    ADD KEY idx_projects_programme_owner (programme_id, owning_organisation_id),
    ADD CONSTRAINT fk_projects_programme_owner
        FOREIGN KEY (programme_id, owning_organisation_id)
        REFERENCES programmes (id, organisation_id);

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (
        NULL,
        'project.portfolio.view',
        'View project portfolios',
        'View organisation-owned portfolio structures and their programme composition.',
        TRUE
    ),
    (
        NULL,
        'project.portfolio.manage',
        'Manage project portfolios',
        'Create and maintain organisation-owned portfolio structures.',
        TRUE
    ),
    (
        NULL,
        'project.programme.view',
        'View project programmes',
        'View organisation-owned programme structures and project composition.',
        TRUE
    ),
    (
        NULL,
        'project.programme.manage',
        'Manage project programmes',
        'Create programmes and assign organisation-owned projects into programme structure.',
        TRUE
    )
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
            AND permission.permission_key IN (
                'project.portfolio.view',
                'project.portfolio.manage',
                'project.programme.view',
                'project.programme.manage'
            )
        )
        OR (
            role.name IN ('Finance/Commercial', 'Member/Professional', 'Read Only')
            AND permission.permission_key IN ('project.portfolio.view', 'project.programme.view')
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
ALTER TABLE projects
    DROP FOREIGN KEY fk_projects_programme_owner,
    DROP INDEX idx_projects_programme_owner,
    DROP COLUMN programme_id;
DROP TABLE programmes;
DROP TABLE portfolios;
