-- NuBlox Network external project actions
-- Person-level external responses are recorded without inventing tenant membership.
-- migrate:up transaction:false

CREATE TABLE external_rfi_responses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    rfi_id BIGINT UNSIGNED NOT NULL,
    external_collaborator_id BIGINT UNSIGNED NOT NULL,
    auth_user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    response_sequence INT UNSIGNED NOT NULL,
    response_text TEXT NOT NULL,
    is_final_response BOOLEAN NOT NULL DEFAULT FALSE,
    responded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_external_rfi_responses_public_id (public_id),
    UNIQUE KEY uq_external_rfi_responses_sequence (rfi_id, external_collaborator_id, response_sequence),
    KEY idx_external_rfi_responses_project (owning_organisation_id, project_id, rfi_id),
    KEY idx_external_rfi_responses_auth (auth_user_id, responded_at),

    CONSTRAINT fk_external_rfi_responses_owner
        FOREIGN KEY (owning_organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_rfi_responses_project
        FOREIGN KEY (project_id) REFERENCES projects (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_rfi_responses_rfi
        FOREIGN KEY (rfi_id) REFERENCES rfis (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_rfi_responses_collaborator
        FOREIGN KEY (external_collaborator_id) REFERENCES project_external_collaborators (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_rfi_responses_auth_user
        FOREIGN KEY (auth_user_id) REFERENCES auth_users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE external_submittal_reviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    submittal_id BIGINT UNSIGNED NOT NULL,
    external_collaborator_id BIGINT UNSIGNED NOT NULL,
    auth_user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    review_sequence INT UNSIGNED NOT NULL,
    outcome VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    comments TEXT NULL,
    reviewed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_external_submittal_reviews_public_id (public_id),
    UNIQUE KEY uq_external_submittal_reviews_sequence (submittal_id, external_collaborator_id, review_sequence),
    KEY idx_external_submittal_reviews_project (owning_organisation_id, project_id, submittal_id),
    KEY idx_external_submittal_reviews_auth (auth_user_id, reviewed_at),

    CONSTRAINT fk_external_submittal_reviews_owner
        FOREIGN KEY (owning_organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_submittal_reviews_project
        FOREIGN KEY (project_id) REFERENCES projects (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_submittal_reviews_submittal
        FOREIGN KEY (submittal_id) REFERENCES submittals (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_submittal_reviews_collaborator
        FOREIGN KEY (external_collaborator_id) REFERENCES project_external_collaborators (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_submittal_reviews_auth_user
        FOREIGN KEY (auth_user_id) REFERENCES auth_users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE external_instruction_acknowledgements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    instruction_id BIGINT UNSIGNED NOT NULL,
    external_collaborator_id BIGINT UNSIGNED NOT NULL,
    auth_user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    acknowledged_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_external_instruction_ack_public_id (public_id),
    UNIQUE KEY uq_external_instruction_ack_collaborator (instruction_id, external_collaborator_id),
    KEY idx_external_instruction_ack_project (owning_organisation_id, project_id, instruction_id),
    KEY idx_external_instruction_ack_auth (auth_user_id, acknowledged_at),

    CONSTRAINT fk_external_instruction_ack_owner
        FOREIGN KEY (owning_organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_instruction_ack_project
        FOREIGN KEY (project_id) REFERENCES projects (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_instruction_ack_instruction
        FOREIGN KEY (instruction_id) REFERENCES project_instructions (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_instruction_ack_collaborator
        FOREIGN KEY (external_collaborator_id) REFERENCES project_external_collaborators (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_external_instruction_ack_auth_user
        FOREIGN KEY (auth_user_id) REFERENCES auth_users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- migrate:down transaction:false
DROP TABLE IF EXISTS external_instruction_acknowledgements;
DROP TABLE IF EXISTS external_submittal_reviews;
DROP TABLE IF EXISTS external_rfi_responses;
