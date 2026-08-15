-- NuBlox project workspace permission catalogue and standard-role defaults
-- Data-only forward migration. Project membership remains a separate mandatory scope check.
-- migrate:up transaction:false

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
        'project.create',
        'Create projects',
        'Create a project owned by the active organisation.',
        TRUE
    ),
    (
        NULL,
        'project.view',
        'View projects',
        'View projects where the active organisation and member both have active project scope.',
        TRUE
    ),
    (
        NULL,
        'project.manage',
        'Manage projects',
        'Manage lifecycle and administrative project state where project scope and ownership policy permit.',
        TRUE
    )
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- Existing organisations receive the same standard-role defaults that new
-- organisations receive from OrganisationBootstrapService. The permission grant
-- never replaces project_members scope: project.view/project.manage still require
-- active member-level project membership at runtime.
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
            AND permission.permission_key IN ('project.create', 'project.view', 'project.manage')
        )
        OR (
            role.name IN ('Finance/Commercial', 'Member/Professional', 'Field Worker', 'Read Only')
            AND permission.permission_key = 'project.view'
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue/grant rows are forward-only because role and
-- override history may depend on them. Non-production environments are rebuilt.
SELECT 1;
