-- NuBlox: Digital Applications
-- Schema package 009: Commercial Cost Control
-- Depends on: 001-platform-kernel.sql through 008-site-quality-safety-integrity.sql
-- Target: MySQL 8.4 / InnoDB
-- Design target: 3NF by default
-- Generated: 2026-08-15
--
-- PRINCIPLES:
-- 1. Commercial control classifies authoritative source facts; it does not duplicate them.
-- 2. Cost codes are classification/master data, not stored balances.
-- 3. Approved budget/variation/forecast versions are historical facts.
-- 4. PO commitments, labour actuals and customer financial values remain owned by source domains.
-- 5. Forecast snapshots are intentional point-in-time reporting facts.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
-- Prerequisite candidate-key hardening for tenant-safe Package 009 links
-- -----------------------------------------------------------------------------

ALTER TABLE estimate_item_cost_components
    ADD UNIQUE KEY uq_estimate_item_cost_components_id_org (id, organisation_id);

ALTER TABLE timesheet_entry_cost_snapshots
    ADD UNIQUE KEY uq_timesheet_entry_cost_snapshots_id_org (id, organisation_id);

-- -----------------------------------------------------------------------------
-- Global controlled reference data
-- -----------------------------------------------------------------------------

CREATE TABLE commercial_cost_categories (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_cost_categories_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_adjustment_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_adjustment_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_variation_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_variation_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_valuation_adjustment_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_valuation_adjustment_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Project cost-code structure
-- -----------------------------------------------------------------------------

CREATE TABLE project_cost_codes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    commercial_cost_category_id SMALLINT UNSIGNED NOT NULL,
    parent_cost_code_id BIGINT UNSIGNED NULL,
    code VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_cost_codes_public_id (public_id),
    UNIQUE KEY uq_project_cost_codes_id_org (id, organisation_id),
    UNIQUE KEY uq_project_cost_codes_id_project_org (id, project_id, organisation_id),
    UNIQUE KEY uq_project_cost_codes_code (organisation_id, project_id, code),
    KEY idx_project_cost_codes_parent (parent_cost_code_id, project_id, organisation_id),
    KEY idx_project_cost_codes_category (
        organisation_id, project_id, commercial_cost_category_id, is_active
    ),

    CONSTRAINT fk_project_cost_codes_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_cost_codes_category
        FOREIGN KEY (commercial_cost_category_id)
        REFERENCES commercial_cost_categories (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_cost_codes_parent
        FOREIGN KEY (parent_cost_code_id, project_id, organisation_id)
        REFERENCES project_cost_codes (id, project_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_project_cost_codes_parent
        CHECK (parent_cost_code_id IS NULL OR parent_cost_code_id <> id),
    CONSTRAINT ck_project_cost_codes_sort
        CHECK (sort_order > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Project budgets and immutable approved versions
-- -----------------------------------------------------------------------------

CREATE TABLE project_budgets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    budget_number VARCHAR(80) NOT NULL,
    name VARCHAR(255) NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_budgets_public_id (public_id),
    UNIQUE KEY uq_project_budgets_id_org (id, organisation_id),
    UNIQUE KEY uq_project_budgets_id_project_org (id, project_id, organisation_id),
    UNIQUE KEY uq_project_budgets_number (organisation_id, project_id, budget_number),
    KEY idx_project_budgets_status (organisation_id, project_id, lifecycle_status),

    CONSTRAINT fk_project_budgets_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_budgets_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_project_budgets_status
        CHECK (lifecycle_status IN ('active', 'cancelled', 'archived'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_budget_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_budget_id BIGINT UNSIGNED NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    version_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    effective_on DATE NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    approved_by_member_id BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    locked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_budget_versions_id_org (id, organisation_id),
    UNIQUE KEY uq_project_budget_versions_id_context (
        id, organisation_id, project_budget_id
    ),
    UNIQUE KEY uq_project_budget_versions_number (
        organisation_id, project_budget_id, version_number
    ),
    KEY idx_project_budget_versions_status (
        organisation_id, project_budget_id, version_status
    ),

    CONSTRAINT fk_project_budget_versions_budget
        FOREIGN KEY (project_budget_id, organisation_id)
        REFERENCES project_budgets (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_budget_versions_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_budget_versions_approver
        FOREIGN KEY (approved_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_project_budget_versions_number
        CHECK (version_number > 0),
    CONSTRAINT ck_project_budget_versions_status
        CHECK (version_status IN ('draft', 'approved', 'superseded', 'cancelled')),
    CONSTRAINT ck_project_budget_versions_approval
        CHECK (
            (version_status = 'draft'
                AND approved_at IS NULL
                AND approved_by_member_id IS NULL
                AND locked_at IS NULL)
            OR
            (version_status IN ('approved', 'superseded')
                AND approved_at IS NOT NULL
                AND approved_by_member_id IS NOT NULL
                AND locked_at IS NOT NULL)
            OR
            (version_status = 'cancelled')
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_budget_lines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_budget_version_id BIGINT UNSIGNED NOT NULL,
    project_cost_code_id BIGINT UNSIGNED NOT NULL,
    line_number INT UNSIGNED NOT NULL,
    description VARCHAR(500) NULL,
    budget_amount DECIMAL(19,4) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_budget_lines_id_org (id, organisation_id),
    UNIQUE KEY uq_project_budget_lines_line (
        organisation_id, project_budget_version_id, line_number
    ),
    KEY idx_project_budget_lines_cost_code (
        project_cost_code_id, organisation_id
    ),

    CONSTRAINT fk_project_budget_lines_version
        FOREIGN KEY (project_budget_version_id, organisation_id)
        REFERENCES project_budget_versions (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_budget_lines_cost_code
        FOREIGN KEY (project_cost_code_id, organisation_id)
        REFERENCES project_cost_codes (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_project_budget_lines_number
        CHECK (line_number > 0),
    CONSTRAINT ck_project_budget_lines_amount
        CHECK (budget_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_budget_line_estimate_sources (
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_budget_line_id BIGINT UNSIGNED NOT NULL,
    estimate_item_cost_component_id BIGINT UNSIGNED NOT NULL,
    linked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (
        organisation_id,
        project_budget_line_id,
        estimate_item_cost_component_id
    ),

    CONSTRAINT fk_project_budget_line_sources_line
        FOREIGN KEY (project_budget_line_id, organisation_id)
        REFERENCES project_budget_lines (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_budget_line_sources_component
        FOREIGN KEY (estimate_item_cost_component_id, organisation_id)
        REFERENCES estimate_item_cost_components (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Classification of authoritative source facts
-- -----------------------------------------------------------------------------

CREATE TABLE purchase_order_item_cost_allocations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    purchase_order_item_id BIGINT UNSIGNED NOT NULL,
    project_cost_code_id BIGINT UNSIGNED NOT NULL,
    allocated_net_amount DECIMAL(19,4) NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_po_item_cost_allocations_id_org (id, organisation_id),
    UNIQUE KEY uq_po_item_cost_allocations_code (
        organisation_id, purchase_order_item_id, project_cost_code_id
    ),
    KEY idx_po_item_cost_allocations_code (
        project_cost_code_id, organisation_id
    ),

    CONSTRAINT fk_po_item_cost_allocations_item
        FOREIGN KEY (purchase_order_item_id, organisation_id)
        REFERENCES purchase_order_items (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_po_item_cost_allocations_code
        FOREIGN KEY (project_cost_code_id, organisation_id)
        REFERENCES project_cost_codes (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_po_item_cost_allocations_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_po_item_cost_allocations_amount
        CHECK (allocated_net_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE timesheet_cost_code_allocations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    timesheet_entry_cost_snapshot_id BIGINT UNSIGNED NOT NULL,
    project_cost_code_id BIGINT UNSIGNED NOT NULL,
    allocated_cost_amount DECIMAL(19,4) NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_timesheet_cost_allocations_id_org (id, organisation_id),
    UNIQUE KEY uq_timesheet_cost_allocations_code (
        organisation_id, timesheet_entry_cost_snapshot_id, project_cost_code_id
    ),
    KEY idx_timesheet_cost_allocations_code (
        project_cost_code_id, organisation_id
    ),

    CONSTRAINT fk_timesheet_cost_allocations_snapshot
        FOREIGN KEY (timesheet_entry_cost_snapshot_id, organisation_id)
        REFERENCES timesheet_entry_cost_snapshots (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_timesheet_cost_allocations_code
        FOREIGN KEY (project_cost_code_id, organisation_id)
        REFERENCES project_cost_codes (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_timesheet_cost_allocations_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_timesheet_cost_allocations_amount
        CHECK (allocated_cost_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE financial_document_item_value_allocations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    financial_document_item_id BIGINT UNSIGNED NOT NULL,
    project_cost_code_id BIGINT UNSIGNED NOT NULL,
    allocated_net_amount DECIMAL(19,4) NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_fin_doc_item_value_allocations_id_org (id, organisation_id),
    UNIQUE KEY uq_fin_doc_item_value_allocations_code (
        organisation_id, financial_document_item_id, project_cost_code_id
    ),
    KEY idx_fin_doc_item_value_allocations_code (
        project_cost_code_id, organisation_id
    ),

    CONSTRAINT fk_fin_doc_item_value_allocations_item
        FOREIGN KEY (financial_document_item_id, organisation_id)
        REFERENCES financial_document_items (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_fin_doc_item_value_allocations_code
        FOREIGN KEY (project_cost_code_id, organisation_id)
        REFERENCES project_cost_codes (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_fin_doc_item_value_allocations_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_fin_doc_item_value_allocations_amount
        CHECK (allocated_net_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Direct/manual project costs not owned by another source domain
-- -----------------------------------------------------------------------------

CREATE TABLE project_direct_costs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    project_cost_code_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    direct_cost_number VARCHAR(80) NOT NULL,
    entry_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    transaction_date DATE NOT NULL,
    party_id BIGINT UNSIGNED NULL,
    description VARCHAR(1000) NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_system VARCHAR(120) NULL,
    source_reference VARCHAR(255) NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    posted_by_member_id BIGINT UNSIGNED NULL,
    posted_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_direct_costs_public_id (public_id),
    UNIQUE KEY uq_project_direct_costs_id_org (id, organisation_id),
    UNIQUE KEY uq_project_direct_costs_number (
        organisation_id, project_id, direct_cost_number
    ),
    UNIQUE KEY uq_project_direct_costs_source (
        organisation_id, source_system, source_reference
    ),
    KEY idx_project_direct_costs_project (
        organisation_id, project_id, transaction_date, lifecycle_status
    ),
    KEY idx_project_direct_costs_code (
        project_cost_code_id, organisation_id, transaction_date
    ),

    CONSTRAINT fk_project_direct_costs_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_direct_costs_code
        FOREIGN KEY (project_cost_code_id, project_id, organisation_id)
        REFERENCES project_cost_codes (id, project_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_direct_costs_party
        FOREIGN KEY (party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_direct_costs_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_direct_costs_poster
        FOREIGN KEY (posted_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_project_direct_costs_type
        CHECK (entry_type IN (
            'actual', 'accrual', 'opening_balance', 'imported_adjustment', 'other'
        )),
    CONSTRAINT ck_project_direct_costs_amount
        CHECK (amount > 0),
    CONSTRAINT ck_project_direct_costs_status
        CHECK (lifecycle_status IN ('draft', 'posted', 'cancelled')),
    CONSTRAINT ck_project_direct_costs_posting
        CHECK (
            (lifecycle_status = 'draft'
                AND posted_at IS NULL
                AND posted_by_member_id IS NULL)
            OR
            (lifecycle_status = 'posted'
                AND posted_at IS NOT NULL
                AND posted_by_member_id IS NOT NULL)
            OR lifecycle_status = 'cancelled'
        ),
    CONSTRAINT ck_project_direct_costs_source
        CHECK (
            (source_system IS NULL AND source_reference IS NULL)
            OR (source_system IS NOT NULL AND source_reference IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_direct_cost_reversals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_direct_cost_id BIGINT UNSIGNED NOT NULL,
    reversal_amount DECIMAL(19,4) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    reversed_by_member_id BIGINT UNSIGNED NOT NULL,
    reversed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_direct_cost_reversals_id_org (id, organisation_id),
    KEY idx_project_direct_cost_reversals_cost (
        project_direct_cost_id, organisation_id, reversed_at
    ),

    CONSTRAINT fk_project_direct_cost_reversals_cost
        FOREIGN KEY (project_direct_cost_id, organisation_id)
        REFERENCES project_direct_costs (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_direct_cost_reversals_member
        FOREIGN KEY (reversed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_project_direct_cost_reversals_amount
        CHECK (reversal_amount > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Commercial variations
-- -----------------------------------------------------------------------------

CREATE TABLE commercial_variations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    variation_number VARCHAR(120) NOT NULL,
    commercial_variation_type_id SMALLINT UNSIGNED NOT NULL,
    commercial_side VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    counterparty_party_id BIGINT UNSIGNED NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(500) NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    owner_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_variations_public_id (public_id),
    UNIQUE KEY uq_commercial_variations_id_org (id, organisation_id),
    UNIQUE KEY uq_commercial_variations_id_project_org (
        id, project_id, organisation_id
    ),
    UNIQUE KEY uq_commercial_variations_number (
        organisation_id, project_id, variation_number
    ),
    KEY idx_commercial_variations_status (
        organisation_id, project_id, commercial_side, lifecycle_status
    ),

    CONSTRAINT fk_commercial_variations_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_variations_type
        FOREIGN KEY (commercial_variation_type_id)
        REFERENCES commercial_variation_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_variations_counterparty
        FOREIGN KEY (counterparty_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_variations_owner
        FOREIGN KEY (owner_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_commercial_variations_side
        CHECK (commercial_side IN ('revenue', 'cost', 'internal')),
    CONSTRAINT ck_commercial_variations_status
        CHECK (lifecycle_status IN ('active', 'closed', 'cancelled', 'archived'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_variations (
    commercial_variation_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    contract_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (commercial_variation_id),
    UNIQUE KEY uq_contract_variations_context (
        commercial_variation_id, organisation_id
    ),
    KEY idx_contract_variations_contract (contract_id, organisation_id),

    CONSTRAINT fk_contract_variations_variation
        FOREIGN KEY (commercial_variation_id, organisation_id)
        REFERENCES commercial_variations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_contract_variations_contract
        FOREIGN KEY (contract_id, organisation_id)
        REFERENCES contracts (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE purchase_order_variations (
    commercial_variation_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    purchase_order_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (commercial_variation_id),
    UNIQUE KEY uq_purchase_order_variations_context (
        commercial_variation_id, organisation_id
    ),
    KEY idx_purchase_order_variations_po (purchase_order_id, organisation_id),

    CONSTRAINT fk_purchase_order_variations_variation
        FOREIGN KEY (commercial_variation_id, organisation_id)
        REFERENCES commercial_variations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_variations_po
        FOREIGN KEY (purchase_order_id, organisation_id)
        REFERENCES purchase_orders (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_variation_change_events (
    commercial_variation_id BIGINT UNSIGNED NOT NULL,
    variation_organisation_id BIGINT UNSIGNED NOT NULL,
    project_change_event_id BIGINT UNSIGNED NOT NULL,
    change_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    linked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (
        commercial_variation_id,
        project_change_event_id,
        change_owner_organisation_id
    ),

    CONSTRAINT fk_commercial_variation_change_events_variation
        FOREIGN KEY (commercial_variation_id, variation_organisation_id)
        REFERENCES commercial_variations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_variation_change_events_change
        FOREIGN KEY (project_change_event_id, change_owner_organisation_id)
        REFERENCES project_change_events (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_variation_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    commercial_variation_id BIGINT UNSIGNED NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    title VARCHAR(500) NOT NULL,
    version_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    locked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_variation_versions_id_org (id, organisation_id),
    UNIQUE KEY uq_commercial_variation_versions_id_context (
        id, organisation_id, commercial_variation_id
    ),
    UNIQUE KEY uq_commercial_variation_versions_number (
        organisation_id, commercial_variation_id, version_number
    ),
    KEY idx_commercial_variation_versions_status (
        organisation_id, commercial_variation_id, version_status
    ),

    CONSTRAINT fk_commercial_variation_versions_variation
        FOREIGN KEY (commercial_variation_id, organisation_id)
        REFERENCES commercial_variations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_variation_versions_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_commercial_variation_versions_number
        CHECK (version_number > 0),
    CONSTRAINT ck_commercial_variation_versions_status
        CHECK (version_status IN ('draft', 'issued', 'superseded', 'withdrawn')),
    CONSTRAINT ck_commercial_variation_versions_lock
        CHECK (
            (version_status = 'draft' AND locked_at IS NULL)
            OR
            (version_status IN ('issued', 'superseded', 'withdrawn') AND locked_at IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_variation_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    commercial_variation_version_id BIGINT UNSIGNED NOT NULL,
    project_cost_code_id BIGINT UNSIGNED NULL,
    unit_of_measure_id SMALLINT UNSIGNED NULL,
    line_number INT UNSIGNED NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(19,6) NOT NULL DEFAULT 1.000000,
    unit_rate DECIMAL(19,4) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_variation_items_id_org (id, organisation_id),
    UNIQUE KEY uq_commercial_variation_items_id_context (
        id, organisation_id, commercial_variation_version_id
    ),
    UNIQUE KEY uq_commercial_variation_items_line (
        organisation_id, commercial_variation_version_id, line_number
    ),
    KEY idx_commercial_variation_items_code (
        project_cost_code_id, organisation_id
    ),

    CONSTRAINT fk_commercial_variation_items_version
        FOREIGN KEY (commercial_variation_version_id, organisation_id)
        REFERENCES commercial_variation_versions (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_variation_items_code
        FOREIGN KEY (project_cost_code_id, organisation_id)
        REFERENCES project_cost_codes (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_variation_items_uom
        FOREIGN KEY (unit_of_measure_id)
        REFERENCES units_of_measure (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_commercial_variation_items_line
        CHECK (line_number > 0),
    CONSTRAINT ck_commercial_variation_items_quantity
        CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_variation_issue_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    commercial_variation_version_id BIGINT UNSIGNED NOT NULL,
    issue_sequence INT UNSIGNED NOT NULL,
    issued_by_member_id BIGINT UNSIGNED NOT NULL,
    delivery_channel VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    issued_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    note VARCHAR(1000) NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_variation_issue_events_id_org (id, organisation_id),
    UNIQUE KEY uq_commercial_variation_issue_events_sequence (
        organisation_id, commercial_variation_version_id, issue_sequence
    ),

    CONSTRAINT fk_commercial_variation_issue_events_version
        FOREIGN KEY (commercial_variation_version_id, organisation_id)
        REFERENCES commercial_variation_versions (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_variation_issue_events_member
        FOREIGN KEY (issued_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_commercial_variation_issue_events_sequence
        CHECK (issue_sequence > 0),
    CONSTRAINT ck_commercial_variation_issue_events_channel
        CHECK (delivery_channel IN ('email', 'portal', 'manual', 'api', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_variation_decisions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    commercial_variation_version_id BIGINT UNSIGNED NOT NULL,
    decision_sequence INT UNSIGNED NOT NULL,
    decision VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    decision_amount DECIMAL(19,4) NULL,
    responding_party_id BIGINT UNSIGNED NULL,
    recorded_by_member_id BIGINT UNSIGNED NOT NULL,
    decided_at DATETIME(6) NOT NULL,
    comments TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_variation_decisions_id_org (id, organisation_id),
    UNIQUE KEY uq_commercial_variation_decisions_sequence (
        organisation_id, commercial_variation_version_id, decision_sequence
    ),

    CONSTRAINT fk_commercial_variation_decisions_version
        FOREIGN KEY (commercial_variation_version_id, organisation_id)
        REFERENCES commercial_variation_versions (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_variation_decisions_party
        FOREIGN KEY (responding_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_variation_decisions_recorder
        FOREIGN KEY (recorded_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_commercial_variation_decisions_sequence
        CHECK (decision_sequence > 0),
    CONSTRAINT ck_commercial_variation_decisions_decision
        CHECK (decision IN (
            'pending', 'accepted', 'partially_accepted', 'rejected', 'withdrawn'
        )),
    CONSTRAINT ck_commercial_variation_decisions_amount
        CHECK (
            decision_amount IS NULL
            OR decision IN ('accepted', 'partially_accepted')
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_variation_decision_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    commercial_variation_decision_id BIGINT UNSIGNED NOT NULL,
    commercial_variation_item_id BIGINT UNSIGNED NOT NULL,
    decided_amount DECIMAL(19,4) NOT NULL,
    comments VARCHAR(1000) NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_variation_decision_items_id_org (id, organisation_id),
    UNIQUE KEY uq_commercial_variation_decision_items_item (
        organisation_id,
        commercial_variation_decision_id,
        commercial_variation_item_id
    ),

    CONSTRAINT fk_commercial_variation_decision_items_decision
        FOREIGN KEY (commercial_variation_decision_id, organisation_id)
        REFERENCES commercial_variation_decisions (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_variation_decision_items_item
        FOREIGN KEY (commercial_variation_item_id, organisation_id)
        REFERENCES commercial_variation_items (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_variation_contract_amendments (
    organisation_id BIGINT UNSIGNED NOT NULL,
    commercial_variation_id BIGINT UNSIGNED NOT NULL,
    contract_amendment_id BIGINT UNSIGNED NOT NULL,
    linked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (
        organisation_id, commercial_variation_id, contract_amendment_id
    ),

    CONSTRAINT fk_commercial_variation_contract_amendments_variation
        FOREIGN KEY (commercial_variation_id, organisation_id)
        REFERENCES commercial_variations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_variation_contract_amendments_amendment
        FOREIGN KEY (contract_amendment_id, organisation_id)
        REFERENCES contract_amendments (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_variation_purchase_order_versions (
    organisation_id BIGINT UNSIGNED NOT NULL,
    commercial_variation_id BIGINT UNSIGNED NOT NULL,
    purchase_order_version_id BIGINT UNSIGNED NOT NULL,
    linked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (
        organisation_id, commercial_variation_id, purchase_order_version_id
    ),

    CONSTRAINT fk_commercial_variation_po_versions_variation
        FOREIGN KEY (commercial_variation_id, organisation_id)
        REFERENCES commercial_variations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_variation_po_versions_version
        FOREIGN KEY (purchase_order_version_id, organisation_id)
        REFERENCES purchase_order_versions (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_variation_information_links (
    commercial_variation_id BIGINT UNSIGNED NOT NULL,
    variation_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'evidence',
    linked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (
        commercial_variation_id,
        information_container_version_id,
        link_role
    ),

    CONSTRAINT fk_commercial_variation_info_variation
        FOREIGN KEY (commercial_variation_id, variation_organisation_id)
        REFERENCES commercial_variations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_commercial_variation_info_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_commercial_variation_info_role
        CHECK (link_role IN (
            'evidence', 'quotation', 'instruction', 'drawing',
            'assessment', 'agreement', 'other'
        ))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Budget adjustments / transfers
-- -----------------------------------------------------------------------------

CREATE TABLE project_budget_adjustments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_budget_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    adjustment_number VARCHAR(80) NOT NULL,
    commercial_adjustment_type_id SMALLINT UNSIGNED NOT NULL,
    source_commercial_variation_id BIGINT UNSIGNED NULL,
    description VARCHAR(1000) NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    effective_on DATE NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    approved_by_member_id BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_budget_adjustments_public_id (public_id),
    UNIQUE KEY uq_project_budget_adjustments_id_org (id, organisation_id),
    UNIQUE KEY uq_project_budget_adjustments_number (
        organisation_id, project_budget_id, adjustment_number
    ),
    KEY idx_project_budget_adjustments_status (
        organisation_id, project_budget_id, lifecycle_status
    ),
    KEY idx_project_budget_adjustments_variation (
        source_commercial_variation_id, organisation_id
    ),

    CONSTRAINT fk_project_budget_adjustments_budget
        FOREIGN KEY (project_budget_id, organisation_id)
        REFERENCES project_budgets (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_budget_adjustments_type
        FOREIGN KEY (commercial_adjustment_type_id)
        REFERENCES commercial_adjustment_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_budget_adjustments_variation
        FOREIGN KEY (source_commercial_variation_id, organisation_id)
        REFERENCES commercial_variations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_budget_adjustments_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_budget_adjustments_approver
        FOREIGN KEY (approved_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_project_budget_adjustments_status
        CHECK (lifecycle_status IN (
            'draft', 'submitted', 'approved', 'rejected', 'cancelled'
        )),
    CONSTRAINT ck_project_budget_adjustments_approval
        CHECK (
            (lifecycle_status = 'approved'
                AND approved_at IS NOT NULL
                AND approved_by_member_id IS NOT NULL
                AND effective_on IS NOT NULL)
            OR lifecycle_status <> 'approved'
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_budget_adjustment_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_budget_adjustment_id BIGINT UNSIGNED NOT NULL,
    project_cost_code_id BIGINT UNSIGNED NOT NULL,
    line_number INT UNSIGNED NOT NULL,
    description VARCHAR(500) NULL,
    adjustment_amount DECIMAL(19,4) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_budget_adjustment_items_id_org (id, organisation_id),
    UNIQUE KEY uq_project_budget_adjustment_items_line (
        organisation_id, project_budget_adjustment_id, line_number
    ),
    KEY idx_project_budget_adjustment_items_code (
        project_cost_code_id, organisation_id
    ),

    CONSTRAINT fk_project_budget_adjustment_items_adjustment
        FOREIGN KEY (project_budget_adjustment_id, organisation_id)
        REFERENCES project_budget_adjustments (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_budget_adjustment_items_code
        FOREIGN KEY (project_cost_code_id, organisation_id)
        REFERENCES project_cost_codes (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_project_budget_adjustment_items_line
        CHECK (line_number > 0),
    CONSTRAINT ck_project_budget_adjustment_items_amount
        CHECK (adjustment_amount <> 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Commercial valuations / applications / certifications
-- -----------------------------------------------------------------------------

CREATE TABLE commercial_valuations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    valuation_number VARCHAR(120) NOT NULL,
    valuation_kind VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_application_id BIGINT UNSIGNED NULL,
    counterparty_party_id BIGINT UNSIGNED NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    period_start DATE NULL,
    period_end DATE NULL,
    valuation_date DATE NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    recorded_by_member_id BIGINT UNSIGNED NOT NULL,
    submitted_at DATETIME(6) NULL,
    assessed_by_member_id BIGINT UNSIGNED NULL,
    assessed_at DATETIME(6) NULL,
    closed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_valuations_public_id (public_id),
    UNIQUE KEY uq_commercial_valuations_id_org (id, organisation_id),
    UNIQUE KEY uq_commercial_valuations_id_project_org (
        id, project_id, organisation_id
    ),
    UNIQUE KEY uq_commercial_valuations_number (
        organisation_id, project_id, valuation_number
    ),
    KEY idx_commercial_valuations_status (
        organisation_id, project_id, valuation_kind, lifecycle_status
    ),
    KEY idx_commercial_valuations_source (
        source_application_id, organisation_id
    ),

    CONSTRAINT fk_commercial_valuations_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_valuations_source
        FOREIGN KEY (source_application_id, organisation_id)
        REFERENCES commercial_valuations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_valuations_counterparty
        FOREIGN KEY (counterparty_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_valuations_recorder
        FOREIGN KEY (recorded_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_valuations_assessor
        FOREIGN KEY (assessed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_commercial_valuations_kind
        CHECK (valuation_kind IN (
            'client_application',
            'client_certificate',
            'supplier_application',
            'supplier_certificate',
            'internal_assessment'
        )),
    CONSTRAINT ck_commercial_valuations_period
        CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start),
    CONSTRAINT ck_commercial_valuations_status
        CHECK (lifecycle_status IN (
            'draft', 'submitted', 'assessed', 'certified', 'closed', 'cancelled'
        )),
    CONSTRAINT ck_commercial_valuations_assessment
        CHECK (
            (lifecycle_status IN ('assessed', 'certified', 'closed')
                AND assessed_at IS NOT NULL
                AND assessed_by_member_id IS NOT NULL)
            OR lifecycle_status NOT IN ('assessed', 'certified', 'closed')
        ),
    CONSTRAINT ck_commercial_valuations_closed
        CHECK (closed_at IS NULL OR lifecycle_status = 'closed')
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE contract_valuations (
    commercial_valuation_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    contract_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (commercial_valuation_id),
    UNIQUE KEY uq_contract_valuations_context (
        commercial_valuation_id, organisation_id
    ),
    KEY idx_contract_valuations_contract (contract_id, organisation_id),

    CONSTRAINT fk_contract_valuations_valuation
        FOREIGN KEY (commercial_valuation_id, organisation_id)
        REFERENCES commercial_valuations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_contract_valuations_contract
        FOREIGN KEY (contract_id, organisation_id)
        REFERENCES contracts (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE purchase_order_valuations (
    commercial_valuation_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    purchase_order_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (commercial_valuation_id),
    UNIQUE KEY uq_purchase_order_valuations_context (
        commercial_valuation_id, organisation_id
    ),
    KEY idx_purchase_order_valuations_po (purchase_order_id, organisation_id),

    CONSTRAINT fk_purchase_order_valuations_valuation
        FOREIGN KEY (commercial_valuation_id, organisation_id)
        REFERENCES commercial_valuations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_order_valuations_po
        FOREIGN KEY (purchase_order_id, organisation_id)
        REFERENCES purchase_orders (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_valuation_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    commercial_valuation_id BIGINT UNSIGNED NOT NULL,
    project_cost_code_id BIGINT UNSIGNED NULL,
    line_number INT UNSIGNED NOT NULL,
    description TEXT NOT NULL,
    gross_value_to_date DECIMAL(19,4) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_valuation_items_id_org (id, organisation_id),
    UNIQUE KEY uq_commercial_valuation_items_line (
        organisation_id, commercial_valuation_id, line_number
    ),
    KEY idx_commercial_valuation_items_code (
        project_cost_code_id, organisation_id
    ),

    CONSTRAINT fk_commercial_valuation_items_valuation
        FOREIGN KEY (commercial_valuation_id, organisation_id)
        REFERENCES commercial_valuations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_valuation_items_code
        FOREIGN KEY (project_cost_code_id, organisation_id)
        REFERENCES project_cost_codes (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_commercial_valuation_items_line
        CHECK (line_number > 0),
    CONSTRAINT ck_commercial_valuation_items_value
        CHECK (gross_value_to_date >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_valuation_adjustments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    commercial_valuation_id BIGINT UNSIGNED NOT NULL,
    commercial_valuation_adjustment_type_id SMALLINT UNSIGNED NOT NULL,
    line_number INT UNSIGNED NOT NULL,
    description VARCHAR(500) NULL,
    adjustment_amount DECIMAL(19,4) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_valuation_adjustments_id_org (id, organisation_id),
    UNIQUE KEY uq_commercial_valuation_adjustments_line (
        organisation_id, commercial_valuation_id, line_number
    ),

    CONSTRAINT fk_commercial_valuation_adjustments_valuation
        FOREIGN KEY (commercial_valuation_id, organisation_id)
        REFERENCES commercial_valuations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_valuation_adjustments_type
        FOREIGN KEY (commercial_valuation_adjustment_type_id)
        REFERENCES commercial_valuation_adjustment_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_commercial_valuation_adjustments_line
        CHECK (line_number > 0),
    CONSTRAINT ck_commercial_valuation_adjustments_amount
        CHECK (adjustment_amount <> 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_valuation_information_links (
    commercial_valuation_id BIGINT UNSIGNED NOT NULL,
    valuation_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'evidence',
    linked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (
        commercial_valuation_id,
        information_container_version_id,
        link_role
    ),

    CONSTRAINT fk_commercial_valuation_info_valuation
        FOREIGN KEY (commercial_valuation_id, valuation_organisation_id)
        REFERENCES commercial_valuations (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_commercial_valuation_info_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_commercial_valuation_info_role
        CHECK (link_role IN (
            'evidence', 'application', 'certificate', 'assessment',
            'photo', 'measurement', 'other'
        ))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Commercial reporting periods and point-in-time forecasts
-- -----------------------------------------------------------------------------

CREATE TABLE commercial_reporting_periods (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    period_label VARCHAR(120) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    closed_by_member_id BIGINT UNSIGNED NULL,
    closed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_reporting_periods_public_id (public_id),
    UNIQUE KEY uq_commercial_reporting_periods_id_org (id, organisation_id),
    UNIQUE KEY uq_commercial_reporting_periods_id_project_org (
        id, project_id, organisation_id
    ),
    UNIQUE KEY uq_commercial_reporting_periods_dates (
        organisation_id, project_id, period_start, period_end
    ),
    KEY idx_commercial_reporting_periods_status (
        organisation_id, project_id, lifecycle_status, period_end
    ),

    CONSTRAINT fk_commercial_reporting_periods_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_reporting_periods_closer
        FOREIGN KEY (closed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_commercial_reporting_periods_dates
        CHECK (period_end >= period_start),
    CONSTRAINT ck_commercial_reporting_periods_status
        CHECK (lifecycle_status IN ('open', 'closed', 'reopened')),
    CONSTRAINT ck_commercial_reporting_periods_closed
        CHECK (
            (lifecycle_status = 'closed'
                AND closed_at IS NOT NULL
                AND closed_by_member_id IS NOT NULL)
            OR lifecycle_status <> 'closed'
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_forecasts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    commercial_reporting_period_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    forecast_revenue_amount DECIMAL(19,4) NOT NULL,
    version_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    approved_by_member_id BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    locked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_forecasts_public_id (public_id),
    UNIQUE KEY uq_commercial_forecasts_id_org (id, organisation_id),
    UNIQUE KEY uq_commercial_forecasts_number (
        organisation_id, commercial_reporting_period_id, version_number
    ),
    KEY idx_commercial_forecasts_status (
        organisation_id, project_id, version_status
    ),

    CONSTRAINT fk_commercial_forecasts_period
        FOREIGN KEY (
            commercial_reporting_period_id,
            project_id,
            organisation_id
        ) REFERENCES commercial_reporting_periods (
            id,
            project_id,
            organisation_id
        ) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_forecasts_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_forecasts_approver
        FOREIGN KEY (approved_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_commercial_forecasts_number
        CHECK (version_number > 0),
    CONSTRAINT ck_commercial_forecasts_revenue
        CHECK (forecast_revenue_amount >= 0),
    CONSTRAINT ck_commercial_forecasts_status
        CHECK (version_status IN ('draft', 'approved', 'superseded', 'cancelled')),
    CONSTRAINT ck_commercial_forecasts_approval
        CHECK (
            (version_status = 'draft'
                AND approved_at IS NULL
                AND approved_by_member_id IS NULL
                AND locked_at IS NULL)
            OR
            (version_status IN ('approved', 'superseded')
                AND approved_at IS NOT NULL
                AND approved_by_member_id IS NOT NULL
                AND locked_at IS NOT NULL)
            OR version_status = 'cancelled'
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE commercial_forecast_lines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    commercial_forecast_id BIGINT UNSIGNED NOT NULL,
    project_cost_code_id BIGINT UNSIGNED NOT NULL,
    control_budget_snapshot DECIMAL(19,4) NOT NULL,
    actual_cost_snapshot DECIMAL(19,4) NOT NULL,
    remaining_commitment_snapshot DECIMAL(19,4) NOT NULL,
    approved_change_snapshot DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    pending_change_exposure_snapshot DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    forecast_to_complete_amount DECIMAL(19,4) NOT NULL,
    commentary VARCHAR(2000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_forecast_lines_id_org (id, organisation_id),
    UNIQUE KEY uq_commercial_forecast_lines_code (
        organisation_id, commercial_forecast_id, project_cost_code_id
    ),
    KEY idx_commercial_forecast_lines_cost_code (
        project_cost_code_id, organisation_id
    ),

    CONSTRAINT fk_commercial_forecast_lines_forecast
        FOREIGN KEY (commercial_forecast_id, organisation_id)
        REFERENCES commercial_forecasts (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_commercial_forecast_lines_cost_code
        FOREIGN KEY (project_cost_code_id, organisation_id)
        REFERENCES project_cost_codes (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_commercial_forecast_lines_nonnegative
        CHECK (
            control_budget_snapshot >= 0
            AND actual_cost_snapshot >= 0
            AND remaining_commitment_snapshot >= 0
            AND forecast_to_complete_amount >= 0
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Initial controlled reference values
-- -----------------------------------------------------------------------------

INSERT INTO commercial_cost_categories (code, name) VALUES
    ('labour', 'Labour'),
    ('material', 'Materials'),
    ('plant', 'Plant / equipment'),
    ('subcontract', 'Subcontract'),
    ('professional_fee', 'Professional fee'),
    ('overhead', 'Overhead'),
    ('preliminaries', 'Preliminaries'),
    ('contingency', 'Contingency'),
    ('other', 'Other');

INSERT INTO commercial_adjustment_types (code, name) VALUES
    ('approved_variation', 'Approved variation'),
    ('budget_transfer', 'Budget transfer'),
    ('contingency_release', 'Contingency release'),
    ('correction', 'Authorised correction'),
    ('reallocation', 'Budget reallocation'),
    ('other', 'Other');

INSERT INTO commercial_variation_types (code, name) VALUES
    ('client_change', 'Client / upstream change'),
    ('supplier_change', 'Supplier / downstream change'),
    ('design_change', 'Design change'),
    ('site_condition', 'Site condition'),
    ('instruction', 'Instruction-driven change'),
    ('scope_clarification', 'Scope clarification'),
    ('claim', 'Claim / commercial notice'),
    ('internal_change', 'Internal commercial change'),
    ('other', 'Other');

INSERT INTO commercial_valuation_adjustment_types (code, name) VALUES
    ('retention', 'Retention'),
    ('contra_charge', 'Contra charge'),
    ('materials_on_site', 'Materials on site'),
    ('advance_recovery', 'Advance payment recovery'),
    ('prior_adjustment', 'Prior-period adjustment'),
    ('other', 'Other');

-- -----------------------------------------------------------------------------
-- Required application invariants not completely expressible as simple MySQL FKs
-- -----------------------------------------------------------------------------
-- 1. Project cost-code parent hierarchies must be acyclic.
-- 2. Budget lines and their cost codes must belong to the same project as the budget.
-- 3. Approved/superseded project_budget_versions and their lines are immutable.
-- 4. Estimate sources linked to a budget line must relate to the same commercial project context.
-- 5. An issued/current PO item's active cost allocations must reconcile to its authoritative
--    quantity * unit_rate net value under the organisation rounding policy.
-- 6. PO items allocated to a project cost code must belong to a PO for that same project.
-- 7. A timesheet cost allocation must reference a snapshot whose timesheet entry is posted to
--    the same project as the project cost code; allocations must reconcile to snapshot cost.
-- 8. A financial-document item value allocation must reference a financial document for the
--    same project; allocations must reconcile to authoritative line net value.
-- 9. Credit-note value is signed negative in reporting based on source document_kind rather
--    than by mutating allocation amounts.
-- 10. Posted project_direct_costs are immutable. Aggregate reversal_amount must never exceed
--     the posted direct-cost amount; corrections use new reversal records.
-- 11. source_system/source_reference direct-cost imports require idempotent import handling.
-- 12. contract_variations are valid only for revenue-side variations and the contract must
--     belong to the same project; purchase_order_variations are valid only for cost-side
--     variations and the PO must belong to the same project. Internal variations normally
--     have neither subtype.
-- 13. Variation change-event links must not cross projects, even where both individual FKs
--     are valid.
-- 14. Issued/superseded/withdrawn variation versions and items are immutable.
-- 15. Variation decision items must belong to the same variation version as their decision.
-- 16. Accepted/partially accepted decision totals must reconcile to decision items when
--     line-level decisions are recorded.
-- 17. Contract-amendment / PO-version implementation links must belong to the same project
--     and commercial context as the variation.
-- 18. Budget adjustments sourced from a variation must belong to the same project/budget.
-- 19. Internal budget-transfer adjustments must satisfy configured balancing policy,
--     normally netting to zero across their adjustment items.
-- 20. Valuation source_application_id must reference an application kind for the same
--     project/context; certification never overwrites the application.
-- 21. Client valuation kinds use contract_valuations; supplier valuation kinds use
--     purchase_order_valuations; internal assessments normally use neither.
-- 22. Valuation cost codes and explicit information links must remain within the same
--     project and effective visibility scope.
-- 23. Current-period valuation movement is derived from cumulative valuation facts and
--     prior effective valuation/certification history.
-- 24. Closed reporting periods require privileged explicit reopening.
-- 25. Approved/superseded forecasts and forecast lines are immutable.
-- 26. Forecast line snapshots are created from one coherent cut-off; they are historical
--     reporting facts, not competing live balances.
-- 27. Forecast final cost = actual_cost_snapshot + forecast_to_complete_amount.
--     remaining_commitment_snapshot is context and must not be double counted where FTC
--     already includes the remaining commitment.
-- 28. Project-level forecast margin is derived from forecast_revenue_amount and the sum of
--     forecast final cost across forecast lines.
-- 29. Commercial visibility is independent from ordinary project participation. Budget,
--     worker-cost, supplier-rate, margin, valuation and forecast data require dedicated
--     effective permissions.
-- 30. All privileged issue/approval/close/reopen/reversal transitions write audit/outbox
--     evidence transactionally where practicable.
