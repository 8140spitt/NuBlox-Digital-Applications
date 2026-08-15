-- NuBlox: Digital Applications
-- Schema package 005: Procurement
-- Depends on: 001-platform-kernel.sql, 002-crm-parties.sql,
--             003-sales-quotes.sql, 004-contracts-finance.sql
-- Target: MySQL 8.4 / InnoDB
-- Design target: 3NF by default
-- Generated: 2026-08-15
--
-- SCOPE:
-- - procurement packages and package items
-- - RFQs, versions, issue events and supplier invitations
-- - supplier returns, evaluation/comparison and awards
-- - purchase orders, immutable issued versions and tax snapshots
-- - goods/service receipts
-- - commitment values remain derived from authoritative PO/version facts

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
-- Global controlled reference data
-- -----------------------------------------------------------------------------

CREATE TABLE procurement_package_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_procurement_package_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE purchase_order_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_purchase_order_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Procurement packages
-- -----------------------------------------------------------------------------

CREATE TABLE procurement_packages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    package_number VARCHAR(80) NOT NULL,
    procurement_package_type_id SMALLINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    owner_member_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'GBP',
    lifecycle_status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    required_by_date DATE NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_procurement_packages_public_id (public_id),
    UNIQUE KEY uq_procurement_packages_number (organisation_id, package_number),
    UNIQUE KEY uq_procurement_packages_id_organisation (id, organisation_id),
    KEY idx_procurement_packages_project (project_id, organisation_id, lifecycle_status),
    KEY idx_procurement_packages_owner (owner_member_id, organisation_id, lifecycle_status),

    CONSTRAINT fk_procurement_packages_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_procurement_packages_type
        FOREIGN KEY (procurement_package_type_id)
        REFERENCES procurement_package_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_procurement_packages_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_procurement_packages_owner
        FOREIGN KEY (owner_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_procurement_packages_status
        CHECK (lifecycle_status IN (
            'draft', 'planned', 'enquiring', 'evaluating',
            'awarded', 'ordered', 'complete', 'cancelled', 'archived'
        ))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE procurement_package_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    procurement_package_id BIGINT UNSIGNED NOT NULL,
    sales_item_type_id SMALLINT UNSIGNED NOT NULL,
    unit_of_measure_id SMALLINT UNSIGNED NULL,
    line_number INT UNSIGNED NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(19,6) NOT NULL,
    target_unit_cost DECIMAL(19,4) NULL,
    required_by_date DATE NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_procurement_package_items_id_organisation (id, organisation_id),
    UNIQUE KEY uq_procurement_package_items_line (
        organisation_id,
        procurement_package_id,
        line_number
    ),
    KEY idx_procurement_package_items_package (procurement_package_id, organisation_id),

    CONSTRAINT fk_procurement_package_items_package
        FOREIGN KEY (procurement_package_id, organisation_id)
        REFERENCES procurement_packages (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_procurement_package_items_type
        FOREIGN KEY (sales_item_type_id)
        REFERENCES sales_item_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_procurement_package_items_unit
        FOREIGN KEY (unit_of_measure_id)
        REFERENCES units_of_measure (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_procurement_package_items_line
        CHECK (line_number > 0),
    CONSTRAINT ck_procurement_package_items_quantity
        CHECK (quantity > 0),
    CONSTRAINT ck_procurement_package_items_target_cost
        CHECK (target_unit_cost IS NULL OR target_unit_cost >= 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- RFQ logical records and immutable versions
-- -----------------------------------------------------------------------------

CREATE TABLE rfqs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    rfq_number VARCHAR(80) NOT NULL,
    procurement_package_id BIGINT UNSIGNED NOT NULL,
    owner_member_id BIGINT UNSIGNED NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_rfqs_public_id (public_id),
    UNIQUE KEY uq_rfqs_number (organisation_id, rfq_number),
    UNIQUE KEY uq_rfqs_id_organisation (id, organisation_id),
    KEY idx_rfqs_package (procurement_package_id, organisation_id),
    KEY idx_rfqs_owner (owner_member_id, organisation_id),

    CONSTRAINT fk_rfqs_package
        FOREIGN KEY (procurement_package_id, organisation_id)
        REFERENCES procurement_packages (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_rfqs_owner
        FOREIGN KEY (owner_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_rfqs_lifecycle
        CHECK (lifecycle_status IN ('active', 'cancelled', 'archived'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE rfq_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    rfq_id BIGINT UNSIGNED NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    response_deadline_at DATETIME(6) NULL,
    version_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    locked_by_member_id BIGINT UNSIGNED NULL,
    locked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_rfq_versions_number (organisation_id, rfq_id, version_number),
    UNIQUE KEY uq_rfq_versions_id_organisation (id, organisation_id),
    UNIQUE KEY uq_rfq_versions_id_rfq_context (id, organisation_id, rfq_id),
    KEY idx_rfq_versions_status (organisation_id, rfq_id, version_status),

    CONSTRAINT fk_rfq_versions_rfq
        FOREIGN KEY (rfq_id, organisation_id)
        REFERENCES rfqs (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_rfq_versions_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_rfq_versions_locker
        FOREIGN KEY (locked_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_rfq_versions_number
        CHECK (version_number > 0),
    CONSTRAINT ck_rfq_versions_status
        CHECK (version_status IN ('draft', 'issued', 'superseded', 'withdrawn')),
    CONSTRAINT ck_rfq_versions_lock
        CHECK (
            (version_status = 'draft' AND locked_at IS NULL AND locked_by_member_id IS NULL)
            OR
            (version_status IN ('issued', 'superseded', 'withdrawn') AND locked_at IS NOT NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE rfq_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    rfq_version_id BIGINT UNSIGNED NOT NULL,
    source_procurement_package_item_id BIGINT UNSIGNED NULL,
    sales_item_type_id SMALLINT UNSIGNED NOT NULL,
    unit_of_measure_id SMALLINT UNSIGNED NULL,
    line_number INT UNSIGNED NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(19,6) NOT NULL,
    required_by_date DATE NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_rfq_items_id_organisation (id, organisation_id),
    UNIQUE KEY uq_rfq_items_id_version_context (id, organisation_id, rfq_version_id),
    UNIQUE KEY uq_rfq_items_line (organisation_id, rfq_version_id, line_number),
    KEY idx_rfq_items_source_package_item (
        source_procurement_package_item_id,
        organisation_id
    ),

    CONSTRAINT fk_rfq_items_version
        FOREIGN KEY (rfq_version_id, organisation_id)
        REFERENCES rfq_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_rfq_items_source_package_item
        FOREIGN KEY (source_procurement_package_item_id, organisation_id)
        REFERENCES procurement_package_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_rfq_items_type
        FOREIGN KEY (sales_item_type_id)
        REFERENCES sales_item_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_rfq_items_unit
        FOREIGN KEY (unit_of_measure_id)
        REFERENCES units_of_measure (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_rfq_items_line
        CHECK (line_number > 0),
    CONSTRAINT ck_rfq_items_quantity
        CHECK (quantity > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE rfq_text_blocks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    rfq_version_id BIGINT UNSIGNED NOT NULL,
    block_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    sort_order INT UNSIGNED NOT NULL,
    heading VARCHAR(255) NULL,
    body TEXT NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_rfq_text_blocks_sort (
        organisation_id,
        rfq_version_id,
        block_type,
        sort_order
    ),

    CONSTRAINT fk_rfq_text_blocks_version
        FOREIGN KEY (rfq_version_id, organisation_id)
        REFERENCES rfq_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_rfq_text_blocks_type
        CHECK (block_type IN (
            'scope', 'instruction', 'requirement', 'qualification',
            'commercial_term', 'submission_requirement', 'note'
        ))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- RFQ issue evidence and supplier invitations
-- -----------------------------------------------------------------------------

CREATE TABLE rfq_issue_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    rfq_version_id BIGINT UNSIGNED NOT NULL,
    issue_sequence INT UNSIGNED NOT NULL,
    issued_by_member_id BIGINT UNSIGNED NOT NULL,
    delivery_channel VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    issued_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    note VARCHAR(1000) NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_rfq_issue_events_id_context (id, organisation_id, rfq_version_id),
    UNIQUE KEY uq_rfq_issue_events_sequence (
        organisation_id,
        rfq_version_id,
        issue_sequence
    ),

    CONSTRAINT fk_rfq_issue_events_version
        FOREIGN KEY (rfq_version_id, organisation_id)
        REFERENCES rfq_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_rfq_issue_events_member
        FOREIGN KEY (issued_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_rfq_issue_events_sequence
        CHECK (issue_sequence > 0),
    CONSTRAINT ck_rfq_issue_events_channel
        CHECK (delivery_channel IN ('email', 'portal', 'manual', 'api', 'other'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE rfq_invitations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    rfq_issue_event_id BIGINT UNSIGNED NOT NULL,
    rfq_version_id BIGINT UNSIGNED NOT NULL,
    supplier_party_id BIGINT UNSIGNED NOT NULL,
    contact_party_id BIGINT UNSIGNED NULL,
    recipient_name VARCHAR(255) NULL,
    recipient_email VARCHAR(320) NULL,
    invitation_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'invited',
    responded_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_rfq_invitations_id_organisation (id, organisation_id),
    UNIQUE KEY uq_rfq_invitations_id_version_context (id, organisation_id, rfq_version_id),
    UNIQUE KEY uq_rfq_invitations_supplier_issue (
        organisation_id,
        rfq_issue_event_id,
        supplier_party_id
    ),
    KEY idx_rfq_invitations_supplier (
        supplier_party_id,
        organisation_id,
        invitation_status
    ),

    CONSTRAINT fk_rfq_invitations_issue
        FOREIGN KEY (rfq_issue_event_id, organisation_id, rfq_version_id)
        REFERENCES rfq_issue_events (id, organisation_id, rfq_version_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_rfq_invitations_supplier
        FOREIGN KEY (supplier_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_rfq_invitations_contact
        FOREIGN KEY (contact_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_rfq_invitations_status
        CHECK (invitation_status IN (
            'invited', 'delivered', 'acknowledged', 'declined',
            'submitted', 'expired', 'cancelled'
        ))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Supplier returns
-- -----------------------------------------------------------------------------

CREATE TABLE supplier_returns (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    rfq_invitation_id BIGINT UNSIGNED NOT NULL,
    rfq_version_id BIGINT UNSIGNED NOT NULL,
    submission_number INT UNSIGNED NOT NULL,
    supplier_reference VARCHAR(160) NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    return_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    valid_until DATE NULL,
    submitted_at DATETIME(6) NULL,
    recorded_by_member_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_supplier_returns_public_id (public_id),
    UNIQUE KEY uq_supplier_returns_id_organisation (id, organisation_id),
    UNIQUE KEY uq_supplier_returns_id_invitation_context (
        id,
        organisation_id,
        rfq_invitation_id
    ),
    UNIQUE KEY uq_supplier_returns_submission (
        organisation_id,
        rfq_invitation_id,
        submission_number
    ),
    KEY idx_supplier_returns_version (rfq_version_id, organisation_id, return_status),

    CONSTRAINT fk_supplier_returns_invitation
        FOREIGN KEY (rfq_invitation_id, organisation_id, rfq_version_id)
        REFERENCES rfq_invitations (id, organisation_id, rfq_version_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_supplier_returns_recorder
        FOREIGN KEY (recorded_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_supplier_returns_submission_number
        CHECK (submission_number > 0),
    CONSTRAINT ck_supplier_returns_status
        CHECK (return_status IN ('draft', 'submitted', 'superseded', 'withdrawn')),
    CONSTRAINT ck_supplier_returns_submitted_at
        CHECK (
            (return_status = 'draft' AND submitted_at IS NULL)
            OR return_status IN ('submitted', 'superseded', 'withdrawn')
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE supplier_return_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    supplier_return_id BIGINT UNSIGNED NOT NULL,
    rfq_item_id BIGINT UNSIGNED NOT NULL,
    line_number INT UNSIGNED NOT NULL,
    description TEXT NULL,
    offered_quantity DECIMAL(19,6) NOT NULL,
    unit_rate DECIMAL(19,4) NOT NULL,
    lead_time_days INT UNSIGNED NULL,
    compliance_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'compliant',
    qualification_note TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_supplier_return_items_id_organisation (id, organisation_id),
    UNIQUE KEY uq_supplier_return_items_id_return_context (
        id,
        organisation_id,
        supplier_return_id
    ),
    UNIQUE KEY uq_supplier_return_items_rfq_item (
        organisation_id,
        supplier_return_id,
        rfq_item_id
    ),
    UNIQUE KEY uq_supplier_return_items_line (
        organisation_id,
        supplier_return_id,
        line_number
    ),

    CONSTRAINT fk_supplier_return_items_return
        FOREIGN KEY (supplier_return_id, organisation_id)
        REFERENCES supplier_returns (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_supplier_return_items_rfq_item
        FOREIGN KEY (rfq_item_id, organisation_id)
        REFERENCES rfq_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_supplier_return_items_line
        CHECK (line_number > 0),
    CONSTRAINT ck_supplier_return_items_quantity
        CHECK (offered_quantity > 0),
    CONSTRAINT ck_supplier_return_items_rate
        CHECK (unit_rate >= 0),
    CONSTRAINT ck_supplier_return_items_compliance
        CHECK (compliance_status IN (
            'compliant', 'qualified', 'alternative', 'excluded', 'not_offered'
        ))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE supplier_return_adjustments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    supplier_return_id BIGINT UNSIGNED NOT NULL,
    adjustment_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    sort_order INT UNSIGNED NOT NULL,
    description VARCHAR(500) NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_supplier_return_adjustments_sort (
        organisation_id,
        supplier_return_id,
        sort_order
    ),

    CONSTRAINT fk_supplier_return_adjustments_return
        FOREIGN KEY (supplier_return_id, organisation_id)
        REFERENCES supplier_returns (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_supplier_return_adjustments_type
        CHECK (adjustment_type IN (
            'delivery', 'discount', 'preliminaries', 'attendance',
            'contingency', 'other'
        ))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Evaluation / tender comparison
-- -----------------------------------------------------------------------------

CREATE TABLE procurement_evaluation_criteria (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    procurement_package_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    weighting_percent DECIMAL(7,4) NULL,
    maximum_score DECIMAL(9,4) NOT NULL DEFAULT 100.0000,
    sort_order INT UNSIGNED NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_procurement_evaluation_criteria_id_organisation (id, organisation_id),
    UNIQUE KEY uq_procurement_evaluation_criteria_name (
        organisation_id,
        procurement_package_id,
        name
    ),
    UNIQUE KEY uq_procurement_evaluation_criteria_sort (
        organisation_id,
        procurement_package_id,
        sort_order
    ),

    CONSTRAINT fk_procurement_evaluation_criteria_package
        FOREIGN KEY (procurement_package_id, organisation_id)
        REFERENCES procurement_packages (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_procurement_evaluation_criteria_weight
        CHECK (
            weighting_percent IS NULL
            OR (weighting_percent >= 0.0000 AND weighting_percent <= 100.0000)
        ),
    CONSTRAINT ck_procurement_evaluation_criteria_score
        CHECK (maximum_score > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE procurement_comparisons (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    rfq_version_id BIGINT UNSIGNED NOT NULL,
    comparison_number INT UNSIGNED NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    comparison_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    completed_at DATETIME(6) NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_procurement_comparisons_public_id (public_id),
    UNIQUE KEY uq_procurement_comparisons_id_organisation (id, organisation_id),
    UNIQUE KEY uq_procurement_comparisons_number (
        organisation_id,
        rfq_version_id,
        comparison_number
    ),

    CONSTRAINT fk_procurement_comparisons_rfq_version
        FOREIGN KEY (rfq_version_id, organisation_id)
        REFERENCES rfq_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_procurement_comparisons_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_procurement_comparisons_number
        CHECK (comparison_number > 0),
    CONSTRAINT ck_procurement_comparisons_status
        CHECK (comparison_status IN ('draft', 'completed', 'superseded', 'cancelled')),
    CONSTRAINT ck_procurement_comparisons_completed_at
        CHECK (completed_at IS NULL OR comparison_status IN ('completed', 'superseded'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE procurement_comparison_returns (
    organisation_id BIGINT UNSIGNED NOT NULL,
    procurement_comparison_id BIGINT UNSIGNED NOT NULL,
    supplier_return_id BIGINT UNSIGNED NOT NULL,
    included_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (
        organisation_id,
        procurement_comparison_id,
        supplier_return_id
    ),

    CONSTRAINT fk_procurement_comparison_returns_comparison
        FOREIGN KEY (procurement_comparison_id, organisation_id)
        REFERENCES procurement_comparisons (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT fk_procurement_comparison_returns_supplier_return
        FOREIGN KEY (supplier_return_id, organisation_id)
        REFERENCES supplier_returns (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE supplier_return_scores (
    organisation_id BIGINT UNSIGNED NOT NULL,
    procurement_comparison_id BIGINT UNSIGNED NOT NULL,
    supplier_return_id BIGINT UNSIGNED NOT NULL,
    procurement_evaluation_criterion_id BIGINT UNSIGNED NOT NULL,
    score DECIMAL(9,4) NOT NULL,
    scored_by_member_id BIGINT UNSIGNED NOT NULL,
    notes TEXT NULL,
    scored_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (
        organisation_id,
        procurement_comparison_id,
        supplier_return_id,
        procurement_evaluation_criterion_id
    ),
    KEY idx_supplier_return_scores_criterion (
        procurement_evaluation_criterion_id,
        organisation_id
    ),

    CONSTRAINT fk_supplier_return_scores_comparison_return
        FOREIGN KEY (
            organisation_id,
            procurement_comparison_id,
            supplier_return_id
        )
        REFERENCES procurement_comparison_returns (
            organisation_id,
            procurement_comparison_id,
            supplier_return_id
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT fk_supplier_return_scores_criterion
        FOREIGN KEY (procurement_evaluation_criterion_id, organisation_id)
        REFERENCES procurement_evaluation_criteria (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_supplier_return_scores_member
        FOREIGN KEY (scored_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_supplier_return_scores_nonnegative
        CHECK (score >= 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Awards and split-award items
-- -----------------------------------------------------------------------------

CREATE TABLE procurement_awards (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    procurement_package_id BIGINT UNSIGNED NOT NULL,
    supplier_return_id BIGINT UNSIGNED NOT NULL,
    supplier_party_id BIGINT UNSIGNED NOT NULL,
    award_number INT UNSIGNED NOT NULL,
    award_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'recommended',
    recommended_by_member_id BIGINT UNSIGNED NOT NULL,
    approved_by_member_id BIGINT UNSIGNED NULL,
    recommended_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    approved_at DATETIME(6) NULL,
    notes TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_procurement_awards_public_id (public_id),
    UNIQUE KEY uq_procurement_awards_id_organisation (id, organisation_id),
    UNIQUE KEY uq_procurement_awards_number (
        organisation_id,
        procurement_package_id,
        award_number
    ),
    KEY idx_procurement_awards_supplier (supplier_party_id, organisation_id, award_status),
    KEY idx_procurement_awards_return (supplier_return_id, organisation_id),

    CONSTRAINT fk_procurement_awards_package
        FOREIGN KEY (procurement_package_id, organisation_id)
        REFERENCES procurement_packages (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_procurement_awards_supplier_return
        FOREIGN KEY (supplier_return_id, organisation_id)
        REFERENCES supplier_returns (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_procurement_awards_supplier_party
        FOREIGN KEY (supplier_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_procurement_awards_recommender
        FOREIGN KEY (recommended_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_procurement_awards_approver
        FOREIGN KEY (approved_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_procurement_awards_number
        CHECK (award_number > 0),
    CONSTRAINT ck_procurement_awards_status
        CHECK (award_status IN (
            'recommended', 'approved', 'rejected', 'superseded', 'cancelled'
        )),
    CONSTRAINT ck_procurement_awards_approval
        CHECK (
            (award_status = 'approved' AND approved_by_member_id IS NOT NULL AND approved_at IS NOT NULL)
            OR award_status <> 'approved'
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE procurement_award_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    procurement_award_id BIGINT UNSIGNED NOT NULL,
    procurement_package_item_id BIGINT UNSIGNED NULL,
    supplier_return_item_id BIGINT UNSIGNED NOT NULL,
    awarded_quantity DECIMAL(19,6) NOT NULL,
    awarded_unit_rate DECIMAL(19,4) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_procurement_award_items_id_organisation (id, organisation_id),
    UNIQUE KEY uq_procurement_award_items_return_item (
        organisation_id,
        procurement_award_id,
        supplier_return_item_id
    ),
    KEY idx_procurement_award_items_package_item (
        procurement_package_item_id,
        organisation_id
    ),

    CONSTRAINT fk_procurement_award_items_award
        FOREIGN KEY (procurement_award_id, organisation_id)
        REFERENCES procurement_awards (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_procurement_award_items_package_item
        FOREIGN KEY (procurement_package_item_id, organisation_id)
        REFERENCES procurement_package_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_procurement_award_items_return_item
        FOREIGN KEY (supplier_return_item_id, organisation_id)
        REFERENCES supplier_return_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_procurement_award_items_quantity
        CHECK (awarded_quantity > 0),
    CONSTRAINT ck_procurement_award_items_rate
        CHECK (awarded_unit_rate >= 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Purchase orders and immutable versions
-- -----------------------------------------------------------------------------

CREATE TABLE purchase_orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    purchase_order_number VARCHAR(80) NOT NULL,
    purchase_order_type_id SMALLINT UNSIGNED NOT NULL,
    supplier_party_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    procurement_package_id BIGINT UNSIGNED NULL,
    source_procurement_award_id BIGINT UNSIGNED NULL,
    owner_member_id BIGINT UNSIGNED NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_purchase_orders_public_id (public_id),
    UNIQUE KEY uq_purchase_orders_number (organisation_id, purchase_order_number),
    UNIQUE KEY uq_purchase_orders_id_organisation (id, organisation_id),
    KEY idx_purchase_orders_supplier (supplier_party_id, organisation_id, lifecycle_status),
    KEY idx_purchase_orders_project (project_id, organisation_id, lifecycle_status),
    KEY idx_purchase_orders_package (procurement_package_id, organisation_id),
    KEY idx_purchase_orders_award (source_procurement_award_id, organisation_id),

    CONSTRAINT fk_purchase_orders_type
        FOREIGN KEY (purchase_order_type_id)
        REFERENCES purchase_order_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_orders_supplier
        FOREIGN KEY (supplier_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_orders_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_orders_package
        FOREIGN KEY (procurement_package_id, organisation_id)
        REFERENCES procurement_packages (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_orders_award
        FOREIGN KEY (source_procurement_award_id, organisation_id)
        REFERENCES procurement_awards (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_orders_owner
        FOREIGN KEY (owner_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_purchase_orders_lifecycle
        CHECK (lifecycle_status IN ('active', 'closed', 'cancelled', 'archived'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE purchase_order_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    purchase_order_id BIGINT UNSIGNED NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    supplier_reference VARCHAR(160) NULL,
    order_date DATE NULL,
    required_by_date DATE NULL,
    version_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    approved_by_member_id BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    locked_by_member_id BIGINT UNSIGNED NULL,
    locked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_purchase_order_versions_number (
        organisation_id,
        purchase_order_id,
        version_number
    ),
    UNIQUE KEY uq_purchase_order_versions_id_organisation (id, organisation_id),
    UNIQUE KEY uq_purchase_order_versions_id_po_context (
        id,
        organisation_id,
        purchase_order_id
    ),
    KEY idx_purchase_order_versions_status (
        organisation_id,
        purchase_order_id,
        version_status
    ),

    CONSTRAINT fk_purchase_order_versions_purchase_order
        FOREIGN KEY (purchase_order_id, organisation_id)
        REFERENCES purchase_orders (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_versions_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_versions_approver
        FOREIGN KEY (approved_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_versions_locker
        FOREIGN KEY (locked_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_purchase_order_versions_number
        CHECK (version_number > 0),
    CONSTRAINT ck_purchase_order_versions_status
        CHECK (version_status IN ('draft', 'approved', 'issued', 'superseded', 'cancelled')),
    CONSTRAINT ck_purchase_order_versions_approval
        CHECK (
            approved_at IS NULL
            OR approved_by_member_id IS NOT NULL
        ),
    CONSTRAINT ck_purchase_order_versions_lock
        CHECK (
            (version_status IN ('draft', 'approved') AND locked_at IS NULL AND locked_by_member_id IS NULL)
            OR
            (version_status IN ('issued', 'superseded', 'cancelled') AND locked_at IS NOT NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE purchase_order_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    purchase_order_version_id BIGINT UNSIGNED NOT NULL,
    source_procurement_award_item_id BIGINT UNSIGNED NULL,
    source_procurement_package_item_id BIGINT UNSIGNED NULL,
    sales_item_type_id SMALLINT UNSIGNED NOT NULL,
    unit_of_measure_id SMALLINT UNSIGNED NULL,
    line_number INT UNSIGNED NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(19,6) NOT NULL,
    unit_rate DECIMAL(19,4) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_purchase_order_items_id_organisation (id, organisation_id),
    UNIQUE KEY uq_purchase_order_items_id_version_context (
        id,
        organisation_id,
        purchase_order_version_id
    ),
    UNIQUE KEY uq_purchase_order_items_line (
        organisation_id,
        purchase_order_version_id,
        line_number
    ),
    KEY idx_purchase_order_items_award_item (
        source_procurement_award_item_id,
        organisation_id
    ),
    KEY idx_purchase_order_items_package_item (
        source_procurement_package_item_id,
        organisation_id
    ),

    CONSTRAINT fk_purchase_order_items_version
        FOREIGN KEY (purchase_order_version_id, organisation_id)
        REFERENCES purchase_order_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_items_award_item
        FOREIGN KEY (source_procurement_award_item_id, organisation_id)
        REFERENCES procurement_award_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_items_package_item
        FOREIGN KEY (source_procurement_package_item_id, organisation_id)
        REFERENCES procurement_package_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_items_type
        FOREIGN KEY (sales_item_type_id)
        REFERENCES sales_item_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_items_unit
        FOREIGN KEY (unit_of_measure_id)
        REFERENCES units_of_measure (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_purchase_order_items_line
        CHECK (line_number > 0),
    CONSTRAINT ck_purchase_order_items_quantity
        CHECK (quantity > 0),
    CONSTRAINT ck_purchase_order_items_rate
        CHECK (unit_rate >= 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE purchase_order_item_taxes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    purchase_order_item_id BIGINT UNSIGNED NOT NULL,
    tax_category_id BIGINT UNSIGNED NOT NULL,
    applied_rate_percent DECIMAL(9,4) NOT NULL,
    taxable_amount DECIMAL(19,4) NOT NULL,
    tax_amount DECIMAL(19,4) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_purchase_order_item_taxes_category (
        organisation_id,
        purchase_order_item_id,
        tax_category_id
    ),
    UNIQUE KEY uq_purchase_order_item_taxes_sort (
        organisation_id,
        purchase_order_item_id,
        sort_order
    ),

    CONSTRAINT fk_purchase_order_item_taxes_item
        FOREIGN KEY (purchase_order_item_id, organisation_id)
        REFERENCES purchase_order_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_item_taxes_category
        FOREIGN KEY (tax_category_id, organisation_id)
        REFERENCES tax_categories (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_purchase_order_item_taxes_rate
        CHECK (applied_rate_percent >= 0.0000 AND applied_rate_percent <= 100.0000),
    CONSTRAINT ck_purchase_order_item_taxes_amounts
        CHECK (taxable_amount >= 0 AND tax_amount >= 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE purchase_order_text_blocks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    purchase_order_version_id BIGINT UNSIGNED NOT NULL,
    block_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    sort_order INT UNSIGNED NOT NULL,
    heading VARCHAR(255) NULL,
    body TEXT NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_purchase_order_text_blocks_sort (
        organisation_id,
        purchase_order_version_id,
        block_type,
        sort_order
    ),

    CONSTRAINT fk_purchase_order_text_blocks_version
        FOREIGN KEY (purchase_order_version_id, organisation_id)
        REFERENCES purchase_order_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_purchase_order_text_blocks_type
        CHECK (block_type IN (
            'scope', 'instruction', 'term', 'delivery',
            'warranty', 'exclusion', 'note'
        ))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Purchase-order supplier/contact snapshots
-- -----------------------------------------------------------------------------

CREATE TABLE purchase_order_party_snapshots (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    purchase_order_version_id BIGINT UNSIGNED NOT NULL,
    source_party_id BIGINT UNSIGNED NULL,
    snapshot_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(320) NULL,
    phone VARCHAR(64) NULL,
    reference_identifier VARCHAR(200) NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_purchase_order_party_snapshots_id_context (
        id,
        organisation_id,
        purchase_order_version_id
    ),
    UNIQUE KEY uq_purchase_order_party_snapshots_order (
        organisation_id,
        purchase_order_version_id,
        snapshot_role,
        sort_order
    ),
    KEY idx_purchase_order_party_snapshots_source (source_party_id, organisation_id),

    CONSTRAINT fk_purchase_order_party_snapshots_version
        FOREIGN KEY (purchase_order_version_id, organisation_id)
        REFERENCES purchase_order_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_party_snapshots_source_party
        FOREIGN KEY (source_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_purchase_order_party_snapshots_role
        CHECK (snapshot_role IN ('supplier', 'contact', 'remit_to', 'delivery_contact', 'other'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE purchase_order_party_snapshot_addresses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    purchase_order_party_snapshot_id BIGINT UNSIGNED NOT NULL,
    purchase_order_version_id BIGINT UNSIGNED NOT NULL,
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
    UNIQUE KEY uq_purchase_order_party_snapshot_addresses_role (
        organisation_id,
        purchase_order_party_snapshot_id,
        address_role
    ),

    CONSTRAINT fk_purchase_order_party_snapshot_addresses_snapshot
        FOREIGN KEY (
            purchase_order_party_snapshot_id,
            organisation_id,
            purchase_order_version_id
        )
        REFERENCES purchase_order_party_snapshots (
            id,
            organisation_id,
            purchase_order_version_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Purchase-order issue evidence
-- -----------------------------------------------------------------------------

CREATE TABLE purchase_order_issue_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    purchase_order_version_id BIGINT UNSIGNED NOT NULL,
    issue_sequence INT UNSIGNED NOT NULL,
    issued_by_member_id BIGINT UNSIGNED NOT NULL,
    delivery_channel VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    issued_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    note VARCHAR(1000) NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_purchase_order_issue_events_id_context (
        id,
        organisation_id,
        purchase_order_version_id
    ),
    UNIQUE KEY uq_purchase_order_issue_events_sequence (
        organisation_id,
        purchase_order_version_id,
        issue_sequence
    ),

    CONSTRAINT fk_purchase_order_issue_events_version
        FOREIGN KEY (purchase_order_version_id, organisation_id)
        REFERENCES purchase_order_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_issue_events_member
        FOREIGN KEY (issued_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_purchase_order_issue_events_sequence
        CHECK (issue_sequence > 0),
    CONSTRAINT ck_purchase_order_issue_events_channel
        CHECK (delivery_channel IN ('email', 'portal', 'manual', 'api', 'other'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE purchase_order_issue_recipients (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    purchase_order_issue_event_id BIGINT UNSIGNED NOT NULL,
    purchase_order_version_id BIGINT UNSIGNED NOT NULL,
    source_party_id BIGINT UNSIGNED NULL,
    recipient_name VARCHAR(255) NULL,
    recipient_email VARCHAR(320) NULL,
    delivery_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    delivered_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY idx_purchase_order_issue_recipients_issue (
        organisation_id,
        purchase_order_issue_event_id
    ),

    CONSTRAINT fk_purchase_order_issue_recipients_issue
        FOREIGN KEY (
            purchase_order_issue_event_id,
            organisation_id,
            purchase_order_version_id
        )
        REFERENCES purchase_order_issue_events (
            id,
            organisation_id,
            purchase_order_version_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_issue_recipients_party
        FOREIGN KEY (source_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_purchase_order_issue_recipients_identity
        CHECK (
            source_party_id IS NOT NULL
            OR recipient_name IS NOT NULL
            OR recipient_email IS NOT NULL
        ),
    CONSTRAINT ck_purchase_order_issue_recipients_status
        CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'acknowledged'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Goods / service receipts
-- -----------------------------------------------------------------------------

CREATE TABLE purchase_order_receipts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    purchase_order_id BIGINT UNSIGNED NOT NULL,
    receipt_number VARCHAR(80) NOT NULL,
    receipt_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'goods',
    received_by_member_id BIGINT UNSIGNED NOT NULL,
    received_at DATETIME(6) NOT NULL,
    supplier_delivery_reference VARCHAR(160) NULL,
    receipt_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'recorded',
    notes TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_purchase_order_receipts_public_id (public_id),
    UNIQUE KEY uq_purchase_order_receipts_id_organisation (id, organisation_id),
    UNIQUE KEY uq_purchase_order_receipts_number (organisation_id, receipt_number),
    KEY idx_purchase_order_receipts_po (
        purchase_order_id,
        organisation_id,
        received_at
    ),

    CONSTRAINT fk_purchase_order_receipts_purchase_order
        FOREIGN KEY (purchase_order_id, organisation_id)
        REFERENCES purchase_orders (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_receipts_member
        FOREIGN KEY (received_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_purchase_order_receipts_type
        CHECK (receipt_type IN ('goods', 'service', 'mixed')),
    CONSTRAINT ck_purchase_order_receipts_status
        CHECK (receipt_status IN ('recorded', 'confirmed', 'reversed', 'cancelled'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE purchase_order_receipt_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    purchase_order_receipt_id BIGINT UNSIGNED NOT NULL,
    purchase_order_item_id BIGINT UNSIGNED NOT NULL,
    quantity_received DECIMAL(19,6) NOT NULL,
    quantity_rejected DECIMAL(19,6) NOT NULL DEFAULT 0.000000,
    rejection_reason VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_purchase_order_receipt_items_line (
        organisation_id,
        purchase_order_receipt_id,
        purchase_order_item_id
    ),
    KEY idx_purchase_order_receipt_items_po_item (
        purchase_order_item_id,
        organisation_id
    ),

    CONSTRAINT fk_purchase_order_receipt_items_receipt
        FOREIGN KEY (purchase_order_receipt_id, organisation_id)
        REFERENCES purchase_order_receipts (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_receipt_items_po_item
        FOREIGN KEY (purchase_order_item_id, organisation_id)
        REFERENCES purchase_order_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_purchase_order_receipt_items_received
        CHECK (quantity_received >= 0),
    CONSTRAINT ck_purchase_order_receipt_items_rejected
        CHECK (quantity_rejected >= 0 AND quantity_rejected <= quantity_received),
    CONSTRAINT ck_purchase_order_receipt_items_nonzero
        CHECK (quantity_received > 0 OR quantity_rejected > 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Initial global reference values
-- -----------------------------------------------------------------------------

INSERT INTO procurement_package_types (code, name) VALUES
    ('materials', 'Materials'),
    ('plant', 'Plant / equipment'),
    ('subcontract', 'Subcontract work package'),
    ('consultancy', 'Consultancy / professional service'),
    ('service', 'Service / maintenance'),
    ('mixed', 'Mixed procurement package'),
    ('other', 'Other');

INSERT INTO purchase_order_types (code, name) VALUES
    ('materials', 'Materials order'),
    ('plant_hire', 'Plant / equipment hire'),
    ('service', 'Service order'),
    ('subcontract', 'Subcontract order'),
    ('consultancy', 'Consultancy order'),
    ('other', 'Other order');

-- -----------------------------------------------------------------------------
-- Required application invariants not completely expressible as simple FKs
-- -----------------------------------------------------------------------------
--
-- 1. rfq_items.source_procurement_package_item_id, when present, must belong to
--    the procurement package associated with the RFQ.
-- 2. supplier parties used in invitations/orders must satisfy active supplier-side
--    party-role policy for the tenant (supplier/subcontractor/consultant/etc.).
-- 3. contact_party_id used on an RFQ invitation should be a person/contact suitable
--    for the invited supplier; party subtype/contact relationship is domain policy.
-- 4. issued/superseded/withdrawn RFQ versions are immutable through normal writes.
-- 5. supplier_return_items must reference RFQ items belonging to the return's
--    rfq_version_id. This is tested transactionally because keeping rfq_version_id on
--    the item would duplicate a dependency already determined by rfq_item_id.
-- 6. submitted/superseded supplier returns are immutable through normal writes.
-- 7. procurement_evaluation_criteria weighting policy is configurable; when weighted
--    evaluation is used, active criteria should normally total 100%.
-- 8. supplier_return_scores.score must not exceed the referenced criterion's
--    maximum_score.
-- 9. comparison returns must belong to the compared RFQ version.
-- 10. procurement_awards.supplier_party_id must correspond to the supplier associated
--     with the award's supplier_return_id.
-- 11. procurement_award_items must reference supplier_return_items that belong to
--     the award's supplier return.
-- 12. awarded quantities must satisfy package/RFQ award policy; split awards are
--     permitted but aggregate awarded quantity must not silently exceed requirement.
-- 13. approved awards require appropriate capability/approval authority.
-- 14. purchase_orders created from an award must normally use the awarded supplier;
--     any authorised override must be explicit and audited.
-- 15. purchase_order_items.source_procurement_award_item_id, when present, must belong
--     to the source award associated with the PO.
-- 16. issued/superseded/cancelled purchase_order_versions are immutable through normal
--     application writes.
-- 17. issuing a PO must atomically validate lines/tax, create required supplier/contact/
--     address snapshots, lock the version, create issue evidence and write audit/outbox.
-- 18. a receipt item must reference a PO item that belongs to the receipt header's PO.
--     This is a cross-table invariant intentionally kept out of duplicated item columns.
-- 19. aggregate confirmed receipt quantity must not exceed ordered quantity unless an
--     explicit over-receipt policy/permission permits it.
-- 20. reversed/cancelled receipts are excluded from derived received/remaining values.
-- 21. PO net/tax/gross, committed value, quantity received and quantity remaining are
--     derived from authoritative version/receipt facts; there is no editable duplicate
--     balance in this package.
-- 22. all commercial arithmetic uses DECIMAL. Binary floating-point is forbidden for
--     authoritative procurement values.
-- 23. every issue, submission, award, approval, receipt and reversal transition must
--     be tenant-authorised and audited.