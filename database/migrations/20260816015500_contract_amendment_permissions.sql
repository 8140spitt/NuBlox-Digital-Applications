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

-- contract.manage is the existing broad Package 004 umbrella and remains the
-- standard Owner/Administrator authority. The new granular keys allow future
-- custom delegation without changing standard-role bootstrap parity.

-- migrate:down transaction:false
-- Released permission catalogue is forward-only.
SELECT 1;
