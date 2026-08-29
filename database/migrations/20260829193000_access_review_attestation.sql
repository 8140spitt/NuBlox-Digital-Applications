-- Periodic organisation access review and attestation evidence.
-- Reviews govern organisation access security only and remain separate from job/work architecture.

-- migrate:up transaction:false

CREATE TABLE access_review_campaigns (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(160) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    snapshot_at DATETIME(6) NOT NULL,
    due_at DATETIME(6) NULL,
    opened_by_member_id BIGINT UNSIGNED NOT NULL,
    opened_at DATETIME(6) NOT NULL,
    completed_at DATETIME(6) NULL,
    cancelled_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_access_review_campaigns_public_id (public_id),
    KEY idx_access_review_campaigns_org_status (organisation_id, status, due_at),
    KEY idx_access_review_campaigns_opened_by (opened_by_member_id, opened_at),

    CONSTRAINT fk_access_review_campaigns_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_access_review_campaigns_opened_by_member
        FOREIGN KEY (opened_by_member_id)
        REFERENCES organisation_members (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_access_review_campaigns_status
        CHECK (status IN ('open', 'completed', 'cancelled')),
    CONSTRAINT ck_access_review_campaigns_due
        CHECK (due_at IS NULL OR due_at > opened_at),
    CONSTRAINT ck_access_review_campaigns_terminal_state
        CHECK (
            (status = 'open' AND completed_at IS NULL AND cancelled_at IS NULL)
            OR (status = 'completed' AND completed_at IS NOT NULL AND cancelled_at IS NULL)
            OR (status = 'cancelled' AND completed_at IS NULL AND cancelled_at IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE access_review_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    campaign_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    organisation_member_id BIGINT UNSIGNED NOT NULL,
    member_public_id CHAR(36) NOT NULL,
    access_type VARCHAR(24) NOT NULL,
    source_key VARCHAR(160) NOT NULL,
    organisation_role_id BIGINT UNSIGNED NULL,
    role_public_id CHAR(36) NULL,
    stable_role_key VARCHAR(64) NULL,
    permission_id BIGINT UNSIGNED NULL,
    permission_key VARCHAR(160) NULL,
    permission_effect VARCHAR(8) NULL,
    display_label VARCHAR(160) NOT NULL,
    lifecycle_state VARCHAR(16) NOT NULL,
    effective_from DATETIME(6) NULL,
    expires_at DATETIME(6) NULL,
    source_reason VARCHAR(1000) NULL,
    decision VARCHAR(16) NULL,
    decision_reason VARCHAR(1000) NULL,
    decided_by_member_id BIGINT UNSIGNED NULL,
    decided_at DATETIME(6) NULL,
    revocation_applied_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_access_review_items_public_id (public_id),
    UNIQUE KEY uq_access_review_items_source (campaign_id, access_type, organisation_member_id, source_key),
    KEY idx_access_review_items_campaign_decision (campaign_id, decision),
    KEY idx_access_review_items_member (organisation_id, organisation_member_id),
    KEY idx_access_review_items_role (organisation_role_id),
    KEY idx_access_review_items_permission (permission_id),

    CONSTRAINT fk_access_review_items_campaign
        FOREIGN KEY (campaign_id)
        REFERENCES access_review_campaigns (id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_access_review_items_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_access_review_items_member
        FOREIGN KEY (organisation_member_id)
        REFERENCES organisation_members (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_access_review_items_role
        FOREIGN KEY (organisation_role_id)
        REFERENCES organisation_roles (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_access_review_items_permission
        FOREIGN KEY (permission_id)
        REFERENCES permissions (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_access_review_items_decided_by_member
        FOREIGN KEY (decided_by_member_id)
        REFERENCES organisation_members (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_access_review_items_access_type
        CHECK (access_type IN ('role_assignment', 'permission_override')),
    CONSTRAINT ck_access_review_items_lifecycle_state
        CHECK (lifecycle_state IN ('effective', 'scheduled', 'expired')),
    CONSTRAINT ck_access_review_items_permission_effect
        CHECK (permission_effect IS NULL OR permission_effect IN ('allow', 'deny')),
    CONSTRAINT ck_access_review_items_decision
        CHECK (decision IS NULL OR decision IN ('certify', 'revoke')),
    CONSTRAINT ck_access_review_items_source_shape
        CHECK (
            (access_type = 'role_assignment'
                AND organisation_role_id IS NOT NULL
                AND role_public_id IS NOT NULL
                AND permission_id IS NULL
                AND permission_key IS NULL
                AND permission_effect IS NULL)
            OR
            (access_type = 'permission_override'
                AND organisation_role_id IS NULL
                AND role_public_id IS NULL
                AND stable_role_key IS NULL
                AND permission_id IS NOT NULL
                AND permission_key IS NOT NULL
                AND permission_effect IS NOT NULL)
        ),
    CONSTRAINT ck_access_review_items_decision_fields
        CHECK (
            (decision IS NULL AND decided_by_member_id IS NULL AND decided_at IS NULL)
            OR (decision IS NOT NULL AND decided_by_member_id IS NOT NULL AND decided_at IS NOT NULL)
        ),
    CONSTRAINT ck_access_review_items_revocation_fields
        CHECK (revocation_applied_at IS NULL OR decision = 'revoke')
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- migrate:down transaction:false
DROP TABLE access_review_items;
DROP TABLE access_review_campaigns;