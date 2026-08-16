-- NuBlox accepted quotation to project conversion activation
-- Data/reference-only forward migration over Package 003 conversion structures.
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
        'commercial.quotation.convert',
        'Convert accepted quotations to projects',
        'Authorise conversion of an accepted issued quotation version into a NuBlox project. Runtime conversion also requires project.create.',
        TRUE
    )
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- Commercial conversion authority and project-creation authority remain distinct.
-- Owner/Administrator already hold project.create. Finance/Commercial receives the
-- commercial conversion key but still needs project.create to be delegated before
-- it can perform the cross-domain conversion transaction.
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
    ON permission.permission_key = 'commercial.quotation.convert'
WHERE role.name IN ('Owner', 'Administrator', 'Finance/Commercial')
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue and standard-role grants are forward-only.
SELECT 1;
