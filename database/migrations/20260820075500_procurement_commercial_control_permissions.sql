-- NuBlox procurement and project commercial-control permission catalogue and standard-role defaults
-- Data-only forward migration. Project participation remains a separate runtime scope check.
-- migrate:up transaction:false

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'procurement.view', 'View procurement', 'View project procurement packages, enquiries and purchase orders within effective scope.', TRUE),
    (NULL, 'procurement.package.manage', 'Manage procurement packages', 'Create and manage procurement packages and requirements.', TRUE),
    (NULL, 'procurement.rfq.manage', 'Manage procurement enquiries', 'Create RFQ/enquiry records and draft versions.', TRUE),
    (NULL, 'procurement.rfq.issue', 'Issue procurement enquiries', 'Issue immutable RFQ versions to eligible supplier parties.', TRUE),
    (NULL, 'procurement.po.manage', 'Manage purchase orders', 'Create purchase orders and draft order versions.', TRUE),
    (NULL, 'procurement.po.approve', 'Approve purchase orders', 'Approve purchase-order versions before controlled issue.', TRUE),
    (NULL, 'procurement.po.issue', 'Issue purchase orders', 'Issue immutable purchase-order versions and create issue evidence.', TRUE),
    (NULL, 'procurement.receipt.manage', 'Manage purchase-order receipts', 'Record and reverse controlled goods or service receipts against issued purchase orders.', TRUE),
    (NULL, 'commercial.cost_control.view', 'View project commercial control', 'View confidential project cost codes, budgets, commitments, variations, valuations and commercial position.', TRUE),
    (NULL, 'commercial.cost_code.manage', 'Manage project cost codes', 'Create and maintain project cost-code structures.', TRUE),
    (NULL, 'commercial.budget.manage', 'Manage project budgets', 'Create project budget identities, draft versions and budget lines.', TRUE),
    (NULL, 'commercial.budget.approve', 'Approve project budgets', 'Approve and lock project budget versions as controlled baselines.', TRUE),
    (NULL, 'commercial.variation.manage', 'Manage commercial variations', 'Create project commercial variations and draft variation versions.', TRUE),
    (NULL, 'commercial.variation.issue', 'Issue commercial variations', 'Issue immutable commercial variation versions.', TRUE),
    (NULL, 'commercial.variation.decide', 'Record variation decisions', 'Record attributable accepted, partial, rejected or pending variation decisions.', TRUE),
    (NULL, 'commercial.valuation.manage', 'Manage commercial valuations', 'Create and submit project commercial valuation and application records.', TRUE),
    (NULL, 'commercial.valuation.assess', 'Assess commercial valuations', 'Record attributable assessment of submitted project commercial valuations.', TRUE)
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
            role.name IN ('Owner', 'Administrator', 'Finance/Commercial')
            AND permission.permission_key IN (
                'procurement.view',
                'procurement.package.manage',
                'procurement.rfq.manage',
                'procurement.rfq.issue',
                'procurement.po.manage',
                'procurement.po.approve',
                'procurement.po.issue',
                'procurement.receipt.manage',
                'commercial.cost_control.view',
                'commercial.cost_code.manage',
                'commercial.budget.manage',
                'commercial.budget.approve',
                'commercial.variation.manage',
                'commercial.variation.issue',
                'commercial.variation.decide',
                'commercial.valuation.manage',
                'commercial.valuation.assess'
            )
        )
        OR (
            role.name = 'Manager'
            AND permission.permission_key IN (
                'procurement.view',
                'procurement.package.manage',
                'procurement.rfq.manage',
                'procurement.rfq.issue',
                'procurement.po.manage',
                'procurement.po.issue',
                'procurement.receipt.manage',
                'commercial.cost_control.view',
                'commercial.cost_code.manage',
                'commercial.budget.manage',
                'commercial.variation.manage',
                'commercial.variation.issue',
                'commercial.valuation.manage',
                'commercial.valuation.assess'
            )
        )
        OR (
            role.name = 'Member/Professional'
            AND permission.permission_key IN (
                'procurement.view',
                'procurement.package.manage',
                'procurement.rfq.manage',
                'procurement.po.manage',
                'procurement.receipt.manage'
            )
        )
        OR (
            role.name = 'Read Only'
            AND permission.permission_key = 'procurement.view'
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue/grant rows are forward-only because role and
-- override history may depend on them. Non-production environments are rebuilt.
SELECT 1;
