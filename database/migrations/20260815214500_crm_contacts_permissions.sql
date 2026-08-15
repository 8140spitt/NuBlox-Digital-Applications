-- NuBlox CRM/contact permission catalogue and standard-role defaults
-- Data-only forward migration. CRM records remain tenant-owned Package 002 parties.
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
        'crm.view',
        'View CRM',
        'View tenant-owned CRM organisations, people, contact methods and contact relationships.',
        TRUE
    ),
    (
        NULL,
        'crm.manage',
        'Manage CRM',
        'Create and maintain tenant-owned CRM parties, business roles, contact methods and organisation contacts.',
        TRUE
    )
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- Existing organisations receive the intended standard-role defaults. These are
-- organisation permission grants only; every CRM repository query remains scoped
-- by the active tenant organisation_id.
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
            AND permission.permission_key IN ('crm.view', 'crm.manage')
        )
        OR (
            role.name IN ('Finance/Commercial', 'Member/Professional', 'Read Only')
            AND permission.permission_key = 'crm.view'
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue/grant rows are forward-only because role and
-- override history may depend on them. Non-production environments are rebuilt.
SELECT 1;
