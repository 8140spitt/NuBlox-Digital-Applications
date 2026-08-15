-- NuBlox: Digital Applications
-- Schema package 003: Sales, Estimates, Quotations and Proposals
-- Depends on: 001-platform-kernel.sql, 002-crm-parties.sql
-- Target: MySQL 8.4 / InnoDB
-- Design target: 3NF by default
-- Generated: 2026-08-15
--
-- PRINCIPLES:
-- 1. Logical estimates/quotations are separate from their versions.
-- 2. Internal estimate cost build-up is separate from customer-facing output lines.
-- 3. Issued quotation versions are immutable through normal application writes.
-- 4. Customer/address/tax facts required to reproduce an issued document are snapshots.
-- 5. Ordinary quotation totals are derived, not duplicated on the quotation header.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Strengthen the existing project tenant key so later commercial records can prove
-- that a referenced project belongs to the same owning organisation.
ALTER TABLE projects
    ADD UNIQUE KEY uq_projects_id_owning_organisation (id, owning_organisation_id);

-- -----------------------------------------------------------------------------
-- Global commercial reference data
-- -----------------------------------------------------------------------------

CREATE TABLE units_of_measure (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(120) NOT NULL,
    symbol VARCHAR(32) NULL,
    measurement_kind VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_units_of_measure_code (code),
    CONSTRAINT ck_units_of_measure_kind
        CHECK (measurement_kind IN (
            'count', 'time', 'length', 'area', 'volume',
            'mass', 'liquid_volume', 'lump_sum', 'other'
        ))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE sales_item_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(120) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_sales_item_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Tenant tax reference data
-- -----------------------------------------------------------------------------

CREATE TABLE tax_categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    code VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    treatment VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'taxable',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_tax_categories_public_id (public_id),
    UNIQUE KEY uq_tax_categories_id_organisation (id, organisation_id),
    UNIQUE KEY uq_tax_categories_code (organisation_id, code),

    CONSTRAINT fk_tax_categories_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_tax_categories_treatment
        CHECK (treatment IN ('taxable', 'zero', 'exempt', 'outside_scope'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE tax_category_rates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    tax_category_id BIGINT UNSIGNED NOT NULL,
    rate_percent DECIMAL(9,4) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_tax_category_rates_start (
        organisation_id,
        tax_category_id,
        valid_from
    ),
    KEY idx_tax_category_rates_effective (
        organisation_id,
        tax_category_id,
        valid_from,
        valid_to
    ),

    CONSTRAINT fk_tax_category_rates_category
        FOREIGN KEY (tax_category_id, organisation_id)
        REFERENCES tax_categories (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_tax_category_rates_rate
        CHECK (rate_percent >= 0.0000 AND rate_percent <= 100.0000),
    CONSTRAINT ck_tax_category_rates_dates
        CHECK (valid_to IS NULL OR valid_to >= valid_from)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Optional tenant sales catalogue
-- -----------------------------------------------------------------------------

CREATE TABLE sales_catalog_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    sales_item_type_id SMALLINT UNSIGNED NOT NULL,
    unit_of_measure_id SMALLINT UNSIGNED NULL,
    default_tax_category_id BIGINT UNSIGNED NULL,
    sku VARCHAR(120) NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_sales_catalog_items_public_id (public_id),
    UNIQUE KEY uq_sales_catalog_items_id_organisation (id, organisation_id),
    UNIQUE KEY uq_sales_catalog_items_sku (organisation_id, sku),
    KEY idx_sales_catalog_items_type (organisation_id, sales_item_type_id, is_active),
    KEY idx_sales_catalog_items_tax (default_tax_category_id, organisation_id),

    CONSTRAINT fk_sales_catalog_items_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_sales_catalog_items_type
        FOREIGN KEY (sales_item_type_id)
        REFERENCES sales_item_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_sales_catalog_items_unit
        FOREIGN KEY (unit_of_measure_id)
        REFERENCES units_of_measure (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_sales_catalog_items_tax_category
        FOREIGN KEY (default_tax_category_id, organisation_id)
        REFERENCES tax_categories (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE sales_catalog_item_prices (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    sales_catalog_item_id BIGINT UNSIGNED NOT NULL,
    price_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_sales_catalog_item_prices_start (
        organisation_id,
        sales_catalog_item_id,
        price_type,
        currency_code,
        valid_from
    ),
    KEY idx_sales_catalog_item_prices_effective (
        organisation_id,
        sales_catalog_item_id,
        price_type,
        currency_code,
        valid_from,
        valid_to
    ),

    CONSTRAINT fk_sales_catalog_item_prices_item
        FOREIGN KEY (sales_catalog_item_id, organisation_id)
        REFERENCES sales_catalog_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_sales_catalog_item_prices_type
        CHECK (price_type IN ('cost', 'sell')),
    CONSTRAINT ck_sales_catalog_item_prices_amount
        CHECK (amount >= 0),
    CONSTRAINT ck_sales_catalog_item_prices_dates
        CHECK (valid_to IS NULL OR valid_to >= valid_from)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Estimates
-- -----------------------------------------------------------------------------

CREATE TABLE estimates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    estimate_number VARCHAR(80) NOT NULL,
    opportunity_id BIGINT UNSIGNED NULL,
    project_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_estimates_public_id (public_id),
    UNIQUE KEY uq_estimates_number (organisation_id, estimate_number),
    UNIQUE KEY uq_estimates_id_organisation (id, organisation_id),
    KEY idx_estimates_opportunity (opportunity_id, organisation_id),
    KEY idx_estimates_project (project_id, organisation_id),
    KEY idx_estimates_creator (created_by_member_id, organisation_id),

    CONSTRAINT fk_estimates_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_estimates_opportunity
        FOREIGN KEY (opportunity_id, organisation_id)
        REFERENCES opportunities (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_estimates_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_estimates_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_estimates_lifecycle
        CHECK (lifecycle_status IN ('active', 'cancelled', 'archived'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE estimate_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    estimate_id BIGINT UNSIGNED NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    version_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    finalised_by_member_id BIGINT UNSIGNED NULL,
    finalised_at DATETIME(6) NULL,
    notes TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_estimate_versions_number (organisation_id, estimate_id, version_number),
    UNIQUE KEY uq_estimate_versions_id_organisation (id, organisation_id),
    KEY idx_estimate_versions_status (organisation_id, estimate_id, version_status),
    KEY idx_estimate_versions_creator (created_by_member_id, organisation_id),
    KEY idx_estimate_versions_finaliser (finalised_by_member_id, organisation_id),

    CONSTRAINT fk_estimate_versions_estimate
        FOREIGN KEY (estimate_id, organisation_id)
        REFERENCES estimates (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_estimate_versions_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_estimate_versions_finaliser
        FOREIGN KEY (finalised_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_estimate_versions_number
        CHECK (version_number > 0),
    CONSTRAINT ck_estimate_versions_status
        CHECK (version_status IN ('draft', 'final', 'superseded')),
    CONSTRAINT ck_estimate_versions_finalised
        CHECK (
            (version_status = 'draft' AND finalised_at IS NULL AND finalised_by_member_id IS NULL)
            OR
            (version_status IN ('final', 'superseded') AND finalised_at IS NOT NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE estimate_sections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    estimate_version_id BIGINT UNSIGNED NOT NULL,
    heading VARCHAR(255) NOT NULL,
    description TEXT NULL,
    sort_order INT UNSIGNED NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_estimate_sections_id_context (id, organisation_id, estimate_version_id),
    UNIQUE KEY uq_estimate_sections_sort (organisation_id, estimate_version_id, sort_order),

    CONSTRAINT fk_estimate_sections_version
        FOREIGN KEY (estimate_version_id, organisation_id)
        REFERENCES estimate_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE estimate_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    estimate_version_id BIGINT UNSIGNED NOT NULL,
    estimate_section_id BIGINT UNSIGNED NULL,
    sales_item_type_id SMALLINT UNSIGNED NOT NULL,
    sales_catalog_item_id BIGINT UNSIGNED NULL,
    unit_of_measure_id SMALLINT UNSIGNED NULL,
    line_number INT UNSIGNED NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(19,6) NOT NULL,
    sell_unit_rate DECIMAL(19,4) NOT NULL,
    is_optional BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_estimate_items_id_context (id, organisation_id, estimate_version_id),
    UNIQUE KEY uq_estimate_items_line (organisation_id, estimate_version_id, line_number),
    KEY idx_estimate_items_section (estimate_section_id, organisation_id, estimate_version_id),
    KEY idx_estimate_items_catalog (sales_catalog_item_id, organisation_id),

    CONSTRAINT fk_estimate_items_version
        FOREIGN KEY (estimate_version_id, organisation_id)
        REFERENCES estimate_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_estimate_items_section
        FOREIGN KEY (estimate_section_id, organisation_id, estimate_version_id)
        REFERENCES estimate_sections (id, organisation_id, estimate_version_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_estimate_items_type
        FOREIGN KEY (sales_item_type_id)
        REFERENCES sales_item_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_estimate_items_catalog
        FOREIGN KEY (sales_catalog_item_id, organisation_id)
        REFERENCES sales_catalog_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_estimate_items_unit
        FOREIGN KEY (unit_of_measure_id)
        REFERENCES units_of_measure (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_estimate_items_line_number
        CHECK (line_number > 0),
    CONSTRAINT ck_estimate_items_quantity
        CHECK (quantity > 0),
    CONSTRAINT ck_estimate_items_sell_rate
        CHECK (sell_unit_rate >= 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE estimate_item_cost_components (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    estimate_item_id BIGINT UNSIGNED NOT NULL,
    estimate_version_id BIGINT UNSIGNED NOT NULL,
    sales_item_type_id SMALLINT UNSIGNED NOT NULL,
    sales_catalog_item_id BIGINT UNSIGNED NULL,
    unit_of_measure_id SMALLINT UNSIGNED NULL,
    sort_order INT UNSIGNED NOT NULL,
    description VARCHAR(500) NOT NULL,
    quantity DECIMAL(19,6) NOT NULL,
    unit_cost DECIMAL(19,4) NOT NULL,
    waste_percent DECIMAL(9,4) NOT NULL DEFAULT 0.0000,
    markup_percent DECIMAL(9,4) NOT NULL DEFAULT 0.0000,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_estimate_cost_components_sort (
        organisation_id,
        estimate_item_id,
        sort_order
    ),
    KEY idx_estimate_cost_components_catalog (sales_catalog_item_id, organisation_id),

    CONSTRAINT fk_estimate_cost_components_item
        FOREIGN KEY (estimate_item_id, organisation_id, estimate_version_id)
        REFERENCES estimate_items (id, organisation_id, estimate_version_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_estimate_cost_components_type
        FOREIGN KEY (sales_item_type_id)
        REFERENCES sales_item_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_estimate_cost_components_catalog
        FOREIGN KEY (sales_catalog_item_id, organisation_id)
        REFERENCES sales_catalog_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_estimate_cost_components_unit
        FOREIGN KEY (unit_of_measure_id)
        REFERENCES units_of_measure (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_estimate_cost_components_quantity
        CHECK (quantity >= 0),
    CONSTRAINT ck_estimate_cost_components_unit_cost
        CHECK (unit_cost >= 0),
    CONSTRAINT ck_estimate_cost_components_waste
        CHECK (waste_percent >= 0.0000 AND waste_percent <= 100.0000),
    CONSTRAINT ck_estimate_cost_components_markup
        CHECK (markup_percent >= 0.0000)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Logical quotations and versions
-- -----------------------------------------------------------------------------

CREATE TABLE quotations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    quotation_number VARCHAR(80) NOT NULL,
    opportunity_id BIGINT UNSIGNED NULL,
    project_id BIGINT UNSIGNED NULL,
    customer_party_id BIGINT UNSIGNED NOT NULL,
    primary_contact_party_id BIGINT UNSIGNED NULL,
    owner_member_id BIGINT UNSIGNED NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_quotations_public_id (public_id),
    UNIQUE KEY uq_quotations_number (organisation_id, quotation_number),
    UNIQUE KEY uq_quotations_id_organisation (id, organisation_id),
    KEY idx_quotations_opportunity (opportunity_id, organisation_id),
    KEY idx_quotations_project (project_id, organisation_id),
    KEY idx_quotations_customer (customer_party_id, organisation_id),
    KEY idx_quotations_owner (owner_member_id, organisation_id),

    CONSTRAINT fk_quotations_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotations_opportunity
        FOREIGN KEY (opportunity_id, organisation_id)
        REFERENCES opportunities (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotations_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotations_customer
        FOREIGN KEY (customer_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotations_primary_contact
        FOREIGN KEY (primary_contact_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotations_owner
        FOREIGN KEY (owner_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_quotations_lifecycle
        CHECK (lifecycle_status IN ('active', 'cancelled', 'archived'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quotation_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    quotation_id BIGINT UNSIGNED NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    customer_reference VARCHAR(160) NULL,
    valid_until DATE NULL,
    version_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    locked_by_member_id BIGINT UNSIGNED NULL,
    locked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_quotation_versions_number (organisation_id, quotation_id, version_number),
    UNIQUE KEY uq_quotation_versions_id_organisation (id, organisation_id),
    UNIQUE KEY uq_quotation_versions_id_quote_context (id, organisation_id, quotation_id),
    KEY idx_quotation_versions_status (organisation_id, quotation_id, version_status),
    KEY idx_quotation_versions_creator (created_by_member_id, organisation_id),
    KEY idx_quotation_versions_locker (locked_by_member_id, organisation_id),

    CONSTRAINT fk_quotation_versions_quotation
        FOREIGN KEY (quotation_id, organisation_id)
        REFERENCES quotations (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_versions_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_versions_locker
        FOREIGN KEY (locked_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_quotation_versions_number
        CHECK (version_number > 0),
    CONSTRAINT ck_quotation_versions_status
        CHECK (version_status IN ('draft', 'issued', 'superseded', 'withdrawn')),
    CONSTRAINT ck_quotation_versions_lock
        CHECK (
            (version_status = 'draft' AND locked_at IS NULL AND locked_by_member_id IS NULL)
            OR
            (version_status IN ('issued', 'superseded', 'withdrawn') AND locked_at IS NOT NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quotation_version_estimates (
    organisation_id BIGINT UNSIGNED NOT NULL,
    quotation_version_id BIGINT UNSIGNED NOT NULL,
    estimate_version_id BIGINT UNSIGNED NOT NULL,
    sort_order INT UNSIGNED NOT NULL,
    linked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (organisation_id, quotation_version_id, estimate_version_id),
    UNIQUE KEY uq_quotation_version_estimates_sort (
        organisation_id,
        quotation_version_id,
        sort_order
    ),

    CONSTRAINT fk_quotation_version_estimates_quote_version
        FOREIGN KEY (quotation_version_id, organisation_id)
        REFERENCES quotation_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_version_estimates_estimate_version
        FOREIGN KEY (estimate_version_id, organisation_id)
        REFERENCES estimate_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quotation_sections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    quotation_version_id BIGINT UNSIGNED NOT NULL,
    heading VARCHAR(255) NOT NULL,
    description TEXT NULL,
    sort_order INT UNSIGNED NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_quotation_sections_id_context (id, organisation_id, quotation_version_id),
    UNIQUE KEY uq_quotation_sections_sort (organisation_id, quotation_version_id, sort_order),

    CONSTRAINT fk_quotation_sections_version
        FOREIGN KEY (quotation_version_id, organisation_id)
        REFERENCES quotation_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quotation_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    quotation_version_id BIGINT UNSIGNED NOT NULL,
    quotation_section_id BIGINT UNSIGNED NULL,
    source_estimate_item_id BIGINT UNSIGNED NULL,
    sales_item_type_id SMALLINT UNSIGNED NOT NULL,
    sales_catalog_item_id BIGINT UNSIGNED NULL,
    unit_of_measure_id SMALLINT UNSIGNED NULL,
    line_number INT UNSIGNED NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(19,6) NOT NULL,
    unit_rate DECIMAL(19,4) NOT NULL,
    is_optional BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_quotation_items_id_organisation (id, organisation_id),
    UNIQUE KEY uq_quotation_items_line (organisation_id, quotation_version_id, line_number),
    KEY idx_quotation_items_section (
        quotation_section_id,
        organisation_id,
        quotation_version_id
    ),
    KEY idx_quotation_items_source_estimate (source_estimate_item_id, organisation_id),
    KEY idx_quotation_items_catalog (sales_catalog_item_id, organisation_id),

    CONSTRAINT fk_quotation_items_version
        FOREIGN KEY (quotation_version_id, organisation_id)
        REFERENCES quotation_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_items_section
        FOREIGN KEY (quotation_section_id, organisation_id, quotation_version_id)
        REFERENCES quotation_sections (id, organisation_id, quotation_version_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_items_source_estimate
        FOREIGN KEY (source_estimate_item_id, organisation_id)
        REFERENCES estimate_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_items_type
        FOREIGN KEY (sales_item_type_id)
        REFERENCES sales_item_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_items_catalog
        FOREIGN KEY (sales_catalog_item_id, organisation_id)
        REFERENCES sales_catalog_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_items_unit
        FOREIGN KEY (unit_of_measure_id)
        REFERENCES units_of_measure (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_quotation_items_line_number
        CHECK (line_number > 0),
    CONSTRAINT ck_quotation_items_quantity
        CHECK (quantity > 0),
    CONSTRAINT ck_quotation_items_unit_rate
        CHECK (unit_rate >= 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quotation_item_taxes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    quotation_item_id BIGINT UNSIGNED NOT NULL,
    tax_category_id BIGINT UNSIGNED NOT NULL,
    applied_rate_percent DECIMAL(9,4) NOT NULL,
    taxable_amount DECIMAL(19,4) NOT NULL,
    tax_amount DECIMAL(19,4) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_quotation_item_taxes_category (
        organisation_id,
        quotation_item_id,
        tax_category_id
    ),
    UNIQUE KEY uq_quotation_item_taxes_sort (
        organisation_id,
        quotation_item_id,
        sort_order
    ),

    CONSTRAINT fk_quotation_item_taxes_item
        FOREIGN KEY (quotation_item_id, organisation_id)
        REFERENCES quotation_items (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_item_taxes_category
        FOREIGN KEY (tax_category_id, organisation_id)
        REFERENCES tax_categories (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_quotation_item_taxes_rate
        CHECK (applied_rate_percent >= 0.0000 AND applied_rate_percent <= 100.0000),
    CONSTRAINT ck_quotation_item_taxes_amounts
        CHECK (taxable_amount >= 0 AND tax_amount >= 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quotation_text_blocks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    quotation_version_id BIGINT UNSIGNED NOT NULL,
    block_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    sort_order INT UNSIGNED NOT NULL,
    heading VARCHAR(255) NULL,
    body TEXT NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_quotation_text_blocks_sort (
        organisation_id,
        quotation_version_id,
        block_type,
        sort_order
    ),

    CONSTRAINT fk_quotation_text_blocks_version
        FOREIGN KEY (quotation_version_id, organisation_id)
        REFERENCES quotation_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_quotation_text_blocks_type
        CHECK (block_type IN (
            'scope', 'assumption', 'exclusion',
            'clarification', 'term', 'note'
        ))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Version-specific customer/contact snapshots
-- -----------------------------------------------------------------------------

CREATE TABLE quotation_party_snapshots (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    quotation_version_id BIGINT UNSIGNED NOT NULL,
    source_party_id BIGINT UNSIGNED NULL,
    snapshot_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(320) NULL,
    phone VARCHAR(64) NULL,
    reference_identifier VARCHAR(200) NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_quotation_party_snapshots_id_context (
        id,
        organisation_id,
        quotation_version_id
    ),
    UNIQUE KEY uq_quotation_party_snapshots_order (
        organisation_id,
        quotation_version_id,
        snapshot_role,
        sort_order
    ),
    KEY idx_quotation_party_snapshots_source (source_party_id, organisation_id),

    CONSTRAINT fk_quotation_party_snapshots_version
        FOREIGN KEY (quotation_version_id, organisation_id)
        REFERENCES quotation_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_party_snapshots_source_party
        FOREIGN KEY (source_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_quotation_party_snapshots_role
        CHECK (snapshot_role IN ('customer', 'contact', 'billing', 'attention', 'other'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quotation_party_snapshot_addresses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    quotation_party_snapshot_id BIGINT UNSIGNED NOT NULL,
    quotation_version_id BIGINT UNSIGNED NOT NULL,
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
    UNIQUE KEY uq_quotation_party_snapshot_addresses_role (
        organisation_id,
        quotation_party_snapshot_id,
        address_role
    ),

    CONSTRAINT fk_quotation_party_snapshot_addresses_snapshot
        FOREIGN KEY (
            quotation_party_snapshot_id,
            organisation_id,
            quotation_version_id
        )
        REFERENCES quotation_party_snapshots (
            id,
            organisation_id,
            quotation_version_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Issue events and recipients
-- -----------------------------------------------------------------------------

CREATE TABLE quotation_issue_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    quotation_version_id BIGINT UNSIGNED NOT NULL,
    issue_sequence INT UNSIGNED NOT NULL,
    issued_by_member_id BIGINT UNSIGNED NOT NULL,
    delivery_channel VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    issued_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    note VARCHAR(1000) NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_quotation_issue_events_id_context (
        id,
        organisation_id,
        quotation_version_id
    ),
    UNIQUE KEY uq_quotation_issue_events_sequence (
        organisation_id,
        quotation_version_id,
        issue_sequence
    ),
    KEY idx_quotation_issue_events_issued_by (issued_by_member_id, organisation_id),

    CONSTRAINT fk_quotation_issue_events_version
        FOREIGN KEY (quotation_version_id, organisation_id)
        REFERENCES quotation_versions (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_issue_events_member
        FOREIGN KEY (issued_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_quotation_issue_events_sequence
        CHECK (issue_sequence > 0),
    CONSTRAINT ck_quotation_issue_events_channel
        CHECK (delivery_channel IN ('email', 'portal', 'manual', 'api', 'other'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quotation_issue_recipients (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    quotation_issue_event_id BIGINT UNSIGNED NOT NULL,
    quotation_version_id BIGINT UNSIGNED NOT NULL,
    source_party_id BIGINT UNSIGNED NULL,
    recipient_name VARCHAR(255) NULL,
    recipient_email VARCHAR(320) NULL,
    delivery_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    delivered_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY idx_quotation_issue_recipients_issue (
        organisation_id,
        quotation_issue_event_id
    ),
    KEY idx_quotation_issue_recipients_party (source_party_id, organisation_id),

    CONSTRAINT fk_quotation_issue_recipients_issue
        FOREIGN KEY (
            quotation_issue_event_id,
            organisation_id,
            quotation_version_id
        )
        REFERENCES quotation_issue_events (
            id,
            organisation_id,
            quotation_version_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_issue_recipients_party
        FOREIGN KEY (source_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_quotation_issue_recipients_identity
        CHECK (
            source_party_id IS NOT NULL
            OR recipient_name IS NOT NULL
            OR recipient_email IS NOT NULL
        ),
    CONSTRAINT ck_quotation_issue_recipients_status
        CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'acknowledged')),
    CONSTRAINT ck_quotation_issue_recipients_delivered
        CHECK (
            delivered_at IS NULL
            OR delivery_status IN ('delivered', 'acknowledged')
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Customer responses and conversion to project/job
-- -----------------------------------------------------------------------------

CREATE TABLE quotation_responses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    quotation_id BIGINT UNSIGNED NOT NULL,
    quotation_version_id BIGINT UNSIGNED NOT NULL,
    quotation_issue_event_id BIGINT UNSIGNED NULL,
    response_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    responded_at DATETIME(6) NOT NULL,
    responding_party_id BIGINT UNSIGNED NULL,
    respondent_name VARCHAR(255) NULL,
    respondent_email VARCHAR(320) NULL,
    recorded_by_member_id BIGINT UNSIGNED NULL,
    notes TEXT NULL,
    accepted_quotation_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE WHEN response_type = 'accepted' THEN quotation_id ELSE NULL END
        ) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_quotation_responses_public_id (public_id),
    UNIQUE KEY uq_quotation_responses_id_organisation (id, organisation_id),
    UNIQUE KEY uq_quotation_responses_one_acceptance (
        organisation_id,
        accepted_quotation_id
    ),
    KEY idx_quotation_responses_quote (
        organisation_id,
        quotation_id,
        responded_at
    ),
    KEY idx_quotation_responses_version (
        organisation_id,
        quotation_version_id,
        responded_at
    ),
    KEY idx_quotation_responses_party (responding_party_id, organisation_id),
    KEY idx_quotation_responses_recorder (recorded_by_member_id, organisation_id),

    CONSTRAINT fk_quotation_responses_quotation_version
        FOREIGN KEY (quotation_version_id, organisation_id, quotation_id)
        REFERENCES quotation_versions (id, organisation_id, quotation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_responses_issue_event
        FOREIGN KEY (
            quotation_issue_event_id,
            organisation_id,
            quotation_version_id
        )
        REFERENCES quotation_issue_events (
            id,
            organisation_id,
            quotation_version_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_responses_party
        FOREIGN KEY (responding_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_responses_recorder
        FOREIGN KEY (recorded_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_quotation_responses_type
        CHECK (response_type IN (
            'accepted', 'rejected', 'revision_requested', 'withdrawn_by_customer'
        )),
    CONSTRAINT ck_quotation_responses_identity
        CHECK (
            responding_party_id IS NOT NULL
            OR respondent_name IS NOT NULL
            OR respondent_email IS NOT NULL
            OR recorded_by_member_id IS NOT NULL
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quotation_project_conversions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    quotation_response_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_quotation_project_conversions_response (
        organisation_id,
        quotation_response_id
    ),
    UNIQUE KEY uq_quotation_project_conversions_project (
        organisation_id,
        project_id
    ),

    CONSTRAINT fk_quotation_project_conversions_response
        FOREIGN KEY (quotation_response_id, organisation_id)
        REFERENCES quotation_responses (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_project_conversions_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_project_conversions_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Initial global reference values
-- -----------------------------------------------------------------------------

INSERT INTO units_of_measure (code, name, symbol, measurement_kind) VALUES
    ('item', 'Item', 'ea', 'count'),
    ('hour', 'Hour', 'h', 'time'),
    ('day', 'Day', 'd', 'time'),
    ('metre', 'Metre', 'm', 'length'),
    ('square_metre', 'Square metre', 'm²', 'area'),
    ('cubic_metre', 'Cubic metre', 'm³', 'volume'),
    ('kilogram', 'Kilogram', 'kg', 'mass'),
    ('tonne', 'Tonne', 't', 'mass'),
    ('litre', 'Litre', 'L', 'liquid_volume'),
    ('lump_sum', 'Lump sum', 'LS', 'lump_sum');

INSERT INTO sales_item_types (code, name) VALUES
    ('labour', 'Labour'),
    ('material', 'Material'),
    ('plant', 'Plant'),
    ('subcontract', 'Subcontract'),
    ('service', 'Service'),
    ('professional_fee', 'Professional fee'),
    ('other', 'Other');

-- -----------------------------------------------------------------------------
-- Required application invariants not completely expressible as simple FKs
-- -----------------------------------------------------------------------------
--
-- 1. tax_category_rates for one category must not have overlapping effective periods.
-- 2. sales_catalog_item_prices for one item/price-type/currency must not overlap.
-- 3. party subtype rules must be respected: quotation primary contacts are normally
--    person parties even though the relational FK correctly targets the party supertype.
-- 4. final/superseded estimate versions are immutable through normal write APIs.
-- 5. issued/superseded/withdrawn quotation versions are immutable through normal writes.
-- 6. issuing a quotation version must atomically:
--       a. validate decimal calculations and tax snapshots;
--       b. create required party/address snapshots;
--       c. lock the version;
--       d. create quotation_issue_events/recipients;
--       e. write audit/outbox events.
-- 7. quotation_responses.response_type='accepted' requires an issued/locked version.
-- 8. quotation_response acceptance uniqueness must be handled safely under concurrency;
--    the database unique key is the final integrity guard.
-- 9. quotation_project_conversions may reference only an accepted response.
-- 10. conversion must be transactional/idempotent and must not create duplicate projects.
-- 11. quotation item totals and quotation totals use decimal arithmetic only. Binary
--     floating-point is forbidden for authoritative monetary calculation.
-- 12. optional quote items are excluded/included according to explicit customer selection
--     policy; that selection model will be added when option-selection UX is finalised.
-- 13. no issued quotation may be recomputed from mutable catalogue prices or current tax
--     rates. The version line/tax snapshots are authoritative.
