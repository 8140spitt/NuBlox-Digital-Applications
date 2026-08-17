-- NuBlox Package 004E payment receipt and allocation activation
-- Permission-only forward migration over existing payment/allocation/reversal structures.
-- migrate:up transaction:false

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'finance.payment.create', 'Record customer payments', 'Record an immutable customer payment receipt fact before allocation.', TRUE),
    (NULL, 'finance.payment.allocate', 'Allocate customer payments', 'Allocate usable customer payment value to issued invoices within currency and outstanding-balance controls.', TRUE),
    (NULL, 'finance.payment.allocation.reverse', 'Reverse payment allocations', 'Reverse an active payment allocation with explicit immutable correction evidence.', TRUE),
    (NULL, 'finance.payment.reverse', 'Reverse customer payments', 'Reverse a payment receipt with explicit evidence, atomically reversing any active allocations first.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- Owner and Administrator receive the full cash-application family explicitly.
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
        'finance.payment.create',
        'finance.payment.allocate',
        'finance.payment.allocation.reverse',
        'finance.payment.reverse'
    )
WHERE role.name IN ('Owner', 'Administrator')
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- Finance/Commercial receives the complete controlled payment workflow explicitly,
-- but still does not receive the broad finance.manage umbrella.
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
        'finance.payment.create',
        'finance.payment.allocate',
        'finance.payment.allocation.reverse',
        'finance.payment.reverse'
    )
WHERE role.name = 'Finance/Commercial'
  AND role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue and standard-role grants are forward-only.
SELECT 1;
