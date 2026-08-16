-- NuBlox controlled contract formation activation
-- Data/reference-only forward migration over Package 004 contract structures.
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
        'contract.view',
        'View contracts',
        'View tenant-owned contracts, versions, parties, values, key dates, issue evidence and execution evidence.',
        TRUE
    ),
    (
        NULL,
        'contract.manage',
        'Manage contracts',
        'Broad contract-management umbrella retained for administrative and custom organisation roles.',
        TRUE
    ),
    (
        NULL,
        'contract.create',
        'Create contracts',
        'Create a controlled draft contract from an eligible accepted-quotation project.',
        TRUE
    ),
    (
        NULL,
        'contract.draft.manage',
        'Manage contract drafts',
        'Maintain draft contract version details, value components and key dates before issue.',
        TRUE
    ),
    (
        NULL,
        'contract.issue',
        'Issue contracts',
        'Lock and issue an eligible draft contract version while preserving issue evidence.',
        TRUE
    ),
    (
        NULL,
        'contract.execute',
        'Record contract execution',
        'Record execution and signatory evidence for an issued and locked contract version.',
        TRUE
    )
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- Contract authority is an explicit Package 004 domain. Do not expand an older
-- commercial.* umbrella into this permission family. Existing Owner and Administrator
-- roles receive the full first-slice contract catalogue; Finance/Commercial receives
-- read access only. Other standard roles receive no automatic contract authority.
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
        'contract.view',
        'contract.manage',
        'contract.create',
        'contract.draft.manage',
        'contract.issue',
        'contract.execute'
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
    ON permission.permission_key = 'contract.view'
WHERE role.name = 'Finance/Commercial'
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue and standard-role grants are forward-only.
SELECT 1;
