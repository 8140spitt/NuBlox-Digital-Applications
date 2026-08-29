-- Time-bounded organisation access assignments and permission exceptions.
-- Access lifecycle remains separate from functional roles, job profiles, careers and positions.

-- migrate:up transaction:false

CREATE TABLE member_role_access_windows (
    organisation_id BIGINT UNSIGNED NOT NULL,
    organisation_member_id BIGINT UNSIGNED NOT NULL,
    organisation_role_id BIGINT UNSIGNED NOT NULL,
    effective_from DATETIME(6) NULL,
    expires_at DATETIME(6) NULL,
    reason VARCHAR(500) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (organisation_id, organisation_member_id, organisation_role_id),
    KEY idx_member_role_access_windows_expiry (organisation_id, expires_at),

    CONSTRAINT fk_member_role_access_windows_assignment
        FOREIGN KEY (organisation_id, organisation_member_id, organisation_role_id)
        REFERENCES member_roles (organisation_id, organisation_member_id, organisation_role_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_member_role_access_windows_range
        CHECK (effective_from IS NULL OR expires_at IS NULL OR effective_from < expires_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE member_permission_override_access_windows (
    organisation_id BIGINT UNSIGNED NOT NULL,
    organisation_member_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT UNSIGNED NOT NULL,
    effective_from DATETIME(6) NULL,
    expires_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (organisation_id, organisation_member_id, permission_id),
    KEY idx_member_permission_override_windows_expiry (organisation_id, expires_at),

    CONSTRAINT fk_member_permission_override_windows_override
        FOREIGN KEY (organisation_id, organisation_member_id, permission_id)
        REFERENCES member_permission_overrides (organisation_id, organisation_member_id, permission_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_member_permission_override_windows_range
        CHECK (effective_from IS NULL OR expires_at IS NULL OR effective_from < expires_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- migrate:down transaction:false
DROP TABLE member_permission_override_access_windows;
DROP TABLE member_role_access_windows;