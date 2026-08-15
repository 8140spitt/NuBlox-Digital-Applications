-- NuBlox organisation bootstrap and onboarding
-- Adds a server-side provisioning intent for self-service organisation creation.
-- migrate:up transaction:false

CREATE TABLE organisation_bootstrap_intents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    email VARCHAR(320) NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    auth_user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    created_user_id BIGINT UNSIGNED NULL,
    organisation_id BIGINT UNSIGNED NULL,
    legal_name VARCHAR(255) NOT NULL,
    trading_name VARCHAR(255) NULL,
    default_timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'Europe/London',
    default_currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'GBP',
    expires_at DATETIME(6) NOT NULL,
    activated_at DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    pending_email VARCHAR(320)
        GENERATED ALWAYS AS (
            CASE WHEN status = 'pending' THEN email ELSE NULL END
        ) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_organisation_bootstrap_intents_public_id (public_id),
    UNIQUE KEY uq_organisation_bootstrap_intents_token_hash (token_hash),
    UNIQUE KEY uq_organisation_bootstrap_intents_pending_email (pending_email),
    UNIQUE KEY uq_organisation_bootstrap_intents_auth_user (auth_user_id),
    KEY idx_organisation_bootstrap_intents_expiry (status, expires_at),
    KEY idx_organisation_bootstrap_intents_created_user (created_user_id),
    KEY idx_organisation_bootstrap_intents_organisation (organisation_id),

    CONSTRAINT fk_organisation_bootstrap_intents_auth_user
        FOREIGN KEY (auth_user_id) REFERENCES auth_users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_organisation_bootstrap_intents_created_user
        FOREIGN KEY (created_user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_organisation_bootstrap_intents_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_organisation_bootstrap_intents_status
        CHECK (status IN ('pending', 'activated', 'revoked', 'expired')),
    CONSTRAINT ck_organisation_bootstrap_intents_terminal_state
        CHECK (
            (
                status = 'activated'
                AND auth_user_id IS NOT NULL
                AND created_user_id IS NOT NULL
                AND organisation_id IS NOT NULL
                AND activated_at IS NOT NULL
                AND revoked_at IS NULL
            )
            OR (
                status = 'revoked'
                AND created_user_id IS NULL
                AND organisation_id IS NULL
                AND activated_at IS NULL
                AND revoked_at IS NOT NULL
            )
            OR (
                status IN ('pending', 'expired')
                AND created_user_id IS NULL
                AND organisation_id IS NULL
                AND activated_at IS NULL
                AND revoked_at IS NULL
            )
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- migrate:down transaction:false
DROP TABLE organisation_bootstrap_intents;
