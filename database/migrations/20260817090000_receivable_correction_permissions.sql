-- NuBlox Package 004D receivable-correction activation
-- Permission-only forward migration over existing credit-note/void structures.
-- migrate:up transaction:false

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'finance.credit_note.create', 'Create credit notes', 'Create a controlled draft credit note against an issued customer invoice.', TRUE),
    (NULL, 'finance.credit_note.draft.manage', 'Manage credit-note drafts', 'Maintain credit-note reason and source-linked credit lines before issue.', TRUE),
    (NULL, 'finance.credit_note.issue', 'Issue credit notes', 'Allocate a credit-note number and issue an immutable correction with source, snapshot and recipient evidence.', TRUE),
    (NULL, 'finance.invoice.void', 'Void issued invoices', 'Void an issued invoice with explicit evidence when no credit-note or active payment-allocation history prevents voiding.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- Owner and Administrator receive the full correction family explicitly.
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
        'finance.credit_note.create',
        'finance.credit_note.draft.manage',
        'finance.credit_note.issue',
        'finance.invoice.void'
    )
WHERE role.name IN ('Owner', 'Administrator')
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- Finance/Commercial receives ordinary credit-note preparation/issue authority,
-- but not the stronger invoice-void permission and still not finance.manage.
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
        'finance.credit_note.create',
        'finance.credit_note.draft.manage',
        'finance.credit_note.issue'
    )
WHERE role.name = 'Finance/Commercial'
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue and standard-role grants are forward-only.
SELECT 1;
