-- NuBlox project information permission catalogue and standard-role defaults
-- Data-only forward migration. Project participation and record ownership remain separate runtime checks.
-- migrate:up transaction:false

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'information.view', 'View project information', 'View controlled documents and project information within effective project scope.', TRUE),
    (NULL, 'information.manage', 'Manage project information', 'Create document identities, draft revisions and searchable project information metadata.', TRUE),
    (NULL, 'information.file.manage', 'Manage document file metadata', 'Register object-storage metadata and checksums for draft document revisions.', TRUE),
    (NULL, 'information.issue', 'Issue document revisions', 'Issue controlled document revisions and create immutable issue evidence.', TRUE),
    (NULL, 'information.rfi.manage', 'Manage RFIs', 'Create, open and close requests for information within effective project scope.', TRUE),
    (NULL, 'information.rfi.respond', 'Respond to RFIs', 'Record attributable responses to open requests for information.', TRUE),
    (NULL, 'information.submittal.manage', 'Manage submittals', 'Create and submit controlled project-information submittals.', TRUE),
    (NULL, 'information.submittal.review', 'Review submittals', 'Record controlled submittal review outcomes.', TRUE),
    (NULL, 'information.instruction.manage', 'Manage instructions', 'Create formal project instruction drafts.', TRUE),
    (NULL, 'information.instruction.issue', 'Issue instructions', 'Issue formal project instructions as immutable evidence.', TRUE)
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
                'information.view',
                'information.manage',
                'information.file.manage',
                'information.issue',
                'information.rfi.manage',
                'information.rfi.respond',
                'information.submittal.manage',
                'information.submittal.review',
                'information.instruction.manage',
                'information.instruction.issue'
            )
        )
        OR (
            role.name = 'Manager'
            AND permission.permission_key IN (
                'information.view',
                'information.manage',
                'information.file.manage',
                'information.issue',
                'information.rfi.manage',
                'information.rfi.respond',
                'information.submittal.manage',
                'information.submittal.review',
                'information.instruction.manage',
                'information.instruction.issue'
            )
        )
        OR (
            role.name = 'Member/Professional'
            AND permission.permission_key IN (
                'information.view',
                'information.manage',
                'information.file.manage',
                'information.rfi.manage',
                'information.rfi.respond',
                'information.submittal.manage',
                'information.instruction.manage'
            )
        )
        OR (
            role.name = 'Field Worker'
            AND permission.permission_key IN (
                'information.view',
                'information.rfi.respond'
            )
        )
        OR (
            role.name IN ('Finance/Commercial', 'Read Only')
            AND permission.permission_key = 'information.view'
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Released permission catalogue/grant rows are forward-only because role and
-- override history may depend on them. Non-production environments are rebuilt.
SELECT 1;
