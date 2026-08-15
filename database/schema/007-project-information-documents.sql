-- NuBlox: Digital Applications
-- Schema package 007: Project Information and Documents
-- Depends on: 001-platform-kernel.sql, 002-crm-parties.sql, 003-sales-quotes.sql
-- Target: MySQL 8.4 / InnoDB
-- Design target: 3NF by default
-- Generated: 2026-08-15
--
-- PRINCIPLES:
-- 1. Stable information identity is separate from immutable revision/version history.
-- 2. Binary payloads live in private object storage; MySQL stores authoritative metadata.
-- 3. Project information may be owned by any valid project participant organisation.
-- 4. Issue/review/transmittal/RFI/submittal/instruction evidence is append-oriented.
-- 5. Cross-organisation participation never implies unrestricted visibility.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
-- Controlled reference data
-- -----------------------------------------------------------------------------

CREATE TABLE information_container_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_information_container_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE information_purpose_codes (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_information_purpose_codes_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE submittal_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_submittal_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE instruction_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_instruction_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_change_event_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_change_event_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Project sites
-- -----------------------------------------------------------------------------

CREATE TABLE project_sites (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    site_code VARCHAR(80) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address_id BIGINT UNSIGNED NULL,
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_sites_public_id (public_id),
    UNIQUE KEY uq_project_sites_id_context (id, project_id, owning_organisation_id),
    UNIQUE KEY uq_project_sites_code (project_id, site_code),
    KEY idx_project_sites_address (address_id, owning_organisation_id),
    CONSTRAINT fk_project_sites_project
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_sites_address
        FOREIGN KEY (address_id, owning_organisation_id)
        REFERENCES addresses (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Information container identity and revisions
-- -----------------------------------------------------------------------------

CREATE TABLE information_containers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    information_container_type_id SMALLINT UNSIGNED NOT NULL,
    project_site_id BIGINT UNSIGNED NULL,
    container_number VARCHAR(160) NOT NULL,
    title VARCHAR(500) NOT NULL,
    discipline_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    classification_code VARCHAR(120) NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_information_containers_public_id (public_id),
    UNIQUE KEY uq_information_containers_id_owner (id, owning_organisation_id),
    UNIQUE KEY uq_information_containers_id_project_owner (id, project_id, owning_organisation_id),
    UNIQUE KEY uq_information_containers_number (
        project_id, owning_organisation_id, container_number
    ),
    KEY idx_information_containers_project (
        project_id, owning_organisation_id, information_container_type_id, lifecycle_status
    ),
    KEY idx_information_containers_site (project_site_id, project_id),
    CONSTRAINT fk_information_containers_project_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_information_containers_type
        FOREIGN KEY (information_container_type_id)
        REFERENCES information_container_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_information_containers_site
        FOREIGN KEY (project_site_id, project_id, owning_organisation_id)
        REFERENCES project_sites (id, project_id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_information_containers_creator
        FOREIGN KEY (created_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_information_containers_lifecycle
        CHECK (lifecycle_status IN ('active', 'closed', 'archived', 'cancelled'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE information_container_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    information_container_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    revision_code VARCHAR(80) NOT NULL,
    version_sequence INT UNSIGNED NOT NULL,
    title_at_version VARCHAR(500) NOT NULL,
    information_purpose_code_id SMALLINT UNSIGNED NULL,
    suitability_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    version_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    locked_by_member_id BIGINT UNSIGNED NULL,
    locked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_information_container_versions_public_id (public_id),
    UNIQUE KEY uq_information_container_versions_id_owner (id, owning_organisation_id),
    UNIQUE KEY uq_information_container_versions_id_container_context (
        id, owning_organisation_id, information_container_id
    ),
    UNIQUE KEY uq_information_container_versions_revision (
        owning_organisation_id, information_container_id, revision_code
    ),
    UNIQUE KEY uq_information_container_versions_sequence (
        owning_organisation_id, information_container_id, version_sequence
    ),
    KEY idx_information_container_versions_status (
        project_id, owning_organisation_id, version_status
    ),
    CONSTRAINT fk_information_container_versions_container
        FOREIGN KEY (information_container_id, project_id, owning_organisation_id)
        REFERENCES information_containers (id, project_id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_information_container_versions_purpose
        FOREIGN KEY (information_purpose_code_id)
        REFERENCES information_purpose_codes (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_information_container_versions_creator
        FOREIGN KEY (created_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_information_container_versions_locker
        FOREIGN KEY (locked_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_information_container_versions_sequence
        CHECK (version_sequence > 0),
    CONSTRAINT ck_information_container_versions_status
        CHECK (version_status IN ('draft', 'issued', 'superseded', 'withdrawn', 'void')),
    CONSTRAINT ck_information_container_versions_lock
        CHECK (
            (version_status = 'draft' AND locked_at IS NULL AND locked_by_member_id IS NULL)
            OR
            (version_status IN ('issued', 'superseded', 'withdrawn', 'void') AND locked_at IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE information_files (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    file_role VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    storage_provider VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    storage_bucket VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    storage_key VARCHAR(1000) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    content_type VARCHAR(255) NULL,
    size_bytes BIGINT UNSIGNED NOT NULL,
    checksum_algorithm VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    checksum_value VARCHAR(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    malware_scan_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_information_files_storage (
        storage_provider, storage_bucket, storage_key
    ),
    UNIQUE KEY uq_information_files_checksum_role (
        owning_organisation_id, information_container_version_id,
        file_role, checksum_algorithm, checksum_value
    ),
    KEY idx_information_files_version (
        information_container_version_id, owning_organisation_id
    ),
    CONSTRAINT fk_information_files_version
        FOREIGN KEY (information_container_version_id, owning_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_information_files_role
        CHECK (file_role IN ('authoritative', 'native', 'rendition', 'thumbnail', 'attachment')),
    CONSTRAINT ck_information_files_size
        CHECK (size_bytes > 0),
    CONSTRAINT ck_information_files_scan
        CHECK (malware_scan_status IN ('pending', 'clean', 'quarantined', 'failed'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE information_version_supersessions (
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    superseding_version_id BIGINT UNSIGNED NOT NULL,
    superseded_version_id BIGINT UNSIGNED NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (owning_organisation_id, superseding_version_id, superseded_version_id),
    CONSTRAINT fk_information_version_supersessions_new
        FOREIGN KEY (superseding_version_id, owning_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_information_version_supersessions_old
        FOREIGN KEY (superseded_version_id, owning_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_information_version_supersessions_creator
        FOREIGN KEY (created_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_information_version_supersessions_distinct
        CHECK (superseding_version_id <> superseded_version_id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE information_version_issue_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    issuing_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    issue_sequence INT UNSIGNED NOT NULL,
    issued_by_member_id BIGINT UNSIGNED NOT NULL,
    issue_channel VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    issued_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    note VARCHAR(1000) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_information_version_issue_events_sequence (
        issuing_organisation_id, information_container_version_id, issue_sequence
    ),
    CONSTRAINT fk_information_version_issue_events_issuer_participant
        FOREIGN KEY (project_id, issuing_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_information_version_issue_events_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_information_version_issue_events_member
        FOREIGN KEY (issued_by_member_id, issuing_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_information_version_issue_events_sequence CHECK (issue_sequence > 0),
    CONSTRAINT ck_information_version_issue_events_channel
        CHECK (issue_channel IN ('transmittal', 'portal', 'email', 'manual', 'api', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Transmittals
-- -----------------------------------------------------------------------------

CREATE TABLE transmittals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    issuing_organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    transmittal_number VARCHAR(120) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    purpose VARCHAR(160) NULL,
    issued_by_member_id BIGINT UNSIGNED NOT NULL,
    issued_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_transmittals_public_id (public_id),
    UNIQUE KEY uq_transmittals_id_context (id, project_id, issuing_organisation_id),
    UNIQUE KEY uq_transmittals_number (
        project_id, issuing_organisation_id, transmittal_number
    ),
    CONSTRAINT fk_transmittals_issuer_participant
        FOREIGN KEY (project_id, issuing_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_transmittals_member
        FOREIGN KEY (issued_by_member_id, issuing_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE transmittal_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    transmittal_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    issuing_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    sort_order INT UNSIGNED NOT NULL,
    note VARCHAR(1000) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_transmittal_items_version (
        transmittal_id, information_container_version_id
    ),
    UNIQUE KEY uq_transmittal_items_sort (transmittal_id, sort_order),
    CONSTRAINT fk_transmittal_items_transmittal
        FOREIGN KEY (transmittal_id, project_id, issuing_organisation_id)
        REFERENCES transmittals (id, project_id, issuing_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_transmittal_items_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE transmittal_recipients (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    transmittal_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    issuing_organisation_id BIGINT UNSIGNED NOT NULL,
    recipient_project_organisation_id BIGINT UNSIGNED NULL,
    source_party_id BIGINT UNSIGNED NULL,
    source_party_owner_organisation_id BIGINT UNSIGNED NULL,
    recipient_name VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(320) NULL,
    delivery_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    delivered_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_transmittal_recipients_transmittal (transmittal_id, delivery_status),
    CONSTRAINT fk_transmittal_recipients_transmittal
        FOREIGN KEY (transmittal_id, project_id, issuing_organisation_id)
        REFERENCES transmittals (id, project_id, issuing_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_transmittal_recipients_project_org
        FOREIGN KEY (project_id, recipient_project_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_transmittal_recipients_party
        FOREIGN KEY (source_party_id, source_party_owner_organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_transmittal_recipients_source
        CHECK (
            (recipient_project_organisation_id IS NOT NULL AND source_party_id IS NULL AND source_party_owner_organisation_id IS NULL)
            OR
            (recipient_project_organisation_id IS NULL AND source_party_id IS NOT NULL AND source_party_owner_organisation_id IS NOT NULL)
            OR
            (recipient_project_organisation_id IS NULL AND source_party_id IS NULL AND source_party_owner_organisation_id IS NULL)
        ),
    CONSTRAINT ck_transmittal_recipients_status
        CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'acknowledged')),
    CONSTRAINT ck_transmittal_recipients_delivered
        CHECK (delivered_at IS NULL OR delivery_status IN ('delivered', 'acknowledged'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- RFIs
-- -----------------------------------------------------------------------------

CREATE TABLE rfis (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    rfi_number VARCHAR(120) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    question TEXT NOT NULL,
    priority VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'normal',
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    due_at DATETIME(6) NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    opened_at DATETIME(6) NULL,
    closed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_rfis_public_id (public_id),
    UNIQUE KEY uq_rfis_id_owner (id, owning_organisation_id),
    UNIQUE KEY uq_rfis_id_project_owner (id, project_id, owning_organisation_id),
    UNIQUE KEY uq_rfis_number (project_id, owning_organisation_id, rfi_number),
    KEY idx_rfis_status_due (project_id, status, due_at),
    CONSTRAINT fk_rfis_project_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_rfis_creator
        FOREIGN KEY (created_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_rfis_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    CONSTRAINT ck_rfis_status
        CHECK (status IN ('draft', 'open', 'answered', 'reopened', 'closed', 'cancelled')),
    CONSTRAINT ck_rfis_dates CHECK (closed_at IS NULL OR opened_at IS NULL OR closed_at >= opened_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE rfi_addressees (
    project_id BIGINT UNSIGNED NOT NULL,
    rfi_id BIGINT UNSIGNED NOT NULL,
    rfi_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    addressee_organisation_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (rfi_id, addressee_organisation_id),
    CONSTRAINT fk_rfi_addressees_rfi
        FOREIGN KEY (rfi_id, project_id, rfi_owner_organisation_id)
        REFERENCES rfis (id, project_id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_rfi_addressees_project_org
        FOREIGN KEY (project_id, addressee_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE rfi_responses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    rfi_id BIGINT UNSIGNED NOT NULL,
    rfi_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    responding_organisation_id BIGINT UNSIGNED NOT NULL,
    response_sequence INT UNSIGNED NOT NULL,
    response_text TEXT NOT NULL,
    responded_by_member_id BIGINT UNSIGNED NOT NULL,
    responded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    is_final_response BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_rfi_responses_sequence (rfi_id, responding_organisation_id, response_sequence),
    CONSTRAINT fk_rfi_responses_rfi
        FOREIGN KEY (rfi_id, project_id, rfi_owner_organisation_id)
        REFERENCES rfis (id, project_id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_rfi_responses_responder_org
        FOREIGN KEY (project_id, responding_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_rfi_responses_member
        FOREIGN KEY (responded_by_member_id, responding_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_rfi_responses_sequence CHECK (response_sequence > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE rfi_information_links (
    rfi_id BIGINT UNSIGNED NOT NULL,
    rfi_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'related',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (rfi_id, information_container_version_id, link_role),
    CONSTRAINT fk_rfi_information_links_rfi
        FOREIGN KEY (rfi_id, rfi_owner_organisation_id)
        REFERENCES rfis (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_rfi_information_links_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_rfi_information_links_role
        CHECK (link_role IN ('related', 'question_basis', 'response_basis', 'superseded_reference'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Submittals and reviews
-- -----------------------------------------------------------------------------

CREATE TABLE submittals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    submittal_number VARCHAR(120) NOT NULL,
    submittal_type_id SMALLINT UNSIGNED NOT NULL,
    title VARCHAR(500) NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    due_at DATETIME(6) NULL,
    submitted_at DATETIME(6) NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_submittals_public_id (public_id),
    UNIQUE KEY uq_submittals_id_owner (id, owning_organisation_id),
    UNIQUE KEY uq_submittals_id_project_owner (id, project_id, owning_organisation_id),
    UNIQUE KEY uq_submittals_number (project_id, owning_organisation_id, submittal_number),
    KEY idx_submittals_status_due (project_id, status, due_at),
    CONSTRAINT fk_submittals_project_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_submittals_type
        FOREIGN KEY (submittal_type_id)
        REFERENCES submittal_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_submittals_creator
        FOREIGN KEY (created_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_submittals_status
        CHECK (status IN ('draft', 'submitted', 'under_review', 'reviewed', 'closed', 'withdrawn')),
    CONSTRAINT ck_submittals_submitted_at
        CHECK ((status = 'draft' AND submitted_at IS NULL) OR status IN ('submitted', 'under_review', 'reviewed', 'closed', 'withdrawn'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE submittal_items (
    submittal_id BIGINT UNSIGNED NOT NULL,
    submittal_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    sort_order INT UNSIGNED NOT NULL,
    note VARCHAR(1000) NULL,
    PRIMARY KEY (submittal_id, information_container_version_id),
    UNIQUE KEY uq_submittal_items_sort (submittal_id, sort_order),
    CONSTRAINT fk_submittal_items_submittal
        FOREIGN KEY (submittal_id, submittal_owner_organisation_id)
        REFERENCES submittals (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_submittal_items_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE submittal_reviewers (
    project_id BIGINT UNSIGNED NOT NULL,
    submittal_id BIGINT UNSIGNED NOT NULL,
    submittal_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    reviewer_organisation_id BIGINT UNSIGNED NOT NULL,
    due_at DATETIME(6) NULL,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (submittal_id, reviewer_organisation_id),
    CONSTRAINT fk_submittal_reviewers_submittal
        FOREIGN KEY (submittal_id, project_id, submittal_owner_organisation_id)
        REFERENCES submittals (id, project_id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_submittal_reviewers_project_org
        FOREIGN KEY (project_id, reviewer_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE submittal_reviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    submittal_id BIGINT UNSIGNED NOT NULL,
    reviewer_organisation_id BIGINT UNSIGNED NOT NULL,
    review_sequence INT UNSIGNED NOT NULL,
    outcome VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    comments TEXT NULL,
    reviewed_by_member_id BIGINT UNSIGNED NOT NULL,
    reviewed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_submittal_reviews_sequence (
        submittal_id, reviewer_organisation_id, review_sequence
    ),
    CONSTRAINT fk_submittal_reviews_reviewer
        FOREIGN KEY (submittal_id, reviewer_organisation_id)
        REFERENCES submittal_reviewers (submittal_id, reviewer_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_submittal_reviews_member
        FOREIGN KEY (reviewed_by_member_id, reviewer_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_submittal_reviews_sequence CHECK (review_sequence > 0),
    CONSTRAINT ck_submittal_reviews_outcome
        CHECK (outcome IN (
            'approved', 'approved_with_comments', 'revise_resubmit',
            'rejected', 'no_objection', 'for_information'
        ))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Formal instructions
-- -----------------------------------------------------------------------------

CREATE TABLE project_instructions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    issuing_organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    instruction_number VARCHAR(120) NOT NULL,
    instruction_type_id SMALLINT UNSIGNED NOT NULL,
    subject VARCHAR(500) NOT NULL,
    instruction_text TEXT NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    issued_by_member_id BIGINT UNSIGNED NOT NULL,
    issued_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_instructions_public_id (public_id),
    UNIQUE KEY uq_project_instructions_id_owner (id, issuing_organisation_id),
    UNIQUE KEY uq_project_instructions_id_project_owner (id, project_id, issuing_organisation_id),
    UNIQUE KEY uq_project_instructions_number (
        project_id, issuing_organisation_id, instruction_number
    ),
    CONSTRAINT fk_project_instructions_project_participant
        FOREIGN KEY (project_id, issuing_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_instructions_type
        FOREIGN KEY (instruction_type_id)
        REFERENCES instruction_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_instructions_member
        FOREIGN KEY (issued_by_member_id, issuing_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_project_instructions_status
        CHECK (status IN ('draft', 'issued', 'acknowledged', 'superseded', 'withdrawn', 'closed')),
    CONSTRAINT ck_project_instructions_issued_at
        CHECK ((status = 'draft' AND issued_at IS NULL) OR status IN ('issued', 'acknowledged', 'superseded', 'withdrawn', 'closed'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE instruction_recipients (
    instruction_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    issuing_organisation_id BIGINT UNSIGNED NOT NULL,
    recipient_organisation_id BIGINT UNSIGNED NOT NULL,
    acknowledged_by_member_id BIGINT UNSIGNED NULL,
    acknowledged_at DATETIME(6) NULL,
    PRIMARY KEY (instruction_id, recipient_organisation_id),
    CONSTRAINT fk_instruction_recipients_instruction
        FOREIGN KEY (instruction_id, project_id, issuing_organisation_id)
        REFERENCES project_instructions (id, project_id, issuing_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_instruction_recipients_org
        FOREIGN KEY (project_id, recipient_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_instruction_recipients_ack_member
        FOREIGN KEY (acknowledged_by_member_id, recipient_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_instruction_recipients_ack
        CHECK ((acknowledged_at IS NULL AND acknowledged_by_member_id IS NULL) OR (acknowledged_at IS NOT NULL AND acknowledged_by_member_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE instruction_information_links (
    instruction_id BIGINT UNSIGNED NOT NULL,
    issuing_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'related',
    PRIMARY KEY (instruction_id, information_container_version_id, link_role),
    CONSTRAINT fk_instruction_information_links_instruction
        FOREIGN KEY (instruction_id, issuing_organisation_id)
        REFERENCES project_instructions (id, issuing_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_instruction_information_links_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_instruction_information_links_role
        CHECK (link_role IN ('basis', 'issued_with', 'related', 'supersedes_reference'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Project change register
-- -----------------------------------------------------------------------------

CREATE TABLE project_change_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    change_number VARCHAR(120) NOT NULL,
    project_change_event_type_id SMALLINT UNSIGNED NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'identified',
    identified_by_member_id BIGINT UNSIGNED NOT NULL,
    identified_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    closed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_change_events_public_id (public_id),
    UNIQUE KEY uq_project_change_events_id_owner (id, owning_organisation_id),
    UNIQUE KEY uq_project_change_events_number (
        project_id, owning_organisation_id, change_number
    ),
    KEY idx_project_change_events_status (project_id, status, identified_at),
    CONSTRAINT fk_project_change_events_project_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_change_events_type
        FOREIGN KEY (project_change_event_type_id)
        REFERENCES project_change_event_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_change_events_identifier
        FOREIGN KEY (identified_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_project_change_events_status
        CHECK (status IN ('identified', 'under_review', 'accepted', 'rejected', 'implemented', 'closed', 'cancelled')),
    CONSTRAINT ck_project_change_events_dates CHECK (closed_at IS NULL OR closed_at >= identified_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE change_event_information_links (
    project_change_event_id BIGINT UNSIGNED NOT NULL,
    change_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'related',
    PRIMARY KEY (project_change_event_id, information_container_version_id, link_role),
    CONSTRAINT fk_change_event_information_links_change
        FOREIGN KEY (project_change_event_id, change_owner_organisation_id)
        REFERENCES project_change_events (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_change_event_information_links_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_change_event_information_links_role
        CHECK (link_role IN ('basis', 'affected', 'proposed', 'implemented', 'related'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE instruction_change_events (
    instruction_id BIGINT UNSIGNED NOT NULL,
    instruction_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    project_change_event_id BIGINT UNSIGNED NOT NULL,
    change_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'drives',
    PRIMARY KEY (instruction_id, project_change_event_id),
    CONSTRAINT fk_instruction_change_events_instruction
        FOREIGN KEY (instruction_id, instruction_owner_organisation_id)
        REFERENCES project_instructions (id, issuing_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_instruction_change_events_change
        FOREIGN KEY (project_change_event_id, change_owner_organisation_id)
        REFERENCES project_change_events (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_instruction_change_events_role
        CHECK (link_role IN ('drives', 'implements', 'related'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Information review/approval workflow for exact revisions
-- -----------------------------------------------------------------------------

CREATE TABLE information_review_workflows (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    workflow_name VARCHAR(255) NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    started_by_member_id BIGINT UNSIGNED NOT NULL,
    started_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_information_review_workflows_public_id (public_id),
    UNIQUE KEY uq_information_review_workflows_id_owner (id, owning_organisation_id),
    KEY idx_information_review_workflows_version (
        information_container_version_id, status
    ),
    CONSTRAINT fk_information_review_workflows_owner_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_information_review_workflows_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_information_review_workflows_starter
        FOREIGN KEY (started_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_information_review_workflows_status
        CHECK (status IN ('draft', 'active', 'approved', 'rejected', 'cancelled')),
    CONSTRAINT ck_information_review_workflows_dates
        CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE information_review_steps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    information_review_workflow_id BIGINT UNSIGNED NOT NULL,
    workflow_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    step_number SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    decision_rule VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'all',
    due_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_information_review_steps_id_workflow (id, information_review_workflow_id),
    UNIQUE KEY uq_information_review_steps_number (
        information_review_workflow_id, step_number
    ),
    CONSTRAINT fk_information_review_steps_workflow
        FOREIGN KEY (information_review_workflow_id, workflow_owner_organisation_id)
        REFERENCES information_review_workflows (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_information_review_steps_number CHECK (step_number > 0),
    CONSTRAINT ck_information_review_steps_rule
        CHECK (decision_rule IN ('all', 'any', 'majority', 'single'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE information_review_step_reviewers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    information_review_step_id BIGINT UNSIGNED NOT NULL,
    information_review_workflow_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    reviewer_organisation_id BIGINT UNSIGNED NOT NULL,
    reviewer_member_id BIGINT UNSIGNED NULL,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reviewer_member_key BIGINT UNSIGNED
        GENERATED ALWAYS AS (COALESCE(reviewer_member_id, 0)) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_information_review_step_reviewers_assignment (
        information_review_step_id,
        reviewer_organisation_id,
        reviewer_member_key
    ),
    CONSTRAINT fk_information_review_step_reviewers_step
        FOREIGN KEY (information_review_step_id, information_review_workflow_id)
        REFERENCES information_review_steps (id, information_review_workflow_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_information_review_step_reviewers_org
        FOREIGN KEY (project_id, reviewer_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_information_review_step_reviewers_member
        FOREIGN KEY (reviewer_member_id, reviewer_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE information_review_decisions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    information_review_step_reviewer_id BIGINT UNSIGNED NOT NULL,
    decision VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    comments TEXT NULL,
    decided_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_information_review_decisions_assignment (
        information_review_step_reviewer_id
    ),
    CONSTRAINT fk_information_review_decisions_assignment
        FOREIGN KEY (information_review_step_reviewer_id)
        REFERENCES information_review_step_reviewers (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_information_review_decisions_decision
        CHECK (decision IN ('approved', 'approved_with_comments', 'rejected', 'revise_resubmit', 'no_objection'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Initial controlled reference values
-- -----------------------------------------------------------------------------

INSERT INTO information_container_types (code, name) VALUES
    ('drawing', 'Drawing'),
    ('specification', 'Specification'),
    ('schedule', 'Schedule'),
    ('report', 'Report'),
    ('calculation', 'Calculation'),
    ('model', 'Model'),
    ('certificate', 'Certificate'),
    ('method_statement', 'Method statement'),
    ('photo_set', 'Photograph set'),
    ('other', 'Other controlled information');

INSERT INTO information_purpose_codes (code, name) VALUES
    ('information', 'For information'),
    ('review', 'For review'),
    ('approval', 'For approval'),
    ('construction', 'For construction / execution'),
    ('record', 'For record / as-built'),
    ('tender', 'For tender'),
    ('coordination', 'For coordination');

INSERT INTO submittal_types (code, name) VALUES
    ('technical', 'Technical submittal'),
    ('material', 'Material submittal'),
    ('sample', 'Sample'),
    ('shop_drawing', 'Shop drawing'),
    ('design', 'Design submission'),
    ('method', 'Method submission'),
    ('other', 'Other submittal');

INSERT INTO instruction_types (code, name) VALUES
    ('project', 'Project instruction'),
    ('architect', 'Architect instruction'),
    ('contract_administrator', 'Contract administrator instruction'),
    ('site', 'Site instruction'),
    ('client', 'Client instruction'),
    ('other', 'Other formal instruction');

INSERT INTO project_change_event_types (code, name) VALUES
    ('design_change', 'Design change'),
    ('client_request', 'Client request'),
    ('site_condition', 'Site condition'),
    ('statutory', 'Statutory or regulatory requirement'),
    ('instruction', 'Instruction-driven change'),
    ('scope_clarification', 'Scope clarification'),
    ('other', 'Other change event');

-- -----------------------------------------------------------------------------
-- Required application invariants not completely expressible as simple FKs
-- -----------------------------------------------------------------------------
-- 1. Cross-project references are prohibited even where individual FKs are otherwise valid.
-- 2. A participant organisation must have effective project permission before creating,
--    viewing, issuing, reviewing or approving a record; FK participation alone is insufficient.
-- 3. Once issued/locked, information-container versions and authoritative file metadata are
--    immutable through normal write APIs. Corrections create a new version.
-- 4. Supersession relationships must remain within the same logical information container
--    and must not contain cycles.
-- 5. information_version_issue_events must reference a version belonging to the stated project.
-- 6. Transmittal items must belong to the transmittal project and be visible to the issuer.
-- 7. RFI responses must come from an authorised addressee/project participant according to
--    configured workflow; an FK-valid participant is not automatically an authorised responder.
-- 8. RFI close/reopen transitions require configured state-machine rules and audit events.
-- 9. Submitted submittals cannot have their submitted item set rewritten; revised material
--    requires a new submittal/revision according to workflow policy.
-- 10. Formal instructions become immutable once issued; corrections use supersession/withdrawal.
-- 11. Project change events are information-management facts. Package 009 commercial variation
--    logic may reference them but must not overwrite them.
-- 12. Review workflow step ordering, completion and decision-rule evaluation are transactionally
--    enforced in domain services and integration tests.
-- 13. Null reviewer_member_id means an organisation-level reviewer assignment. The application
--    must ensure only one organisation-level assignment exists per step/org where MySQL NULL
--    uniqueness semantics would otherwise permit duplicates.
-- 14. Object uploads are quarantined until malware/security checks pass; issued authoritative
--    versions may not reference quarantined/failed objects.
-- 15. Hard deletion of issued/transmitted/reviewed contractual information is prohibited through
--    ordinary business APIs. Retention, withdrawal, void and supersession preserve evidence.
