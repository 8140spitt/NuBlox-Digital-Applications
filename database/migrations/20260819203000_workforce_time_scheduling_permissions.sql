-- NuBlox workforce, scheduling and timesheet permission catalogue and standard-role defaults
-- Data-only forward migration. Project membership and worker self-scope remain separate runtime checks.
-- migrate:up transaction:false

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'workforce.view', 'View workforce', 'View workforce records within the active organisation.', TRUE),
    (NULL, 'workforce.manage', 'Manage workforce', 'Create and manage workforce identity and engagement records.', TRUE),
    (NULL, 'workforce.competency.manage', 'Manage workforce competencies', 'Create competency definitions and maintain worker competency evidence.', TRUE),
    (NULL, 'workforce.credential.manage', 'Manage workforce credentials', 'Maintain worker qualifications, cards, registrations and licences.', TRUE),
    (NULL, 'workforce.cost_rate.view', 'View workforce cost rates', 'View commercially sensitive worker cost-rate information.', TRUE),
    (NULL, 'workforce.cost_rate.manage', 'Manage workforce cost rates', 'Create and maintain effective-dated worker cost rates.', TRUE),
    (NULL, 'workforce.assignment.manage', 'Manage workforce assignments', 'Assign organisation workers to owned projects and jobs.', TRUE),
    (NULL, 'schedule.view', 'View schedule', 'View schedule events permitted by workforce scope.', TRUE),
    (NULL, 'schedule.manage', 'Manage schedule', 'Create and manage schedule events and worker assignments.', TRUE),
    (NULL, 'timesheet.view', 'View timesheets', 'View permitted personal or approval-scope timesheets.', TRUE),
    (NULL, 'timesheet.manage', 'Manage own timesheets', 'Create and edit draft or reopened timesheets for the current worker identity.', TRUE),
    (NULL, 'timesheet.submit', 'Submit own timesheets', 'Submit the current worker identity timesheets for approval.', TRUE),
    (NULL, 'timesheet.approve', 'Approve timesheets', 'Approve or reject submitted timesheets for other workers.', TRUE),
    (NULL, 'timesheet.reopen', 'Reopen approved timesheets', 'Reopen approved timesheets through a privileged correction workflow.', TRUE)
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
            role.name IN ('Owner', 'Administrator')
            AND permission.permission_key IN (
                'workforce.view',
                'workforce.manage',
                'workforce.competency.manage',
                'workforce.credential.manage',
                'workforce.cost_rate.view',
                'workforce.cost_rate.manage',
                'workforce.assignment.manage',
                'schedule.view',
                'schedule.manage',
                'timesheet.view',
                'timesheet.manage',
                'timesheet.submit',
                'timesheet.approve',
                'timesheet.reopen'
            )
        )
        OR (
            role.name = 'Manager'
            AND permission.permission_key IN (
                'workforce.view',
                'workforce.manage',
                'workforce.competency.manage',
                'workforce.credential.manage',
                'workforce.assignment.manage',
                'schedule.view',
                'schedule.manage',
                'timesheet.view',
                'timesheet.manage',
                'timesheet.submit',
                'timesheet.approve',
                'timesheet.reopen'
            )
        )
        OR (
            role.name = 'Finance/Commercial'
            AND permission.permission_key IN (
                'workforce.view',
                'workforce.cost_rate.view',
                'schedule.view',
                'timesheet.view'
            )
        )
        OR (
            role.name IN ('Member/Professional', 'Field Worker')
            AND permission.permission_key IN (
                'workforce.view',
                'schedule.view',
                'timesheet.view',
                'timesheet.manage',
                'timesheet.submit'
            )
        )
        OR (
            role.name = 'Read Only'
            AND permission.permission_key IN ('workforce.view', 'schedule.view', 'timesheet.view')
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue/grant rows are forward-only because role and
-- override history may depend on them. Non-production environments are rebuilt.
SELECT 1;
