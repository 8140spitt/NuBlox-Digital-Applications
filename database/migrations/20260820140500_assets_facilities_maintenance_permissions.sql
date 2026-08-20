-- NuBlox assets, facilities and maintenance permission catalogue and standard-role defaults
-- Data-only forward migration. Facility records are tenant-owned operational facts.
-- migrate:up transaction:false

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'assets.view', 'View assets', 'View tenant asset registers, hierarchy and lifecycle history.', TRUE),
    (NULL, 'assets.manage', 'Manage assets', 'Create and maintain asset types, hierarchy and asset master records.', TRUE),
    (NULL, 'assets.lifecycle.manage', 'Manage asset lifecycle', 'Record controlled asset lifecycle transitions and service state.', TRUE),
    (NULL, 'assets.evidence.manage', 'Manage asset evidence', 'Link exact controlled information revisions to asset and maintenance evidence.', TRUE),
    (NULL, 'facilities.view', 'View facilities', 'View tenant facilities, buildings, levels and spaces.', TRUE),
    (NULL, 'facilities.manage', 'Manage facilities', 'Create and maintain tenant facilities and physical hierarchy.', TRUE),
    (NULL, 'maintenance.view', 'View maintenance', 'View maintenance requests, plans, work orders and service history.', TRUE),
    (NULL, 'maintenance.request.manage', 'Manage maintenance requests', 'Report, triage and resolve reactive maintenance requests.', TRUE),
    (NULL, 'maintenance.plan.manage', 'Manage maintenance plans', 'Create and activate planned-maintenance tasks and schedule rules.', TRUE),
    (NULL, 'maintenance.work_order.manage', 'Manage work orders', 'Create, schedule, assign and progress maintenance work orders.', TRUE),
    (NULL, 'maintenance.work_order.complete', 'Complete work orders', 'Complete authorised work-order tasks and work orders with attributable evidence.', TRUE),
    (NULL, 'maintenance.assignment.manage', 'Manage maintenance assignments', 'Assign internal workers and external CRM contractors to work orders.', TRUE),
    (NULL, 'maintenance.service.manage', 'Manage service history', 'Record attributable asset inspection, service and repair history.', TRUE),
    (NULL, 'compliance.view', 'View asset compliance', 'View operational compliance requirements, assignments and event history.', TRUE),
    (NULL, 'compliance.manage', 'Manage asset compliance', 'Create versioned operational compliance requirements, assignments and event evidence.', TRUE)
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
            role.name IN ('Owner', 'Administrator', 'Manager')
            AND permission.permission_key IN (
                'assets.view', 'assets.manage', 'assets.lifecycle.manage', 'assets.evidence.manage',
                'facilities.view', 'facilities.manage',
                'maintenance.view', 'maintenance.request.manage', 'maintenance.plan.manage',
                'maintenance.work_order.manage', 'maintenance.work_order.complete',
                'maintenance.assignment.manage', 'maintenance.service.manage',
                'compliance.view', 'compliance.manage'
            )
        )
        OR (
            role.name = 'Member/Professional'
            AND permission.permission_key IN (
                'assets.view', 'assets.manage', 'assets.lifecycle.manage', 'assets.evidence.manage',
                'facilities.view',
                'maintenance.view', 'maintenance.request.manage', 'maintenance.plan.manage',
                'maintenance.work_order.manage', 'maintenance.work_order.complete',
                'maintenance.assignment.manage', 'maintenance.service.manage',
                'compliance.view', 'compliance.manage'
            )
        )
        OR (
            role.name = 'Field Worker'
            AND permission.permission_key IN (
                'assets.view', 'facilities.view', 'maintenance.view',
                'maintenance.request.manage', 'maintenance.work_order.complete',
                'maintenance.service.manage', 'compliance.view'
            )
        )
        OR (
            role.name IN ('Finance/Commercial', 'Read Only')
            AND permission.permission_key IN (
                'assets.view', 'facilities.view', 'maintenance.view', 'compliance.view'
            )
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue/grant rows are forward-only because role and
-- override history may depend on them. Non-production environments are rebuilt.
SELECT 1;
