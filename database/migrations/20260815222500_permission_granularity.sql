-- NuBlox granular project and CRM permission catalogue
-- Data-only forward migration. Existing umbrella permissions remain supported.
-- migrate:up transaction:false

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'project.lifecycle.manage', 'Manage project lifecycle', 'Change project lifecycle state for projects where contextual policy permits.', TRUE),
    (NULL, 'project.participant.manage', 'Manage project participants', 'Invite, remove and maintain participant organisations and organisation-level project roles.', TRUE),
    (NULL, 'project.team.manage', 'Manage project team', 'Add, remove and maintain members and member-level project roles for the organisation project team.', TRUE),
    (NULL, 'project.participation.manage', 'Manage project participation', 'Accept or decline project invitations and leave project participation where contextual policy permits.', TRUE),
    (NULL, 'crm.party.manage', 'Manage CRM parties', 'Create and maintain tenant-owned CRM party master data, classifications and contact methods.', TRUE),
    (NULL, 'crm.contact.manage', 'Manage CRM contacts', 'Create, link, promote and end tenant-owned organisation contact relationships.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- Existing standard roles receive the same granular defaults that new
-- organisations receive from OrganisationBootstrapService.
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
    ON role.name IN ('Owner', 'Administrator', 'Manager')
   AND permission.permission_key IN (
        'project.lifecycle.manage',
        'project.participant.manage',
        'project.team.manage',
        'project.participation.manage',
        'crm.party.manage',
        'crm.contact.manage'
   )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- Manager moves from the two broad management umbrellas to the granular
-- permissions above. Effective access to the currently implemented project and
-- CRM workflows is preserved, while future responsibilities can be delegated
-- independently. Owner and Administrator retain the umbrella authorities.
DELETE role_permission
FROM role_permissions AS role_permission
INNER JOIN organisation_roles AS role
    ON role.id = role_permission.organisation_role_id
   AND role.organisation_id = role_permission.organisation_id
INNER JOIN permissions AS permission
    ON permission.id = role_permission.permission_id
WHERE role.name = 'Manager'
  AND permission.permission_key IN ('project.manage', 'crm.manage');

-- migrate:down transaction:false
-- Released permission catalogue/grant rows are forward-only because custom role
-- and member override history may depend on them. Non-production environments are rebuilt.
SELECT 1;
