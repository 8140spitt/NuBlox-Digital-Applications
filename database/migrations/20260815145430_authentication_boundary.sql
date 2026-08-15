-- NuBlox authentication boundary
-- Better Auth 1.6.25 core schema generated from ADR-0002 configuration,
-- normalised into the NuBlox forward migration stream.
-- migrate:up transaction:false

CREATE TABLE auth_users (
    id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    email_verified BOOLEAN NOT NULL,
    image TEXT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_auth_users_email (email)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE auth_sessions (
    id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    token VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL,
    ip_address TEXT NULL,
    user_agent TEXT NULL,
    auth_user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_auth_sessions_token (token),
    KEY idx_auth_sessions_auth_user (auth_user_id),
    CONSTRAINT fk_auth_sessions_auth_user
        FOREIGN KEY (auth_user_id) REFERENCES auth_users (id)
        ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE auth_accounts (
    id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider_account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    auth_user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    access_token TEXT NULL,
    refresh_token TEXT NULL,
    id_token TEXT NULL,
    access_token_expires_at TIMESTAMP(3) NULL,
    refresh_token_expires_at TIMESTAMP(3) NULL,
    scope TEXT NULL,
    password TEXT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_auth_accounts_auth_user (auth_user_id),
    CONSTRAINT fk_auth_accounts_auth_user
        FOREIGN KEY (auth_user_id) REFERENCES auth_users (id)
        ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE auth_verifications (
    id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    identifier VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_auth_verifications_identifier (identifier)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE auth_user_links (
    auth_user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    linked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (auth_user_id),
    UNIQUE KEY uq_auth_user_links_user (user_id),
    CONSTRAINT fk_auth_user_links_auth_user
        FOREIGN KEY (auth_user_id) REFERENCES auth_users (id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_auth_user_links_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- migrate:down transaction:false
DROP TABLE auth_user_links;
DROP TABLE auth_verifications;
DROP TABLE auth_accounts;
DROP TABLE auth_sessions;
DROP TABLE auth_users;
