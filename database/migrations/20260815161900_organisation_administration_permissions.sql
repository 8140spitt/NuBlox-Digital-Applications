-- NuBlox organisation administration permission catalogue
-- Forward-only seed migration. Permission keys are stable application policy identifiers.
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
        'organisation.manage',
        'Manage organisation',
        'Manage organisation-level roles and permission grants.',
        TRUE
    ),
    (
        NULL,
        'member.invite',
        'Invite members',
        'Create, resend and revoke organisation membership invitations.',
        TRUE
    ),
    (
        NULL,
        'member.manage',
        'Manage members',
        'Manage organisation member status and organisation role assignments.',
        TRUE
    )
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- migrate:down transaction:false
-- Permission catalogue entries are intentionally not removed by rollback because
-- released role/override rows may reference them. NuBlox production schema changes
-- are forward-only; non-production environments are rebuilt when necessary.
SELECT 1;
