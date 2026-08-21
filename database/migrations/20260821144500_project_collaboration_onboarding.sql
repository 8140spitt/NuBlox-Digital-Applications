-- NuBlox project collaboration onboarding
-- Bridges tenant-private CRM organisations to external NuBlox organisations through a
-- project-specific, contact-addressed invitation. No company-name matching is introduced.
-- migrate:up transaction:false

CREATE TABLE project_collaboration_invitations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    inviting_organisation_id BIGINT UNSIGNED NOT NULL,
    crm_organisation_party_id BIGINT UNSIGNED NOT NULL,
    crm_contact_party_id BIGINT UNSIGNED NOT NULL,
    invite_email VARCHAR(320) NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    invited_by_member_id BIGINT UNSIGNED NOT NULL,
    auth_user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    target_organisation_id BIGINT UNSIGNED NULL,
    expires_at DATETIME(6) NOT NULL,
    accepted_at DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    pending_crm_organisation_party_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE WHEN status = 'pending' THEN crm_organisation_party_id ELSE NULL END
        ) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_collaboration_invitations_public_id (public_id),
    UNIQUE KEY uq_project_collaboration_invitations_token_hash (token_hash),
    UNIQUE KEY uq_project_collaboration_invitations_pending_crm (
        project_id,
        inviting_organisation_id,
        pending_crm_organisation_party_id
    ),
    UNIQUE KEY uq_project_collaboration_invitations_id_project (id, project_id),
    KEY idx_project_collaboration_invitations_auth_user (auth_user_id, status),
    KEY idx_project_collaboration_invitations_target_org (target_organisation_id),
    KEY idx_project_collaboration_invitations_expiry (status, expires_at),
    KEY idx_project_collaboration_invitations_crm_contact (
        inviting_organisation_id,
        crm_contact_party_id
    ),

    CONSTRAINT fk_project_collaboration_invitations_project
        FOREIGN KEY (project_id) REFERENCES projects (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_collaboration_invitations_inviting_org
        FOREIGN KEY (inviting_organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_collaboration_invitations_crm_org
        FOREIGN KEY (crm_organisation_party_id, inviting_organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_collaboration_invitations_crm_contact
        FOREIGN KEY (crm_contact_party_id, inviting_organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_collaboration_invitations_inviter
        FOREIGN KEY (invited_by_member_id, inviting_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_collaboration_invitations_auth_user
        FOREIGN KEY (auth_user_id) REFERENCES auth_users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_collaboration_invitations_target_org
        FOREIGN KEY (target_organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_project_collaboration_invitations_status
        CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    CONSTRAINT ck_project_collaboration_invitations_terminal_dates
        CHECK (
            (status = 'accepted' AND accepted_at IS NOT NULL AND revoked_at IS NULL AND target_organisation_id IS NOT NULL)
            OR (status = 'revoked' AND revoked_at IS NOT NULL AND accepted_at IS NULL)
            OR (status IN ('pending', 'expired') AND accepted_at IS NULL AND revoked_at IS NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_collaboration_invitation_roles (
    project_id BIGINT UNSIGNED NOT NULL,
    project_collaboration_invitation_id BIGINT UNSIGNED NOT NULL,
    project_role_type_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (
        project_id,
        project_collaboration_invitation_id,
        project_role_type_id
    ),
    KEY idx_project_collaboration_invitation_roles_role (project_role_type_id),

    CONSTRAINT fk_project_collaboration_invitation_roles_invitation
        FOREIGN KEY (project_collaboration_invitation_id, project_id)
        REFERENCES project_collaboration_invitations (id, project_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_project_collaboration_invitation_roles_role
        FOREIGN KEY (project_role_type_id) REFERENCES project_role_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- migrate:down transaction:false
DROP TABLE project_collaboration_invitation_roles;
DROP TABLE project_collaboration_invitations;
