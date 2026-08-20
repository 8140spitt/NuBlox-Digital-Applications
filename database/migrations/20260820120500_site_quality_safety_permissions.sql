-- NuBlox site, quality and safety permission catalogue and standard-role defaults
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
    (NULL, 'site.view', 'View site operations', 'View project sites and site operational records within effective project scope.', TRUE),
    (NULL, 'site.manage', 'Manage project sites', 'Create and maintain project site/location identities.', TRUE),
    (NULL, 'site.diary.manage', 'Manage site diaries', 'Create draft site diaries and operational activity records.', TRUE),
    (NULL, 'site.diary.submit', 'Submit site diaries', 'Submit draft site diaries as attributable field evidence.', TRUE),
    (NULL, 'site.diary.approve', 'Approve site diaries', 'Approve submitted site diaries as controlled project evidence.', TRUE),
    (NULL, 'quality.view', 'View project quality', 'View project inspection, finding, defect and non-conformance records.', TRUE),
    (NULL, 'quality.template.manage', 'Manage inspection templates', 'Create and publish controlled inspection/checklist definitions.', TRUE),
    (NULL, 'quality.inspection.manage', 'Manage quality inspections', 'Create, execute and complete project quality inspections.', TRUE),
    (NULL, 'quality.defect.manage', 'Manage defects', 'Raise, progress and close project defect/snag records.', TRUE),
    (NULL, 'quality.ncr.manage', 'Manage non-conformances', 'Raise, progress and close non-conformance reports.', TRUE),
    (NULL, 'safety.view', 'View project safety', 'View project safety observations, near misses, incidents and actions.', TRUE),
    (NULL, 'safety.event.manage', 'Manage safety events', 'Report and progress project safety observations, near misses and incidents.', TRUE),
    (NULL, 'safety.action.manage', 'Manage safety actions', 'Create, complete and verify corrective or preventive safety actions.', TRUE)
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
                'site.view',
                'site.manage',
                'site.diary.manage',
                'site.diary.submit',
                'site.diary.approve',
                'quality.view',
                'quality.template.manage',
                'quality.inspection.manage',
                'quality.defect.manage',
                'quality.ncr.manage',
                'safety.view',
                'safety.event.manage',
                'safety.action.manage'
            )
        )
        OR (
            role.name = 'Manager'
            AND permission.permission_key IN (
                'site.view',
                'site.manage',
                'site.diary.manage',
                'site.diary.submit',
                'site.diary.approve',
                'quality.view',
                'quality.template.manage',
                'quality.inspection.manage',
                'quality.defect.manage',
                'quality.ncr.manage',
                'safety.view',
                'safety.event.manage',
                'safety.action.manage'
            )
        )
        OR (
            role.name = 'Member/Professional'
            AND permission.permission_key IN (
                'site.view',
                'site.diary.manage',
                'site.diary.submit',
                'quality.view',
                'quality.inspection.manage',
                'quality.defect.manage',
                'quality.ncr.manage',
                'safety.view',
                'safety.event.manage',
                'safety.action.manage'
            )
        )
        OR (
            role.name = 'Field Worker'
            AND permission.permission_key IN (
                'site.view',
                'site.diary.manage',
                'site.diary.submit',
                'quality.view',
                'quality.inspection.manage',
                'quality.defect.manage',
                'safety.view',
                'safety.event.manage',
                'safety.action.manage'
            )
        )
        OR (
            role.name IN ('Finance/Commercial', 'Read Only')
            AND permission.permission_key IN ('site.view', 'quality.view', 'safety.view')
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue/grant rows are forward-only because role and
-- override history may depend on them. Non-production environments are rebuilt.
SELECT 1;
