-- Owner-governed delegation ceilings for organisation access administration.
-- Delegated authority remains separate from job/work architecture and never grants runtime permissions itself.

-- migrate:up transaction:false

CREATE TABLE organisation_delegation_policies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    organisation_member_id BIGINT UNSIGNED NOT NULL,
    effective_from DATETIME(6) NULL,
    expires_at DATETIME(6) NULL,
    reason VARCHAR(500) NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_organisation_delegation_policies_public_id (public_id),
    UNIQUE KEY uq_organisation_delegation_policies_member (organisation_id, organisation_member_id),
    KEY idx_organisation_delegation_policies_window (organisation_id, effective_from, expires_at),
    KEY idx_organisation_delegation_policies_created_by (created_by_member_id),

    CONSTRAINT fk_organisation_delegation_policies_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_organisation_delegation_policies_member
        FOREIGN KEY (organisation_member_id)
        REFERENCES organisation_members (id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_organisation_delegation_policies_created_by
        FOREIGN KEY (created_by_member_id)
        REFERENCES organisation_members (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_organisation_delegation_policies_window
        CHECK (effective_from IS NULL OR expires_at IS NULL OR effective_from < expires_at),
    CONSTRAINT ck_organisation_delegation_policies_reason
        CHECK (CHAR_LENGTH(TRIM(reason)) BETWEEN 1 AND 500)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE organisation_delegation_role_grants (
    policy_id BIGINT UNSIGNED NOT NULL,
    role_key VARCHAR(64) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (policy_id, role_key),

    CONSTRAINT fk_organisation_delegation_role_grants_policy
        FOREIGN KEY (policy_id)
        REFERENCES organisation_delegation_policies (id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_organisation_delegation_role_grants_role_key
        CHECK (role_key IN (
            'administrator',
            'manager',
            'finance-commercial',
            'member-professional',
            'field-worker',
            'read-only'
        ))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE organisation_delegation_permission_grants (
    policy_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (policy_id, permission_id),
    KEY idx_organisation_delegation_permission_grants_permission (permission_id),

    CONSTRAINT fk_organisation_delegation_permission_grants_policy
        FOREIGN KEY (policy_id)
        REFERENCES organisation_delegation_policies (id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_organisation_delegation_permission_grants_permission
        FOREIGN KEY (permission_id)
        REFERENCES permissions (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- migrate:down transaction:false
DROP TABLE organisation_delegation_permission_grants;
DROP TABLE organisation_delegation_role_grants;
DROP TABLE organisation_delegation_policies;