-- NuBlox portal and cross-organisation collaboration permission catalogue and standard-role defaults
-- Data-only forward migration. Portal access never bypasses project participation or record assignment.
-- migrate:up transaction:false

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'portal.view', 'View collaboration portal', 'View project invitations, assigned shared work and explicitly shared project information.', TRUE),
    (NULL, 'portal.respond', 'Respond through collaboration portal', 'Complete explicitly assigned external RFI, submittal and instruction workflows.', TRUE),
    (NULL, 'portal.manage', 'Manage cross-organisation collaboration', 'Assign controlled information workflows and issue explicit portal shares to active project participants.', TRUE)
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
            AND permission.permission_key IN ('portal.view', 'portal.respond', 'portal.manage')
        )
        OR (
            role.name IN ('Member/Professional', 'Field Worker')
            AND permission.permission_key IN ('portal.view', 'portal.respond')
        )
        OR (
            role.name IN ('Finance/Commercial', 'Read Only')
            AND permission.permission_key = 'portal.view'
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue/grant rows are forward-only because role and
-- override history may depend on them. Non-production environments are rebuilt.
SELECT 1;
