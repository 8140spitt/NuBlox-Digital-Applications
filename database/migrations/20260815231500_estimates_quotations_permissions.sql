-- NuBlox estimates and quotations application activation
-- Data/reference-only forward migration over Package 003.
-- migrate:up transaction:false

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'commercial.view', 'View commercial sales documents', 'View tenant-owned estimates, quotations, issue history and customer responses.', TRUE),
    (NULL, 'commercial.manage', 'Manage commercial sales documents', 'Broad commercial sales-management umbrella retained for higher-authority and compatibility roles.', TRUE),
    (NULL, 'commercial.estimate.manage', 'Manage estimates', 'Create, revise, cost and finalise tenant-owned estimates and estimate versions.', TRUE),
    (NULL, 'commercial.quotation.manage', 'Manage quotations', 'Create and revise tenant-owned quotation drafts and quotation content.', TRUE),
    (NULL, 'commercial.quotation.issue', 'Issue quotations', 'Lock and issue quotation versions and record issue recipients.', TRUE),
    (NULL, 'commercial.quotation.response.record', 'Record quotation responses', 'Record customer acceptance, rejection, revision requests and withdrawal responses.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- Existing standard Owner and Administrator roles retain broad commercial
-- authority plus the granular permissions. Finance/Commercial receives the
-- granular operational set without the broad umbrella.
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
        'commercial.view',
        'commercial.manage',
        'commercial.estimate.manage',
        'commercial.quotation.manage',
        'commercial.quotation.issue',
        'commercial.quotation.response.record'
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
    ON permission.permission_key IN (
        'commercial.view',
        'commercial.estimate.manage',
        'commercial.quotation.manage',
        'commercial.quotation.issue',
        'commercial.quotation.response.record'
    )
WHERE role.name = 'Finance/Commercial'
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue and standard-role grants are forward-only.
SELECT 1;
