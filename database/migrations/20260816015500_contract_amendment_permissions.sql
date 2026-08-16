-- NuBlox controlled contract amendment activation
-- Permission/reference-only forward migration over Package 004 amendment structures.
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
        'contract.amendment.create',
        'Create contract amendments',
        'Create a controlled draft amendment against an executed contract baseline.',
        TRUE
    ),
    (
        NULL,
        'contract.amendment.draft.manage',
        'Manage contract amendment drafts',
        'Maintain draft amendment details, signed value adjustments and key-date changes before issue.',
        TRUE
    ),
    (
        NULL,
        'contract.amendment.issue',
        'Issue contract amendments',
        'Issue and freeze an eligible draft contract amendment.',
        TRUE
    ),
    (
        NULL,
        'contract.amendment.decide',
        'Decide contract amendments',
        'Record agreement or rejection of an issued contract amendment and withdraw eligible amendments.',
        TRUE
    )
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- Package 004 amendment authority remains inside the contract domain. Existing
-- Owner and Administrator roles receive the granular amendment catalogue.
-- contract.manage remains the explicit umbrella for custom broad contract roles.
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
        'contract.amendment.create',
        'contract.amendment.draft.manage',
        'contract.amendment.issue',
        'contract.amendment.decide'
    )
WHERE role.name IN ('Owner', 'Administrator')
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue and standard-role grants are forward-only.
SELECT 1;
