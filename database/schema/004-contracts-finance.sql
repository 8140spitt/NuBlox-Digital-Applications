-- NuBlox: Digital Applications
-- Schema package 004: Contracts and Finance
-- Depends on: 001-platform-kernel.sql, 001a-platform-kernel-integrity.sql,
--             002-crm-parties.sql, 003-sales-quotes.sql
-- Target: MySQL 8.4 / InnoDB
-- Design target: 3NF by default
-- Generated: 2026-08-15
--
-- SCOPE:
-- - client contracts / appointments and controlled amendments
-- - operational accounts receivable: invoices, credit notes, payments and allocations
-- - no statutory general ledger, payroll or bank-reconciliation engine

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
-- Global controlled reference data
-- -----------------------------------------------------------------------------

CREATE TABLE contract_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_party_role_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_party_role_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_value_component_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_value_component_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_key_date_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_key_date_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_amendment_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_amendment_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE payment_methods (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_methods_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Tenant billing configuration
-- -----------------------------------------------------------------------------

CREATE TABLE payment_terms (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    calculation_basis VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    days_offset SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    default_organisation_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE WHEN is_default = TRUE THEN organisation_id ELSE NULL END
        ) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_terms_public_id (public_id),
    UNIQUE KEY uq_payment_terms_id_organisation (id, organisation_id),
    UNIQUE KEY uq_payment_terms_name (organisation_id, name),
    UNIQUE KEY uq_payment_terms_one_default (default_organisation_id),

    CONSTRAINT fk_payment_terms_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_payment_terms_basis
        CHECK (calculation_basis IN ('invoice_date', 'end_of_month', 'manual'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE party_billing_settings (
    party_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    default_payment_term_id BIGINT UNSIGNED NULL,
    default_currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
    customer_account_reference VARCHAR(120) NULL,
    purchase_order_required BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (party_id),
    UNIQUE KEY uq_party_billing_settings_context (party_id, organisation_id),
    KEY idx_party_billing_settings_term (default_payment_term_id, organisation_id),

    CONSTRAINT fk_party_billing_settings_party
        FOREIGN KEY (party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_party_billing_settings_term
        FOREIGN KEY (default_payment_term_id, organisation_id)
        REFERENCES payment_terms (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Contracts / appointments
-- -----------------------------------------------------------------------------

CREATE TABLE contracts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    contract_number VARCHAR(80) NOT NULL,
    contract_type_id SMALLINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    opportunity_id BIGINT UNSIGNED NULL,
    source_quotation_response_id BIGINT UNSIGNED NULL,
    owner_member_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    lifecycle_status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    started_on DATE NULL,
    ended_on DATE NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_contracts_public_id (public_id),
    UNIQUE KEY uq_contracts_number (organisation_id, contract_number),
    UNIQUE KEY uq_contracts_id_organisation (id, organisation_id),
    KEY idx_contracts_project (project_id, organisation_id),
    KEY idx_contracts_opportunity (opportunity_id, organisation_id),
    KEY idx_contracts_source_quote (source_quotation_response_id, organisation_id),
    KEY idx_contracts_owner (owner_member_id, organisation_id),
    KEY idx_contracts_status (organisation_id, lifecycle_status),

    CONSTRAINT fk_contracts_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contracts_type
        FOREIGN KEY (contract_type_id)
        REFERENCES contract_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contracts_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contracts_opportunity
        FOREIGN KEY (opportunity_id, organisation_id)
        REFERENCES opportunities (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contracts_source_quote_response
        FOREIGN KEY (source_quotation_response_id, organisation_id)
        REFERENCES quotation_responses (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contracts_owner
        FOREIGN KEY (owner_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_contracts_lifecycle
        CHECK (lifecycle_status IN (
            'draft', 'under_review', 'active', 'completed',
            'expired', 'terminated', 'cancelled', 'archived'
        )),
    CONSTRAINT ck_contracts_dates
        CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    contract_id BIGINT UNSIGNED NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    customer_reference VARCHAR(160) NULL,
    version_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    locked_by_member_id BIGINT UNSIGNED NULL,
    locked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_versions_number (organisation_id, contract_id, version_number),
    UNIQUE KEY uq_contract_versions_id_organisation (id, organisation_id),
    UNIQUE KEY uq_contract_versions_id_context (id, organisation_id, contract_id),
    KEY idx_contract_versions_status (organisation_id, contract_id, version_status),
    KEY idx_contract_versions_creator (created_by_member_id, organisation_id),
    KEY idx_contract_versions_locker (locked_by_member_id, organisation_id),

    CONSTRAINT fk_contract_versions_contract
        FOREIGN KEY (contract_id, organisation_id)
        REFERENCES contracts (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_versions_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_versions_locker
        FOREIGN KEY (locked_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_contract_versions_number
        CHECK (version_number > 0),
    CONSTRAINT ck_contract_versions_status
        CHECK (version_status IN ('draft', 'issued', 'executed', 'superseded', 'withdrawn')),
    CONSTRAINT ck_contract_versions_lock
        CHECK (
            (version_status = 'draft' AND locked_at IS NULL AND locked_by_member_id IS NULL)
            OR
            (version_status IN ('issued', 'executed', 'superseded', 'withdrawn')
             AND locked_at IS NOT NULL AND locked_by_member_id IS NOT NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_version_parties (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    contract_version_id BIGINT UNSIGNED NOT NULL,
    source_party_id BIGINT UNSIGNED NOT NULL,
    contract_party_role_type_id SMALLINT UNSIGNED NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    reference_identifier VARCHAR(200) NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_version_parties_id_context (
        id,
        organisation_id,
        contract_version_id
    ),
    UNIQUE KEY uq_contract_version_parties_role_party (
        organisation_id,
        contract_version_id,
        contract_party_role_type_id,
        source_party_id
    ),
    UNIQUE KEY uq_contract_version_parties_sort (
        organisation_id,
        contract_version_id,
        sort_order
    ),
    KEY idx_contract_version_parties_source (source_party_id, organisation_id),

    CONSTRAINT fk_contract_version_parties_version
        FOREIGN KEY (contract_version_id, organisation_id)
        REFERENCES contract_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_version_parties_source
        FOREIGN KEY (source_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_version_parties_role
        FOREIGN KEY (contract_party_role_type_id)
        REFERENCES contract_party_role_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_version_party_addresses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    contract_version_party_id BIGINT UNSIGNED NOT NULL,
    contract_version_id BIGINT UNSIGNED NOT NULL,
    address_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'business',
    line_1 VARCHAR(255) NOT NULL,
    line_2 VARCHAR(255) NULL,
    line_3 VARCHAR(255) NULL,
    locality VARCHAR(160) NULL,
    city VARCHAR(160) NULL,
    region VARCHAR(160) NULL,
    postal_code VARCHAR(32) NULL,
    country_code CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_version_party_addresses_role (
        organisation_id,
        contract_version_party_id,
        address_role
    ),

    CONSTRAINT fk_contract_version_party_addresses_party
        FOREIGN KEY (
            contract_version_party_id,
            organisation_id,
            contract_version_id
        )
        REFERENCES contract_version_parties (
            id,
            organisation_id,
            contract_version_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_version_value_components (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    contract_version_id BIGINT UNSIGNED NOT NULL,
    contract_value_component_type_id SMALLINT UNSIGNED NOT NULL,
    description VARCHAR(500) NULL,
    amount DECIMAL(19,4) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_version_values_sort (
        organisation_id,
        contract_version_id,
        sort_order
    ),
    KEY idx_contract_version_values_type (
        organisation_id,
        contract_version_id,
        contract_value_component_type_id
    ),

    CONSTRAINT fk_contract_version_values_version
        FOREIGN KEY (contract_version_id, organisation_id)
        REFERENCES contract_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_version_values_type
        FOREIGN KEY (contract_value_component_type_id)
        REFERENCES contract_value_component_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_contract_version_values_amount
        CHECK (amount >= 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_version_key_dates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    contract_version_id BIGINT UNSIGNED NOT NULL,
    contract_key_date_type_id SMALLINT UNSIGNED NOT NULL,
    label VARCHAR(200) NULL,
    date_value DATE NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_version_key_dates_id_organisation (id, organisation_id),
    UNIQUE KEY uq_contract_version_key_dates_sort (
        organisation_id,
        contract_version_id,
        sort_order
    ),
    KEY idx_contract_version_key_dates_type (
        organisation_id,
        contract_version_id,
        contract_key_date_type_id
    ),

    CONSTRAINT fk_contract_version_key_dates_version
        FOREIGN KEY (contract_version_id, organisation_id)
        REFERENCES contract_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_version_key_dates_type
        FOREIGN KEY (contract_key_date_type_id)
        REFERENCES contract_key_date_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_issue_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    contract_version_id BIGINT UNSIGNED NOT NULL,
    issue_sequence INT UNSIGNED NOT NULL,
    issued_by_member_id BIGINT UNSIGNED NOT NULL,
    delivery_channel VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    issued_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    note VARCHAR(1000) NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_issue_events_id_context (
        id,
        organisation_id,
        contract_version_id
    ),
    UNIQUE KEY uq_contract_issue_events_sequence (
        organisation_id,
        contract_version_id,
        issue_sequence
    ),

    CONSTRAINT fk_contract_issue_events_version
        FOREIGN KEY (contract_version_id, organisation_id)
        REFERENCES contract_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_issue_events_member
        FOREIGN KEY (issued_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_contract_issue_events_sequence
        CHECK (issue_sequence > 0),
    CONSTRAINT ck_contract_issue_events_channel
        CHECK (delivery_channel IN ('email', 'portal', 'manual', 'api', 'esign', 'other'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_issue_recipients (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    contract_issue_event_id BIGINT UNSIGNED NOT NULL,
    contract_version_id BIGINT UNSIGNED NOT NULL,
    source_party_id BIGINT UNSIGNED NULL,
    recipient_name VARCHAR(255) NULL,
    recipient_email VARCHAR(320) NULL,
    delivery_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    delivered_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY idx_contract_issue_recipients_issue (
        organisation_id,
        contract_issue_event_id
    ),

    CONSTRAINT fk_contract_issue_recipients_issue
        FOREIGN KEY (
            contract_issue_event_id,
            organisation_id,
            contract_version_id
        )
        REFERENCES contract_issue_events (
            id,
            organisation_id,
            contract_version_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_issue_recipients_party
        FOREIGN KEY (source_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_contract_issue_recipients_identity
        CHECK (
            source_party_id IS NOT NULL
            OR recipient_name IS NOT NULL
            OR recipient_email IS NOT NULL
        ),
    CONSTRAINT ck_contract_issue_recipients_status
        CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'acknowledged')),
    CONSTRAINT ck_contract_issue_recipients_delivered
        CHECK (delivered_at IS NULL OR delivery_status IN ('delivered', 'acknowledged'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_execution_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    contract_version_id BIGINT UNSIGNED NOT NULL,
    execution_method VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    executed_at DATETIME(6) NOT NULL,
    recorded_by_member_id BIGINT UNSIGNED NOT NULL,
    external_transaction_reference VARCHAR(255) NULL,
    note VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_execution_events_version (
        organisation_id,
        contract_version_id
    ),
    UNIQUE KEY uq_contract_execution_events_id_context (
        id,
        organisation_id,
        contract_version_id
    ),

    CONSTRAINT fk_contract_execution_events_version
        FOREIGN KEY (contract_version_id, organisation_id)
        REFERENCES contract_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_execution_events_recorder
        FOREIGN KEY (recorded_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_contract_execution_events_method
        CHECK (execution_method IN ('manual', 'portal', 'esign', 'api', 'other'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_execution_signatories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    contract_execution_event_id BIGINT UNSIGNED NOT NULL,
    contract_version_id BIGINT UNSIGNED NOT NULL,
    source_party_id BIGINT UNSIGNED NULL,
    signatory_name VARCHAR(255) NOT NULL,
    signatory_email VARCHAR(320) NULL,
    signing_role VARCHAR(160) NULL,
    signed_at DATETIME(6) NULL,
    external_signature_reference VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY idx_contract_execution_signatories_event (
        organisation_id,
        contract_execution_event_id
    ),

    CONSTRAINT fk_contract_execution_signatories_event
        FOREIGN KEY (
            contract_execution_event_id,
            organisation_id,
            contract_version_id
        )
        REFERENCES contract_execution_events (
            id,
            organisation_id,
            contract_version_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_execution_signatories_party
        FOREIGN KEY (source_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Controlled contract amendments
-- -----------------------------------------------------------------------------

CREATE TABLE contract_amendments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    contract_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    amendment_number VARCHAR(80) NOT NULL,
    contract_amendment_type_id SMALLINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    effective_on DATE NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    issued_by_member_id BIGINT UNSIGNED NULL,
    issued_at DATETIME(6) NULL,
    decided_by_member_id BIGINT UNSIGNED NULL,
    decided_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_amendments_public_id (public_id),
    UNIQUE KEY uq_contract_amendments_number (organisation_id, contract_id, amendment_number),
    UNIQUE KEY uq_contract_amendments_id_organisation (id, organisation_id),
    KEY idx_contract_amendments_status (organisation_id, contract_id, lifecycle_status),

    CONSTRAINT fk_contract_amendments_contract
        FOREIGN KEY (contract_id, organisation_id)
        REFERENCES contracts (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_amendments_type
        FOREIGN KEY (contract_amendment_type_id)
        REFERENCES contract_amendment_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_amendments_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_amendments_issuer
        FOREIGN KEY (issued_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_amendments_decider
        FOREIGN KEY (decided_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_contract_amendments_status
        CHECK (lifecycle_status IN ('draft', 'issued', 'agreed', 'rejected', 'withdrawn')),
    CONSTRAINT ck_contract_amendments_issue_evidence
        CHECK (
            (lifecycle_status = 'draft' AND issued_at IS NULL AND issued_by_member_id IS NULL)
            OR
            (lifecycle_status IN ('issued', 'agreed', 'rejected')
             AND issued_at IS NOT NULL AND issued_by_member_id IS NOT NULL)
            OR lifecycle_status = 'withdrawn'
        ),
    CONSTRAINT ck_contract_amendments_decision_evidence
        CHECK (
            (lifecycle_status IN ('agreed', 'rejected')
             AND decided_at IS NOT NULL AND decided_by_member_id IS NOT NULL)
            OR lifecycle_status IN ('draft', 'issued', 'withdrawn')
        ),
    CONSTRAINT ck_contract_amendments_effective
        CHECK (lifecycle_status <> 'agreed' OR effective_on IS NOT NULL)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_amendment_value_adjustments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    contract_amendment_id BIGINT UNSIGNED NOT NULL,
    contract_value_component_type_id SMALLINT UNSIGNED NOT NULL,
    description VARCHAR(500) NULL,
    adjustment_amount DECIMAL(19,4) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_amendment_values_sort (
        organisation_id,
        contract_amendment_id,
        sort_order
    ),

    CONSTRAINT fk_contract_amendment_values_amendment
        FOREIGN KEY (contract_amendment_id, organisation_id)
        REFERENCES contract_amendments (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_amendment_values_type
        FOREIGN KEY (contract_value_component_type_id)
        REFERENCES contract_value_component_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_contract_amendment_values_nonzero
        CHECK (adjustment_amount <> 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_amendment_key_date_changes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    contract_amendment_id BIGINT UNSIGNED NOT NULL,
    contract_key_date_type_id SMALLINT UNSIGNED NOT NULL,
    label VARCHAR(200) NULL,
    new_date DATE NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_amendment_dates_sort (
        organisation_id,
        contract_amendment_id,
        sort_order
    ),
    KEY idx_contract_amendment_dates_type (
        organisation_id,
        contract_amendment_id,
        contract_key_date_type_id
    ),

    CONSTRAINT fk_contract_amendment_dates_amendment
        FOREIGN KEY (contract_amendment_id, organisation_id)
        REFERENCES contract_amendments (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_contract_amendment_dates_type
        FOREIGN KEY (contract_key_date_type_id)
        REFERENCES contract_key_date_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Financial-document supertype and subtypes
-- -----------------------------------------------------------------------------

CREATE TABLE financial_documents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    document_kind VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    document_number VARCHAR(80) NULL,
    customer_party_id BIGINT UNSIGNED NOT NULL,
    billing_contact_party_id BIGINT UNSIGNED NULL,
    project_id BIGINT UNSIGNED NULL,
    contract_id BIGINT UNSIGNED NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    voided_by_member_id BIGINT UNSIGNED NULL,
    voided_at DATETIME(6) NULL,
    void_reason VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_financial_documents_public_id (public_id),
    UNIQUE KEY uq_financial_documents_number (
        organisation_id,
        document_kind,
        document_number
    ),
    UNIQUE KEY uq_financial_documents_id_organisation (id, organisation_id),
    KEY idx_financial_documents_customer (
        customer_party_id,
        organisation_id,
        lifecycle_status
    ),
    KEY idx_financial_documents_project (
        project_id,
        organisation_id,
        lifecycle_status
    ),
    KEY idx_financial_documents_contract (
        contract_id,
        organisation_id,
        lifecycle_status
    ),

    CONSTRAINT fk_financial_documents_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_financial_documents_customer
        FOREIGN KEY (customer_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_financial_documents_billing_contact
        FOREIGN KEY (billing_contact_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_financial_documents_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_financial_documents_contract
        FOREIGN KEY (contract_id, organisation_id)
        REFERENCES contracts (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_financial_documents_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_financial_documents_voider
        FOREIGN KEY (voided_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_financial_documents_kind
        CHECK (document_kind IN ('invoice', 'credit_note')),
    CONSTRAINT ck_financial_documents_status
        CHECK (lifecycle_status IN ('draft', 'issued', 'void')),
    CONSTRAINT ck_financial_documents_number_required
        CHECK (lifecycle_status = 'draft' OR document_number IS NOT NULL),
    CONSTRAINT ck_financial_documents_void_evidence
        CHECK (
            (lifecycle_status <> 'void'
             AND voided_at IS NULL
             AND voided_by_member_id IS NULL
             AND void_reason IS NULL)
            OR
            (lifecycle_status = 'void'
             AND voided_at IS NOT NULL
             AND voided_by_member_id IS NOT NULL
             AND void_reason IS NOT NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE invoices (
    financial_document_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    payment_term_id BIGINT UNSIGNED NULL,
    invoice_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'standard',
    due_date DATE NULL,
    customer_purchase_order_reference VARCHAR(160) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (financial_document_id),
    UNIQUE KEY uq_invoices_document_organisation (financial_document_id, organisation_id),
    KEY idx_invoices_payment_term (payment_term_id, organisation_id),
    KEY idx_invoices_due_date (organisation_id, due_date),

    CONSTRAINT fk_invoices_document
        FOREIGN KEY (financial_document_id, organisation_id)
        REFERENCES financial_documents (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_invoices_payment_term
        FOREIGN KEY (payment_term_id, organisation_id)
        REFERENCES payment_terms (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_invoices_type
        CHECK (invoice_type IN (
            'standard', 'deposit', 'interim', 'final', 'retention', 'other'
        ))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE credit_notes (
    financial_document_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    original_invoice_document_id BIGINT UNSIGNED NOT NULL,
    reason TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (financial_document_id),
    UNIQUE KEY uq_credit_notes_document_organisation (
        financial_document_id,
        organisation_id
    ),
    UNIQUE KEY uq_credit_notes_document_original (
        financial_document_id,
        organisation_id,
        original_invoice_document_id
    ),
    KEY idx_credit_notes_original_invoice (
        original_invoice_document_id,
        organisation_id
    ),

    CONSTRAINT fk_credit_notes_document
        FOREIGN KEY (financial_document_id, organisation_id)
        REFERENCES financial_documents (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_credit_notes_original_invoice
        FOREIGN KEY (original_invoice_document_id, organisation_id)
        REFERENCES invoices (financial_document_id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_credit_notes_distinct_document
        CHECK (financial_document_id <> original_invoice_document_id)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Financial-document line items and tax snapshots
-- -----------------------------------------------------------------------------

CREATE TABLE financial_document_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    financial_document_id BIGINT UNSIGNED NOT NULL,
    source_quotation_item_id BIGINT UNSIGNED NULL,
    sales_item_type_id SMALLINT UNSIGNED NOT NULL,
    sales_catalog_item_id BIGINT UNSIGNED NULL,
    unit_of_measure_id SMALLINT UNSIGNED NULL,
    line_number INT UNSIGNED NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(19,6) NOT NULL,
    unit_rate DECIMAL(19,4) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_financial_document_items_id_organisation (id, organisation_id),
    UNIQUE KEY uq_financial_document_items_id_context (
        id,
        organisation_id,
        financial_document_id
    ),
    UNIQUE KEY uq_financial_document_items_line (
        organisation_id,
        financial_document_id,
        line_number
    ),
    KEY idx_financial_document_items_quote (source_quotation_item_id, organisation_id),
    KEY idx_financial_document_items_catalog (sales_catalog_item_id, organisation_id),

    CONSTRAINT fk_financial_document_items_document
        FOREIGN KEY (financial_document_id, organisation_id)
        REFERENCES financial_documents (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_financial_document_items_quote_item
        FOREIGN KEY (source_quotation_item_id, organisation_id)
        REFERENCES quotation_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_financial_document_items_type
        FOREIGN KEY (sales_item_type_id)
        REFERENCES sales_item_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_financial_document_items_catalog
        FOREIGN KEY (sales_catalog_item_id, organisation_id)
        REFERENCES sales_catalog_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_financial_document_items_unit
        FOREIGN KEY (unit_of_measure_id)
        REFERENCES units_of_measure (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_financial_document_items_line_number
        CHECK (line_number > 0),
    CONSTRAINT ck_financial_document_items_quantity
        CHECK (quantity > 0),
    CONSTRAINT ck_financial_document_items_rate
        CHECK (unit_rate >= 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE financial_document_item_taxes (
    organisation_id BIGINT UNSIGNED NOT NULL,
    financial_document_item_id BIGINT UNSIGNED NOT NULL,
    tax_category_id BIGINT UNSIGNED NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    applied_rate_percent DECIMAL(9,4) NOT NULL,
    taxable_amount DECIMAL(19,4) NOT NULL,
    tax_amount DECIMAL(19,4) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (
        organisation_id,
        financial_document_item_id,
        tax_category_id
    ),
    UNIQUE KEY uq_financial_document_item_taxes_sort (
        organisation_id,
        financial_document_item_id,
        sort_order
    ),

    CONSTRAINT fk_financial_document_item_taxes_item
        FOREIGN KEY (financial_document_item_id, organisation_id)
        REFERENCES financial_document_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_financial_document_item_taxes_category
        FOREIGN KEY (tax_category_id, organisation_id)
        REFERENCES tax_categories (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_financial_document_item_taxes_rate
        CHECK (applied_rate_percent >= 0.0000 AND applied_rate_percent <= 100.0000),
    CONSTRAINT ck_financial_document_item_taxes_amounts
        CHECK (taxable_amount >= 0 AND tax_amount >= 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE credit_note_item_sources (
    organisation_id BIGINT UNSIGNED NOT NULL,
    credit_note_document_id BIGINT UNSIGNED NOT NULL,
    credit_note_item_id BIGINT UNSIGNED NOT NULL,
    original_invoice_document_id BIGINT UNSIGNED NOT NULL,
    original_invoice_item_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (organisation_id, credit_note_item_id),
    KEY idx_credit_note_item_sources_original (
        organisation_id,
        original_invoice_document_id,
        original_invoice_item_id
    ),

    CONSTRAINT fk_credit_note_item_sources_credit_note
        FOREIGN KEY (
            credit_note_document_id,
            organisation_id,
            original_invoice_document_id
        )
        REFERENCES credit_notes (
            financial_document_id,
            organisation_id,
            original_invoice_document_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_credit_note_item_sources_credit_item
        FOREIGN KEY (
            credit_note_item_id,
            organisation_id,
            credit_note_document_id
        )
        REFERENCES financial_document_items (
            id,
            organisation_id,
            financial_document_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_credit_note_item_sources_invoice
        FOREIGN KEY (original_invoice_document_id, organisation_id)
        REFERENCES invoices (financial_document_id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_credit_note_item_sources_invoice_item
        FOREIGN KEY (
            original_invoice_item_id,
            organisation_id,
            original_invoice_document_id
        )
        REFERENCES financial_document_items (
            id,
            organisation_id,
            financial_document_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_credit_note_item_sources_distinct
        CHECK (credit_note_item_id <> original_invoice_item_id)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Issue-time party/address snapshots
-- -----------------------------------------------------------------------------

CREATE TABLE financial_document_party_snapshots (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    financial_document_id BIGINT UNSIGNED NOT NULL,
    source_party_id BIGINT UNSIGNED NULL,
    snapshot_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(320) NULL,
    phone VARCHAR(64) NULL,
    reference_identifier VARCHAR(200) NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_financial_document_party_snapshots_id_context (
        id,
        organisation_id,
        financial_document_id
    ),
    UNIQUE KEY uq_financial_document_party_snapshots_order (
        organisation_id,
        financial_document_id,
        snapshot_role,
        sort_order
    ),
    KEY idx_financial_document_party_snapshots_source (source_party_id, organisation_id),

    CONSTRAINT fk_financial_document_party_snapshots_document
        FOREIGN KEY (financial_document_id, organisation_id)
        REFERENCES financial_documents (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_financial_document_party_snapshots_source
        FOREIGN KEY (source_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_financial_document_party_snapshots_role
        CHECK (snapshot_role IN ('customer', 'billing', 'contact', 'attention', 'other'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE financial_document_party_snapshot_addresses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    financial_document_party_snapshot_id BIGINT UNSIGNED NOT NULL,
    financial_document_id BIGINT UNSIGNED NOT NULL,
    address_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'billing',
    line_1 VARCHAR(255) NOT NULL,
    line_2 VARCHAR(255) NULL,
    line_3 VARCHAR(255) NULL,
    locality VARCHAR(160) NULL,
    city VARCHAR(160) NULL,
    region VARCHAR(160) NULL,
    postal_code VARCHAR(32) NULL,
    country_code CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_financial_document_snapshot_addresses_role (
        organisation_id,
        financial_document_party_snapshot_id,
        address_role
    ),

    CONSTRAINT fk_financial_document_snapshot_addresses_snapshot
        FOREIGN KEY (
            financial_document_party_snapshot_id,
            organisation_id,
            financial_document_id
        )
        REFERENCES financial_document_party_snapshots (
            id,
            organisation_id,
            financial_document_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Financial document issue events / recipients
-- -----------------------------------------------------------------------------

CREATE TABLE financial_document_issue_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    financial_document_id BIGINT UNSIGNED NOT NULL,
    issue_sequence INT UNSIGNED NOT NULL,
    issued_by_member_id BIGINT UNSIGNED NOT NULL,
    delivery_channel VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    issued_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    note VARCHAR(1000) NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_financial_document_issue_events_id_context (
        id,
        organisation_id,
        financial_document_id
    ),
    UNIQUE KEY uq_financial_document_issue_events_sequence (
        organisation_id,
        financial_document_id,
        issue_sequence
    ),

    CONSTRAINT fk_financial_document_issue_events_document
        FOREIGN KEY (financial_document_id, organisation_id)
        REFERENCES financial_documents (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_financial_document_issue_events_member
        FOREIGN KEY (issued_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_financial_document_issue_events_sequence
        CHECK (issue_sequence > 0),
    CONSTRAINT ck_financial_document_issue_events_channel
        CHECK (delivery_channel IN ('email', 'portal', 'manual', 'api', 'other'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE financial_document_issue_recipients (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    financial_document_issue_event_id BIGINT UNSIGNED NOT NULL,
    financial_document_id BIGINT UNSIGNED NOT NULL,
    source_party_id BIGINT UNSIGNED NULL,
    recipient_name VARCHAR(255) NULL,
    recipient_email VARCHAR(320) NULL,
    delivery_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    delivered_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY idx_financial_document_issue_recipients_issue (
        organisation_id,
        financial_document_issue_event_id
    ),

    CONSTRAINT fk_financial_document_issue_recipients_issue
        FOREIGN KEY (
            financial_document_issue_event_id,
            organisation_id,
            financial_document_id
        )
        REFERENCES financial_document_issue_events (
            id,
            organisation_id,
            financial_document_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_financial_document_issue_recipients_party
        FOREIGN KEY (source_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_financial_document_issue_recipients_identity
        CHECK (
            source_party_id IS NOT NULL
            OR recipient_name IS NOT NULL
            OR recipient_email IS NOT NULL
        ),
    CONSTRAINT ck_financial_document_issue_recipients_status
        CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'acknowledged')),
    CONSTRAINT ck_financial_document_issue_recipients_delivered
        CHECK (delivered_at IS NULL OR delivery_status IN ('delivered', 'acknowledged'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Payments, allocations and reversals
-- -----------------------------------------------------------------------------

CREATE TABLE payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payer_party_id BIGINT UNSIGNED NULL,
    payment_method_id SMALLINT UNSIGNED NOT NULL,
    received_at DATETIME(6) NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payment_reference VARCHAR(255) NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_payments_public_id (public_id),
    UNIQUE KEY uq_payments_id_organisation (id, organisation_id),
    KEY idx_payments_payer (payer_party_id, organisation_id, received_at),
    KEY idx_payments_received (organisation_id, received_at),

    CONSTRAINT fk_payments_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_payments_payer
        FOREIGN KEY (payer_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_payments_method
        FOREIGN KEY (payment_method_id)
        REFERENCES payment_methods (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_payments_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_payments_amount
        CHECK (amount > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE payment_allocations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    payment_id BIGINT UNSIGNED NOT NULL,
    invoice_document_id BIGINT UNSIGNED NOT NULL,
    allocated_amount DECIMAL(19,4) NOT NULL,
    allocated_by_member_id BIGINT UNSIGNED NOT NULL,
    allocated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_allocations_id_organisation (id, organisation_id),
    KEY idx_payment_allocations_payment (payment_id, organisation_id),
    KEY idx_payment_allocations_invoice (invoice_document_id, organisation_id),

    CONSTRAINT fk_payment_allocations_payment
        FOREIGN KEY (payment_id, organisation_id)
        REFERENCES payments (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_payment_allocations_invoice
        FOREIGN KEY (invoice_document_id, organisation_id)
        REFERENCES invoices (financial_document_id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_payment_allocations_member
        FOREIGN KEY (allocated_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_payment_allocations_amount
        CHECK (allocated_amount > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE payment_allocation_reversals (
    payment_allocation_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,

    PRIMARY KEY (payment_allocation_id),
    UNIQUE KEY uq_payment_allocation_reversals_context (
        payment_allocation_id,
        organisation_id
    ),

    CONSTRAINT fk_payment_allocation_reversals_allocation
        FOREIGN KEY (payment_allocation_id, organisation_id)
        REFERENCES payment_allocations (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_payment_allocation_reversals_member
        FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE payment_reversals (
    payment_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reason VARCHAR(1000) NOT NULL,

    PRIMARY KEY (payment_id),
    UNIQUE KEY uq_payment_reversals_context (payment_id, organisation_id),

    CONSTRAINT fk_payment_reversals_payment
        FOREIGN KEY (payment_id, organisation_id)
        REFERENCES payments (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_payment_reversals_member
        FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Initial controlled reference values
-- -----------------------------------------------------------------------------

INSERT INTO contract_types (code, name) VALUES
    ('professional_appointment', 'Professional appointment'),
    ('consultancy_agreement', 'Consultancy agreement'),
    ('construction_contract', 'Construction contract'),
    ('subcontract', 'Subcontract'),
    ('framework_agreement', 'Framework agreement'),
    ('service_agreement', 'Service agreement'),
    ('maintenance_contract', 'Maintenance contract'),
    ('other', 'Other contract / appointment');

INSERT INTO contract_party_role_types (code, name) VALUES
    ('client', 'Client'),
    ('employer', 'Employer'),
    ('contractor', 'Contractor'),
    ('subcontractor', 'Subcontractor'),
    ('consultant', 'Consultant'),
    ('supplier', 'Supplier'),
    ('payer', 'Payer'),
    ('payee', 'Payee'),
    ('guarantor', 'Guarantor'),
    ('funder', 'Funder'),
    ('insurer', 'Insurer'),
    ('other', 'Other party');

INSERT INTO contract_value_component_types (code, name) VALUES
    ('base_scope', 'Base scope value'),
    ('professional_fee', 'Professional fee'),
    ('provisional_sum', 'Provisional sum'),
    ('allowance', 'Allowance'),
    ('contingency', 'Contingency'),
    ('other', 'Other value component');

INSERT INTO contract_key_date_types (code, name) VALUES
    ('commencement', 'Commencement'),
    ('completion', 'Completion'),
    ('practical_completion', 'Practical completion'),
    ('defects_end', 'Defects / rectification period end'),
    ('service_start', 'Service start'),
    ('service_end', 'Service end'),
    ('renewal', 'Renewal'),
    ('break', 'Break date'),
    ('other', 'Other key date');

INSERT INTO contract_amendment_types (code, name) VALUES
    ('scope_change', 'Scope change'),
    ('value_change', 'Value / fee change'),
    ('date_change', 'Date / programme change'),
    ('terms_change', 'Terms change'),
    ('extension', 'Extension'),
    ('other', 'Other amendment');

INSERT INTO payment_methods (code, name) VALUES
    ('bank_transfer', 'Bank transfer'),
    ('card', 'Card'),
    ('cash', 'Cash'),
    ('cheque', 'Cheque'),
    ('direct_debit', 'Direct debit'),
    ('standing_order', 'Standing order'),
    ('other', 'Other payment method');

-- -----------------------------------------------------------------------------
-- Required application/domain invariants not completely expressible as simple FKs
-- -----------------------------------------------------------------------------
--
-- 1. contracts.source_quotation_response_id, when present, must identify an
--    accepted quotation response.
-- 2. A contract version marked executed requires one contract_execution_events row.
-- 3. Issued/executed/superseded/withdrawn contract versions are immutable through
--    ordinary write APIs. Contract amendments are used for post-execution change.
-- 4. Only the contract policy's valid current executed baseline may drive derived
--    current contract value/key dates.
-- 5. Issued/agreed/rejected/withdrawn amendments are immutable. Corrections use a
--    replacement amendment rather than history edits.
-- 6. financial_documents.document_kind must match exactly one subtype row:
--       invoice     -> invoices
--       credit_note -> credit_notes
--    This subtype exclusivity must be tested by integration tests.
-- 7. The first financial-document issue operation must atomically allocate the
--    document number, validate line/tax arithmetic, create party/address snapshots,
--    move lifecycle_status to issued, create issue events/recipients and emit audit/outbox.
-- 8. Issued/void financial documents, lines, taxes and issue-time snapshots are
--    immutable through normal write APIs.
-- 9. Invoice/credit-note authoritative totals are decimal sums of line/tax snapshots;
--    they must not be recomputed from mutable catalogue or current tax tables.
-- 10. A credit note must match the original invoice customer, currency and permitted
--     project/contract context unless a specifically approved correction policy exists.
-- 11. credit_note_item_sources must link only credit-note items to items on the
--     referenced original invoice. The composite FKs enforce document membership;
--     subtype/document-kind checks remain application invariants.
-- 12. Credit quantities/amounts must not exceed the amount permitted to be credited
--     from the original invoice after prior active credit notes.
-- 13. Invoice due_date must satisfy the selected payment-term/manual policy before issue.
-- 14. Payment currency must match allocated invoice currency until an explicit FX
--     allocation workflow is introduced.
-- 15. Sum of non-reversed payment allocations must not exceed the usable payment amount.
-- 16. An allocation must not exceed permitted invoice outstanding balance unless an
--     explicit over-allocation policy is introduced.
-- 17. A payment reversal requires all active allocations to be reversed in the same
--     controlled transaction first.
-- 18. Payment and allocation reversals are immutable correction events.
-- 19. Derived invoice status (unpaid/part-paid/paid/overdue) comes from immutable
--     invoice totals, credit notes, active payment allocations and due date. It is not
--     maintained as a separately editable status column.
-- 20. All issue, execution, agreement/rejection, void, allocation and reversal actions
--     require permission checks and audit events.
