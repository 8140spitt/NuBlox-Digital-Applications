-- NuBlox personal context shortcuts
-- Durable recent, favourite and pinned context metadata over canonical records.
-- migrate:up transaction:false

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE member_context_preferences (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    organisation_member_id BIGINT UNSIGNED NOT NULL,
    context_kind VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    context_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    is_favourite TINYINT(1) NOT NULL DEFAULT 0,
    is_pinned TINYINT(1) NOT NULL DEFAULT 0,
    last_opened_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_member_context_preferences_context (
        organisation_id,
        organisation_member_id,
        context_kind,
        context_public_id
    ),
    KEY idx_member_context_preferences_shortcuts (
        organisation_id,
        organisation_member_id,
        is_pinned,
        is_favourite,
        last_opened_at
    ),

    CONSTRAINT fk_member_context_preferences_member
        FOREIGN KEY (organisation_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_member_context_preferences_kind
        CHECK (context_kind IN ('organisation', 'project', 'facility', 'asset')),
    CONSTRAINT ck_member_context_preferences_flags
        CHECK (
            is_favourite IN (0, 1)
            AND is_pinned IN (0, 1)
            AND (is_pinned = 0 OR is_favourite = 1)
        )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE member_context_preferences;
