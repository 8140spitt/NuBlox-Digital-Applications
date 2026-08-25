-- NuBlox CRM/customer/person collaboration boundary
-- CRM parties remain tenant-private records and never link to NuBlox platform organisations.
-- External project collaboration is granted to an authenticated person identity directly.
-- migrate:up transaction:false

CREATE TABLE project_external_collaborators (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    crm_person_party_id BIGINT UNSIGNED NOT NULL,
    crm_organisation_party_id BIGINT UNSIGNED NULL,
    auth_user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    invite_email VARCHAR(320) NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    invited_by_member_id BIGINT UNSIGNED NOT NULL,
    joined_at DATETIME(6) NOT NULL,
    left_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_external_collaborators_public_id (public_id),
    UNIQUE KEY uq_project_external_collaborators_project_auth (project_id, auth_user_id),
    UNIQUE KEY uq_project_external_collaborators_id_project (id, project_id),
    KEY idx_project_external_collaborators_owner (owning_organisation_id, project_id),
    KEY idx_project_external_collaborators_crm_person (owning_organisation_id, crm_person_party_id),
    KEY idx_project_external_collaborators_crm_org (owning_organisation_id, crm_organisation_party_id),
    KEY idx_project_external_collaborators_auth (auth_user_id, status),
    KEY idx_project_external_collaborators_inviter (invited_by_member_id, owning_organisation_id),

    CONSTRAINT fk_project_external_collaborators_project
        FOREIGN KEY (project_id) REFERENCES projects (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_external_collaborators_owner
        FOREIGN KEY (owning_organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_external_collaborators_crm_person
        FOREIGN KEY (crm_person_party_id, owning_organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_external_collaborators_crm_org
        FOREIGN KEY (crm_organisation_party_id, owning_organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_external_collaborators_auth_user
        FOREIGN KEY (auth_user_id) REFERENCES auth_users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_external_collaborators_inviter
        FOREIGN KEY (invited_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_project_external_collaborators_status
        CHECK (status IN ('active', 'revoked')),
    CONSTRAINT ck_project_external_collaborators_dates
        CHECK (
            (status = 'active' AND left_at IS NULL)
            OR (status = 'revoked' AND left_at IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_external_collaborator_roles (
    project_id BIGINT UNSIGNED NOT NULL,
    project_external_collaborator_id BIGINT UNSIGNED NOT NULL,
    project_role_type_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (project_id, project_external_collaborator_id, project_role_type_id),
    KEY idx_project_external_collaborator_roles_role (project_role_type_id),

    CONSTRAINT fk_project_external_collaborator_roles_collaborator
        FOREIGN KEY (project_external_collaborator_id, project_id)
        REFERENCES project_external_collaborators (id, project_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_project_external_collaborator_roles_role
        FOREIGN KEY (project_role_type_id) REFERENCES project_role_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Preserve any collaboration already accepted under the previous organisation-link model as
-- a direct person-level collaboration before the obsolete linkage columns are removed.
INSERT INTO project_external_collaborators (
    public_id,
    project_id,
    owning_organisation_id,
    crm_person_party_id,
    crm_organisation_party_id,
    auth_user_id,
    invite_email,
    status,
    invited_by_member_id,
    joined_at,
    left_at
)
SELECT
    UUID(),
    invitation.project_id,
    invitation.inviting_organisation_id,
    invitation.crm_contact_party_id,
    invitation.crm_organisation_party_id,
    invitation.auth_user_id,
    invitation.invite_email,
    'active',
    invitation.invited_by_member_id,
    invitation.accepted_at,
    NULL
FROM project_collaboration_invitations AS invitation
WHERE invitation.status = 'accepted'
  AND invitation.auth_user_id IS NOT NULL
  AND invitation.accepted_at IS NOT NULL
ON DUPLICATE KEY UPDATE
    crm_person_party_id = VALUES(crm_person_party_id),
    crm_organisation_party_id = VALUES(crm_organisation_party_id),
    invite_email = VALUES(invite_email),
    status = 'active',
    left_at = NULL;

INSERT IGNORE INTO project_external_collaborator_roles (
    project_id,
    project_external_collaborator_id,
    project_role_type_id
)
SELECT
    invitation.project_id,
    collaborator.id,
    invitation_role.project_role_type_id
FROM project_collaboration_invitations AS invitation
INNER JOIN project_external_collaborators AS collaborator
    ON collaborator.project_id = invitation.project_id
   AND collaborator.auth_user_id = invitation.auth_user_id
INNER JOIN project_collaboration_invitation_roles AS invitation_role
    ON invitation_role.project_id = invitation.project_id
   AND invitation_role.project_collaboration_invitation_id = invitation.id
WHERE invitation.status = 'accepted'
  AND invitation.auth_user_id IS NOT NULL;

-- The old pending-by-CRM-organisation unique index currently supplies the leading project_id
-- index used by the project foreign key. Preserve an explicit project index before removing it.
ALTER TABLE project_collaboration_invitations
    ADD KEY idx_project_collaboration_invitations_project (project_id);

-- Invitations are now uniquely pending by person/contact, not by employer organisation.
ALTER TABLE project_collaboration_invitations
    DROP INDEX uq_project_collaboration_invitations_pending_crm,
    DROP COLUMN pending_crm_organisation_party_id;

ALTER TABLE project_collaboration_invitations
    DROP FOREIGN KEY fk_project_collaboration_invitations_target_org,
    DROP INDEX idx_project_collaboration_invitations_target_org,
    DROP CHECK ck_project_collaboration_invitations_terminal_dates;

ALTER TABLE project_collaboration_invitations
    MODIFY COLUMN crm_organisation_party_id BIGINT UNSIGNED NULL,
    DROP COLUMN target_organisation_id,
    ADD COLUMN pending_crm_contact_party_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE WHEN status = 'pending' THEN crm_contact_party_id ELSE NULL END
        ) STORED AFTER revoked_at,
    ADD UNIQUE KEY uq_project_collaboration_invitations_pending_contact (
        project_id,
        inviting_organisation_id,
        pending_crm_contact_party_id
    ),
    ADD CONSTRAINT ck_project_collaboration_invitations_terminal_dates_v2
        CHECK (
            (status = 'accepted' AND accepted_at IS NOT NULL AND revoked_at IS NULL AND auth_user_id IS NOT NULL)
            OR (status = 'revoked' AND revoked_at IS NOT NULL AND accepted_at IS NULL)
            OR (status IN ('pending', 'expired') AND accepted_at IS NULL AND revoked_at IS NULL)
        );

-- Remove the CRM-to-platform organisation link completely. Historical project-organisation
-- participation remains historical project data but is no longer associated with the CRM party.
ALTER TABLE party_organisations
    DROP FOREIGN KEY fk_party_organisations_linked_org,
    DROP INDEX uq_party_organisations_linked_org,
    DROP INDEX idx_party_organisations_linked_org,
    DROP CHECK ck_party_organisations_not_self,
    DROP COLUMN linked_organisation_id;

-- Audit evidence must distinguish internal organisation members from authenticated external people.
ALTER TABLE audit_events
    MODIFY COLUMN actor_member_id BIGINT UNSIGNED NULL,
    ADD COLUMN external_auth_user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER actor_member_id,
    ADD KEY idx_audit_events_external_auth_user (external_auth_user_id, occurred_at),
    ADD CONSTRAINT fk_audit_events_external_auth_user
        FOREIGN KEY (external_auth_user_id) REFERENCES auth_users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    ADD CONSTRAINT ck_audit_events_actor_identity
        CHECK (
            (actor_member_id IS NOT NULL AND external_auth_user_id IS NULL)
            OR (actor_member_id IS NULL AND external_auth_user_id IS NOT NULL)
        );

-- migrate:down transaction:false
-- This is a forward-only correction of the product identity boundary. Reintroducing a CRM-to-platform
-- organisation mapping would violate the canonical model and is intentionally unsupported.
SELECT 1;
