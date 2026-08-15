-- NuBlox: Digital Applications
-- Schema package 002: CRM and Party Model
-- Depends on: 001-platform-kernel.sql
-- Target: MySQL 8.4 / InnoDB
-- Design target: 3NF by default
-- Generated: 2026-08-15
--
-- PRINCIPLES:
-- 1. CRM parties are private to the owning NuBlox organisation/tenant.
-- 2. A party can hold many business roles; do not duplicate client/supplier/etc identity.
-- 3. A person/organisation contact relationship owns job title and department.
-- 4. Subtype exclusivity (person vs organisation) is a cross-table domain invariant and
--    must be enforced by application services and integration tests.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
-- Global reference data
-- -----------------------------------------------------------------------------

CREATE TABLE party_role_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_party_role_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE party_identifier_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_party_identifier_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE party_relationship_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    inverse_name VARCHAR(160) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_party_relationship_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE opportunity_party_role_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_opportunity_party_role_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE crm_activity_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_crm_activity_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Party supertype and subtypes
-- -----------------------------------------------------------------------------

CREATE TABLE parties (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    party_kind VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    account_owner_member_id BIGINT UNSIGNED NULL,
    status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_parties_public_id (public_id),
    UNIQUE KEY uq_parties_id_organisation (id, organisation_id),
    KEY idx_parties_organisation_kind_status (organisation_id, party_kind, status),
    KEY idx_parties_owner (account_owner_member_id, organisation_id),

    CONSTRAINT fk_parties_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_parties_account_owner
        FOREIGN KEY (account_owner_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_parties_kind
        CHECK (party_kind IN ('person', 'organisation')),
    CONSTRAINT ck_parties_status
        CHECK (status IN ('active', 'inactive', 'archived'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE party_persons (
    party_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    honorific VARCHAR(64) NULL,
    given_names VARCHAR(200) NULL,
    family_name VARCHAR(160) NULL,
    preferred_name VARCHAR(160) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (party_id),
    UNIQUE KEY uq_party_persons_party_organisation (party_id, organisation_id),

    CONSTRAINT fk_party_persons_party
        FOREIGN KEY (party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_party_persons_name
        CHECK (given_names IS NOT NULL OR family_name IS NOT NULL OR preferred_name IS NOT NULL)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE party_organisations (
    party_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    trading_name VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (party_id),
    UNIQUE KEY uq_party_organisations_party_organisation (party_id, organisation_id),
    KEY idx_party_organisations_legal_name (organisation_id, legal_name),
    KEY idx_party_organisations_trading_name (organisation_id, trading_name),

    CONSTRAINT fk_party_organisations_party
        FOREIGN KEY (party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Party identifiers and communication channels
-- -----------------------------------------------------------------------------

CREATE TABLE party_identifiers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    party_id BIGINT UNSIGNED NOT NULL,
    party_identifier_type_id SMALLINT UNSIGNED NOT NULL,
    identifier_value VARCHAR(200) NOT NULL,
    issuing_country_code CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NULL,
    issuing_authority VARCHAR(200) NULL,
    valid_from DATE NULL,
    valid_to DATE NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_party_identifiers_party_type_value (
        organisation_id,
        party_id,
        party_identifier_type_id,
        identifier_value
    ),
    KEY idx_party_identifiers_lookup (
        organisation_id,
        party_identifier_type_id,
        identifier_value
    ),

    CONSTRAINT fk_party_identifiers_party
        FOREIGN KEY (party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_party_identifiers_type
        FOREIGN KEY (party_identifier_type_id)
        REFERENCES party_identifier_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_party_identifiers_dates
        CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE party_email_addresses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    party_id BIGINT UNSIGNED NOT NULL,
    email VARCHAR(320) NOT NULL,
    label VARCHAR(64) NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at DATETIME(6) NULL,
    primary_party_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE WHEN is_primary = TRUE THEN party_id ELSE NULL END
        ) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_party_email_addresses_value (organisation_id, party_id, email),
    UNIQUE KEY uq_party_email_addresses_one_primary (organisation_id, primary_party_id),
    KEY idx_party_email_addresses_email (organisation_id, email),

    CONSTRAINT fk_party_email_addresses_party
        FOREIGN KEY (party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_party_email_addresses_verified
        CHECK (
            (is_verified = FALSE AND verified_at IS NULL)
            OR is_verified = TRUE
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE party_phone_numbers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    party_id BIGINT UNSIGNED NOT NULL,
    phone_e164 VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    extension VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
    label VARCHAR(64) NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    primary_party_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE WHEN is_primary = TRUE THEN party_id ELSE NULL END
        ) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_party_phone_numbers_value (organisation_id, party_id, phone_e164, extension),
    UNIQUE KEY uq_party_phone_numbers_one_primary (organisation_id, primary_party_id),
    KEY idx_party_phone_numbers_lookup (organisation_id, phone_e164),

    CONSTRAINT fk_party_phone_numbers_party
        FOREIGN KEY (party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE party_addresses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    party_id BIGINT UNSIGNED NOT NULL,
    address_id BIGINT UNSIGNED NOT NULL,
    address_role VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from DATE NULL,
    valid_to DATE NULL,
    primary_party_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE WHEN is_primary = TRUE THEN party_id ELSE NULL END
        ) STORED,
    primary_address_role VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin
        GENERATED ALWAYS AS (
            CASE WHEN is_primary = TRUE THEN address_role ELSE NULL END
        ) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_party_addresses_one_primary_role (
        organisation_id,
        primary_party_id,
        primary_address_role
    ),
    KEY idx_party_addresses_party (organisation_id, party_id, address_role),
    KEY idx_party_addresses_address (address_id, organisation_id),

    CONSTRAINT fk_party_addresses_party
        FOREIGN KEY (party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_party_addresses_address
        FOREIGN KEY (address_id, organisation_id)
        REFERENCES addresses (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_party_addresses_dates
        CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Business roles and party relationships
-- -----------------------------------------------------------------------------

CREATE TABLE party_role_assignments (
    organisation_id BIGINT UNSIGNED NOT NULL,
    party_id BIGINT UNSIGNED NOT NULL,
    party_role_type_id SMALLINT UNSIGNED NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (organisation_id, party_id, party_role_type_id),
    KEY idx_party_role_assignments_role (organisation_id, party_role_type_id, is_active),

    CONSTRAINT fk_party_role_assignments_party
        FOREIGN KEY (party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_party_role_assignments_type
        FOREIGN KEY (party_role_type_id)
        REFERENCES party_role_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE party_organisation_contacts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    organisation_party_id BIGINT UNSIGNED NOT NULL,
    person_party_id BIGINT UNSIGNED NOT NULL,
    job_title VARCHAR(200) NULL,
    department VARCHAR(200) NULL,
    is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
    started_on DATE NULL,
    ended_on DATE NULL,
    primary_organisation_party_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE WHEN is_primary_contact = TRUE THEN organisation_party_id ELSE NULL END
        ) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_party_organisation_contacts_one_primary (
        organisation_id,
        primary_organisation_party_id
    ),
    KEY idx_party_organisation_contacts_organisation (
        organisation_id,
        organisation_party_id,
        ended_on
    ),
    KEY idx_party_organisation_contacts_person (
        organisation_id,
        person_party_id,
        ended_on
    ),

    CONSTRAINT fk_party_organisation_contacts_organisation_party
        FOREIGN KEY (organisation_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_party_organisation_contacts_person_party
        FOREIGN KEY (person_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_party_organisation_contacts_distinct
        CHECK (organisation_party_id <> person_party_id),
    CONSTRAINT ck_party_organisation_contacts_dates
        CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE party_relationships (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    source_party_id BIGINT UNSIGNED NOT NULL,
    target_party_id BIGINT UNSIGNED NOT NULL,
    party_relationship_type_id SMALLINT UNSIGNED NOT NULL,
    started_on DATE NULL,
    ended_on DATE NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY idx_party_relationships_source (
        organisation_id,
        source_party_id,
        party_relationship_type_id
    ),
    KEY idx_party_relationships_target (
        organisation_id,
        target_party_id,
        party_relationship_type_id
    ),

    CONSTRAINT fk_party_relationships_source
        FOREIGN KEY (source_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_party_relationships_target
        FOREIGN KEY (target_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_party_relationships_type
        FOREIGN KEY (party_relationship_type_id)
        REFERENCES party_relationship_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_party_relationships_distinct
        CHECK (source_party_id <> target_party_id),
    CONSTRAINT ck_party_relationships_dates
        CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Tenant-defined CRM tags
-- -----------------------------------------------------------------------------

CREATE TABLE crm_tags (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(120) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_crm_tags_public_id (public_id),
    UNIQUE KEY uq_crm_tags_id_organisation (id, organisation_id),
    UNIQUE KEY uq_crm_tags_name (organisation_id, name),

    CONSTRAINT fk_crm_tags_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE party_tags (
    organisation_id BIGINT UNSIGNED NOT NULL,
    party_id BIGINT UNSIGNED NOT NULL,
    crm_tag_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (organisation_id, party_id, crm_tag_id),
    KEY idx_party_tags_tag (organisation_id, crm_tag_id, party_id),

    CONSTRAINT fk_party_tags_party
        FOREIGN KEY (party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_party_tags_tag
        FOREIGN KEY (crm_tag_id, organisation_id)
        REFERENCES crm_tags (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- CRM pipelines and opportunities
-- -----------------------------------------------------------------------------

CREATE TABLE crm_pipelines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    default_organisation_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE WHEN is_default = TRUE THEN organisation_id ELSE NULL END
        ) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_crm_pipelines_public_id (public_id),
    UNIQUE KEY uq_crm_pipelines_id_organisation (id, organisation_id),
    UNIQUE KEY uq_crm_pipelines_name (organisation_id, name),
    UNIQUE KEY uq_crm_pipelines_one_default (default_organisation_id),

    CONSTRAINT fk_crm_pipelines_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE crm_pipeline_stages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    crm_pipeline_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(160) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    probability_percent DECIMAL(5,2) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_crm_pipeline_stages_id_context (id, organisation_id, crm_pipeline_id),
    UNIQUE KEY uq_crm_pipeline_stages_name (organisation_id, crm_pipeline_id, name),
    UNIQUE KEY uq_crm_pipeline_stages_sort (organisation_id, crm_pipeline_id, sort_order),

    CONSTRAINT fk_crm_pipeline_stages_pipeline
        FOREIGN KEY (crm_pipeline_id, organisation_id)
        REFERENCES crm_pipelines (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_crm_pipeline_stages_probability
        CHECK (
            probability_percent IS NULL
            OR (probability_percent >= 0.00 AND probability_percent <= 100.00)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE opportunities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    crm_pipeline_id BIGINT UNSIGNED NOT NULL,
    crm_pipeline_stage_id BIGINT UNSIGNED NOT NULL,
    owner_member_id BIGINT UNSIGNED NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    estimated_value DECIMAL(19,4) NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'GBP',
    expected_close_date DATE NULL,
    status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    closed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_opportunities_public_id (public_id),
    UNIQUE KEY uq_opportunities_id_organisation (id, organisation_id),
    KEY idx_opportunities_pipeline_stage (
        organisation_id,
        crm_pipeline_id,
        crm_pipeline_stage_id,
        status
    ),
    KEY idx_opportunities_owner (owner_member_id, organisation_id, status),
    KEY idx_opportunities_expected_close (organisation_id, expected_close_date, status),

    CONSTRAINT fk_opportunities_pipeline
        FOREIGN KEY (crm_pipeline_id, organisation_id)
        REFERENCES crm_pipelines (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_opportunities_stage
        FOREIGN KEY (crm_pipeline_stage_id, organisation_id, crm_pipeline_id)
        REFERENCES crm_pipeline_stages (id, organisation_id, crm_pipeline_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_opportunities_owner
        FOREIGN KEY (owner_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_opportunities_status
        CHECK (status IN ('open', 'won', 'lost', 'cancelled')),
    CONSTRAINT ck_opportunities_value
        CHECK (estimated_value IS NULL OR estimated_value >= 0),
    CONSTRAINT ck_opportunities_closed_at
        CHECK (
            (status = 'open' AND closed_at IS NULL)
            OR status IN ('won', 'lost', 'cancelled')
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE opportunity_parties (
    organisation_id BIGINT UNSIGNED NOT NULL,
    opportunity_id BIGINT UNSIGNED NOT NULL,
    party_id BIGINT UNSIGNED NOT NULL,
    opportunity_party_role_type_id SMALLINT UNSIGNED NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    primary_opportunity_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE WHEN is_primary = TRUE THEN opportunity_id ELSE NULL END
        ) STORED,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (
        organisation_id,
        opportunity_id,
        party_id,
        opportunity_party_role_type_id
    ),
    UNIQUE KEY uq_opportunity_parties_one_primary (
        organisation_id,
        primary_opportunity_id
    ),
    KEY idx_opportunity_parties_party (organisation_id, party_id, opportunity_id),

    CONSTRAINT fk_opportunity_parties_opportunity
        FOREIGN KEY (opportunity_id, organisation_id)
        REFERENCES opportunities (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_opportunity_parties_party
        FOREIGN KEY (party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_opportunity_parties_role
        FOREIGN KEY (opportunity_party_role_type_id)
        REFERENCES opportunity_party_role_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- CRM activities
-- -----------------------------------------------------------------------------

CREATE TABLE crm_activities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    crm_activity_type_id SMALLINT UNSIGNED NOT NULL,
    opportunity_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NULL,
    direction VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
    occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_crm_activities_public_id (public_id),
    UNIQUE KEY uq_crm_activities_id_organisation (id, organisation_id),
    KEY idx_crm_activities_opportunity (opportunity_id, organisation_id, occurred_at),
    KEY idx_crm_activities_creator (created_by_member_id, organisation_id, occurred_at),
    KEY idx_crm_activities_type_date (organisation_id, crm_activity_type_id, occurred_at),

    CONSTRAINT fk_crm_activities_type
        FOREIGN KEY (crm_activity_type_id)
        REFERENCES crm_activity_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_crm_activities_opportunity
        FOREIGN KEY (opportunity_id, organisation_id)
        REFERENCES opportunities (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_crm_activities_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_crm_activities_direction
        CHECK (direction IS NULL OR direction IN ('inbound', 'outbound', 'internal'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE crm_activity_parties (
    organisation_id BIGINT UNSIGNED NOT NULL,
    crm_activity_id BIGINT UNSIGNED NOT NULL,
    party_id BIGINT UNSIGNED NOT NULL,
    participant_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'participant',

    PRIMARY KEY (organisation_id, crm_activity_id, party_id, participant_role),
    KEY idx_crm_activity_parties_party (organisation_id, party_id, crm_activity_id),

    CONSTRAINT fk_crm_activity_parties_activity
        FOREIGN KEY (crm_activity_id, organisation_id)
        REFERENCES crm_activities (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT fk_crm_activity_parties_party
        FOREIGN KEY (party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_crm_activity_parties_role
        CHECK (participant_role IN ('regarding', 'participant', 'sender', 'recipient'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE crm_activity_members (
    organisation_id BIGINT UNSIGNED NOT NULL,
    crm_activity_id BIGINT UNSIGNED NOT NULL,
    organisation_member_id BIGINT UNSIGNED NOT NULL,
    participant_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'participant',

    PRIMARY KEY (
        organisation_id,
        crm_activity_id,
        organisation_member_id,
        participant_role
    ),
    KEY idx_crm_activity_members_member (
        organisation_id,
        organisation_member_id,
        crm_activity_id
    ),

    CONSTRAINT fk_crm_activity_members_activity
        FOREIGN KEY (crm_activity_id, organisation_id)
        REFERENCES crm_activities (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT fk_crm_activity_members_member
        FOREIGN KEY (organisation_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_crm_activity_members_role
        CHECK (participant_role IN ('owner', 'participant', 'organiser'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Initial global reference values
-- -----------------------------------------------------------------------------

INSERT INTO party_role_types (code, name) VALUES
    ('prospect', 'Prospect'),
    ('client', 'Client'),
    ('supplier', 'Supplier'),
    ('subcontractor', 'Subcontractor'),
    ('consultant', 'Consultant'),
    ('developer', 'Developer'),
    ('main_contractor', 'Main contractor'),
    ('authority', 'Authority'),
    ('landlord', 'Landlord'),
    ('tenant', 'Tenant'),
    ('insurer', 'Insurer'),
    ('funder', 'Funder'),
    ('manufacturer', 'Manufacturer'),
    ('merchant', 'Merchant');

INSERT INTO party_identifier_types (code, name) VALUES
    ('company_registration', 'Company registration number'),
    ('vat_registration', 'VAT registration number'),
    ('tax_registration', 'Tax registration number'),
    ('duns', 'D-U-N-S number'),
    ('professional_registration', 'Professional registration identifier'),
    ('other', 'Other controlled identifier');

INSERT INTO party_relationship_types (code, name, inverse_name) VALUES
    ('parent_of', 'Parent of', 'Subsidiary of'),
    ('subsidiary_of', 'Subsidiary of', 'Parent of'),
    ('joint_venture_partner', 'Joint venture partner', 'Joint venture partner'),
    ('trades_as', 'Trades as', 'Trading identity of'),
    ('landlord_of', 'Landlord of', 'Tenant of'),
    ('tenant_of', 'Tenant of', 'Landlord of'),
    ('referred', 'Referred', 'Referred by');

INSERT INTO opportunity_party_role_types (code, name) VALUES
    ('customer', 'Customer / prospective customer'),
    ('contact', 'Contact'),
    ('decision_maker', 'Decision maker'),
    ('consultant', 'Consultant'),
    ('referrer', 'Referrer'),
    ('influencer', 'Influencer'),
    ('other', 'Other participant');

INSERT INTO crm_activity_types (code, name) VALUES
    ('note', 'Note'),
    ('phone_call', 'Phone call'),
    ('email', 'Email'),
    ('meeting', 'Meeting'),
    ('site_visit', 'Site visit'),
    ('follow_up', 'Follow-up'),
    ('other', 'Other activity');
