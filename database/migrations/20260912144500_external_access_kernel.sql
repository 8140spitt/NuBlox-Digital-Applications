-- NuBlox Network / External Access Kernel
-- Explicit, deny-by-default external access over canonical domain records.
-- migrate:up transaction:false

CREATE TABLE external_access_invitations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    invite_email VARCHAR(320) NOT NULL,
    auth_user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    context_type VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    context_public_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    resource_type VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    capability_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    domain_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    action_type VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    work_item_title VARCHAR(255) NOT NULL,
    work_item_summary TEXT NULL,
    due_at DATETIME(6) NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    expires_at DATETIME(6) NOT NULL,
    accepted_at DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    invited_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_external_access_invitations_public_id (public_id),
    UNIQUE KEY uq_external_access_invitations_token_hash (token_hash),
    KEY idx_external_access_invitations_email (invite_email, status, expires_at),
    KEY idx_external_access_invitations_auth (auth_user_id, status),
    KEY idx_external_access_invitations_owner (owning_organisation_id, status),

    CONSTRAINT fk_external_access_invitations_owner
        FOREIGN KEY (owning_organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_access_invitations_auth_user
        FOREIGN KEY (auth_user_id) REFERENCES auth_users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_access_invitations_inviter
        FOREIGN KEY (invited_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_external_access_invitations_status
        CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    CONSTRAINT ck_external_access_invitations_terminal_dates
        CHECK (
            (status = 'pending' AND accepted_at IS NULL AND revoked_at IS NULL)
            OR (status = 'accepted' AND accepted_at IS NOT NULL AND revoked_at IS NULL AND auth_user_id IS NOT NULL)
            OR (status = 'expired' AND accepted_at IS NULL AND revoked_at IS NULL)
            OR (status = 'revoked' AND revoked_at IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE external_access_grants (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    auth_user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    invitation_id BIGINT UNSIGNED NULL,
    context_type VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    context_public_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    resource_type VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    resource_public_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    capability_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    valid_from DATETIME(6) NOT NULL,
    valid_until DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_external_access_grants_public_id (public_id),
    UNIQUE KEY uq_external_access_grants_scope (
        owning_organisation_id,
        auth_user_id,
        context_type,
        context_public_id,
        resource_type,
        resource_public_id,
        capability_key
    ),
    KEY idx_external_access_grants_auth (auth_user_id, revoked_at, valid_until),
    KEY idx_external_access_grants_context (owning_organisation_id, context_type, context_public_id),
    KEY idx_external_access_grants_invitation (invitation_id),

    CONSTRAINT fk_external_access_grants_owner
        FOREIGN KEY (owning_organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_access_grants_auth_user
        FOREIGN KEY (auth_user_id) REFERENCES auth_users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_access_grants_invitation
        FOREIGN KEY (invitation_id) REFERENCES external_access_invitations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_access_grants_creator
        FOREIGN KEY (created_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_external_access_grants_validity
        CHECK (valid_until IS NULL OR valid_until > valid_from)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE external_work_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    auth_user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    external_access_grant_id BIGINT UNSIGNED NOT NULL,
    domain_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_type VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_public_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    action_type VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT NULL,
    state VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    due_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    cancelled_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_external_work_items_public_id (public_id),
    UNIQUE KEY uq_external_work_items_source_action (
        external_access_grant_id,
        domain_key,
        source_type,
        source_public_id,
        action_type
    ),
    KEY idx_external_work_items_inbox (auth_user_id, state, due_at, created_at),
    KEY idx_external_work_items_owner (owning_organisation_id, domain_key, state),

    CONSTRAINT fk_external_work_items_owner
        FOREIGN KEY (owning_organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_work_items_auth_user
        FOREIGN KEY (auth_user_id) REFERENCES auth_users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_work_items_grant
        FOREIGN KEY (external_access_grant_id) REFERENCES external_access_grants (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_external_work_items_state
        CHECK (state IN ('open', 'completed', 'cancelled')),
    CONSTRAINT ck_external_work_items_terminal_dates
        CHECK (
            (state = 'open' AND completed_at IS NULL AND cancelled_at IS NULL)
            OR (state = 'completed' AND completed_at IS NOT NULL AND cancelled_at IS NULL)
            OR (state = 'cancelled' AND cancelled_at IS NOT NULL AND completed_at IS NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE external_supplier_rfq_links (
    external_access_invitation_id BIGINT UNSIGNED NOT NULL,
    rfq_invitation_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (external_access_invitation_id),
    UNIQUE KEY uq_external_supplier_rfq_links_rfq_invitation (rfq_invitation_id),

    CONSTRAINT fk_external_supplier_rfq_links_external_invitation
        FOREIGN KEY (external_access_invitation_id) REFERENCES external_access_invitations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_supplier_rfq_links_rfq_invitation
        FOREIGN KEY (rfq_invitation_id) REFERENCES rfq_invitations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE external_delivery_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    external_access_invitation_id BIGINT UNSIGNED NOT NULL,
    channel VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'email',
    recipient VARCHAR(320) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_text TEXT NOT NULL,
    idempotency_key VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    delivery_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    available_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    sent_at DATETIME(6) NULL,
    last_attempt_at DATETIME(6) NULL,
    last_error VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_external_delivery_messages_public_id (public_id),
    UNIQUE KEY uq_external_delivery_messages_idempotency (idempotency_key),
    KEY idx_external_delivery_messages_queue (delivery_status, available_at, id),
    KEY idx_external_delivery_messages_invitation (external_access_invitation_id),

    CONSTRAINT fk_external_delivery_messages_owner
        FOREIGN KEY (owning_organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_delivery_messages_invitation
        FOREIGN KEY (external_access_invitation_id) REFERENCES external_access_invitations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_external_delivery_messages_channel
        CHECK (channel IN ('email')),
    CONSTRAINT ck_external_delivery_messages_status
        CHECK (delivery_status IN ('pending', 'sent', 'failed'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Existing active person-level project collaborations become explicit project-view grants.
INSERT INTO external_access_grants (
    public_id,
    owning_organisation_id,
    auth_user_id,
    invitation_id,
    context_type,
    context_public_id,
    resource_type,
    resource_public_id,
    capability_key,
    valid_from,
    valid_until,
    revoked_at,
    created_by_member_id
)
SELECT
    UUID(),
    collaborator.owning_organisation_id,
    collaborator.auth_user_id,
    NULL,
    'project',
    project.public_id,
    'project',
    project.public_id,
    'project.view',
    collaborator.joined_at,
    NULL,
    NULL,
    collaborator.invited_by_member_id
FROM project_external_collaborators AS collaborator
INNER JOIN projects AS project
    ON project.id = collaborator.project_id
WHERE collaborator.status = 'active'
ON DUPLICATE KEY UPDATE
    revoked_at = NULL,
    valid_until = NULL;

-- migrate:down transaction:false
DROP TABLE IF EXISTS external_delivery_messages;
DROP TABLE IF EXISTS external_supplier_rfq_links;
DROP TABLE IF EXISTS external_work_items;
DROP TABLE IF EXISTS external_access_grants;
DROP TABLE IF EXISTS external_access_invitations;
