-- NuBlox Package 004 operational accounts-receivable activation
-- Permission-only forward migration over existing billing/invoice structures.
-- migrate:up transaction:false

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'finance.view', 'View accounts receivable', 'View tenant billing settings and accounts-receivable financial documents.', TRUE),
    (NULL, 'finance.manage', 'Manage accounts receivable', 'Broad Package 004 operational accounts-receivable umbrella permission.', TRUE),
    (NULL, 'finance.billing.manage', 'Manage billing settings', 'Manage payment terms and tenant-specific customer billing defaults.', TRUE),
    (NULL, 'finance.invoice.create', 'Create invoices', 'Create controlled draft invoices from eligible executed contracts.', TRUE),
    (NULL, 'finance.invoice.draft.manage', 'Manage invoice drafts', 'Maintain draft invoice header, lines and tax selections before issue.', TRUE),
    (NULL, 'finance.invoice.issue', 'Issue invoices', 'Allocate an invoice number and issue an immutable customer invoice with snapshots and recipient evidence.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- Existing Owner and Administrator roles receive the full explicit finance family.
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
        'finance.view',
        'finance.manage',
        'finance.billing.manage',
        'finance.invoice.create',
        'finance.invoice.draft.manage',
        'finance.invoice.issue'
    )
WHERE role.name IN ('Owner', 'Administrator')
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- Finance/Commercial receives operational AR authority without the broad
-- finance.manage umbrella so future finance capabilities remain deliberately
-- delegated rather than inherited automatically.
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
        'finance.view',
        'finance.billing.manage',
        'finance.invoice.create',
        'finance.invoice.draft.manage',
        'finance.invoice.issue'
    )
WHERE role.name = 'Finance/Commercial'
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue and standard-role grants are forward-only.
SELECT 1;
