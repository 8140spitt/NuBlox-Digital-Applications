-- NuBlox account provisioning and organisation invitations
-- Forward migration following ADR-0002 authentication boundary.
-- migrate:up transaction:false

CREATE TABLE organisation_invitations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    email VARCHAR(320) NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    invited_by_member_id BIGINT UNSIGNED NOT NULL,
    auth_user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    accepted_user_id BIGINT UNSIGNED NULL,
    expires_at DATETIME(6) NOT NULL,
    accepted_at DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    pending_email VARCHAR(320)
        GENERATED ALWAYS AS (
            CASE WHEN status = 'pending' THEN email ELSE NULL END
        ) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_organisation_invitations_public_id (public_id),
    UNIQUE KEY uq_organisation_invitations_token_hash (token_hash),
    UNIQUE KEY uq_organisation_invitations_pending_email (organisation_id, pending_email),
    UNIQUE KEY uq_organisation_invitations_id_organisation (id, organisation_id),
    KEY idx_organisation_invitations_auth_user (auth_user_id, status),
    KEY idx_organisation_invitations_accepted_user (accepted_user_id),
    KEY idx_organisation_invitations_expiry (status, expires_at),

    CONSTRAINT fk_organisation_invitations_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_organisation_invitations_inviter
        FOREIGN KEY (invited_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_organisation_invitations_auth_user
        FOREIGN KEY (auth_user_id) REFERENCES auth_users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_organisation_invitations_accepted_user
        FOREIGN KEY (accepted_user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_organisation_invitations_status
        CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    CONSTRAINT ck_organisation_invitations_terminal_dates
        CHECK (
            (status = 'accepted' AND accepted_at IS NOT NULL AND revoked_at IS NULL)
            OR (status = 'revoked' AND revoked_at IS NOT NULL AND accepted_at IS NULL)
            OR (status IN ('pending', 'expired') AND accepted_at IS NULL AND revoked_at IS NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE organisation_invitation_roles (
    organisation_id BIGINT UNSIGNED NOT NULL,
    organisation_invitation_id BIGINT UNSIGNED NOT NULL,
    organisation_role_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (organisation_id, organisation_invitation_id, organisation_role_id),
    KEY idx_organisation_invitation_roles_role (organisation_id, organisation_role_id),

    CONSTRAINT fk_organisation_invitation_roles_invitation
        FOREIGN KEY (organisation_invitation_id, organisation_id)
        REFERENCES organisation_invitations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_organisation_invitation_roles_role
        FOREIGN KEY (organisation_role_id, organisation_id)
        REFERENCES organisation_roles (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- migrate:down transaction:false
DROP TABLE organisation_invitation_roles;
DROP TABLE organisation_invitations;
