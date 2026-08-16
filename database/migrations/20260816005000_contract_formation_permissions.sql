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
        'Broad contract-management umbrella retained for standard administrative roles and compatibility.',
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

-- Standard-role compatibility is intentionally non-destructive. Existing and future
-- Owner/Administrator templates already hold commercial.manage, and Finance/Commercial
-- already holds commercial.view. The application resolves contract.manage/view first and
-- uses those commercial umbrellas only when no explicit contract decision exists. This
-- keeps bootstrap and migrated tenants in parity while making contract.* available for
-- deliberate narrower delegation.

-- migrate:down transaction:false
-- Released permission catalogue and standard-role grants are forward-only.
SELECT 1;
