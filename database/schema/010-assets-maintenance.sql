-- NuBlox: Digital Applications
-- Schema package 010: Assets and Maintenance
-- Depends on: 001-platform-kernel.sql through 009-commercial-cost-control.sql
-- Target: MySQL 8.4 / InnoDB
-- Design target: 3NF by default
-- Generated: 2026-08-15
--
-- PRINCIPLES:
-- 1. Facilities and assets are long-lived operational records and may outlive any project.
-- 2. Projects contribute to facilities through explicit links; they do not own the full asset lifecycle.
-- 3. Building/space/system/asset identity is relational; no generic EAV asset master is introduced.
-- 4. Controlled information, labour, procurement and quality facts remain authoritative in source domains.
-- 5. Maintenance requests, work orders, service events and compliance events are separate auditable facts.
-- 6. Current warranty/compliance/due-state measures are derived from dates, rules and event evidence.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
-- Global controlled reference data
-- -----------------------------------------------------------------------------

CREATE TABLE asset_categories (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_categories_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE asset_identifier_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_identifier_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE warranty_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_warranty_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE meter_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_cumulative BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_meter_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE maintenance_plan_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_maintenance_plan_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE work_order_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_work_order_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE maintenance_priority_levels (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(120) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    target_response_minutes INT UNSIGNED NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_maintenance_priority_levels_code (code),
    UNIQUE KEY uq_maintenance_priority_levels_sort (sort_order),
    CONSTRAINT ck_maintenance_priority_levels_sort CHECK (sort_order > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE service_event_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_service_event_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE compliance_requirement_categories (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_compliance_requirement_categories_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Facilities and project relationships
-- -----------------------------------------------------------------------------

CREATE TABLE facilities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    facility_code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    address_id BIGINT UNSIGNED NULL,
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    operational_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    commissioned_on DATE NULL,
    opened_on DATE NULL,
    decommissioned_on DATE NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_facilities_public_id (public_id),
    UNIQUE KEY uq_facilities_id_org (id, organisation_id),
    UNIQUE KEY uq_facilities_code (organisation_id, facility_code),
    KEY idx_facilities_status (organisation_id, operational_status, name),
    KEY idx_facilities_address (address_id, organisation_id),
    CONSTRAINT fk_facilities_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_facilities_address
        FOREIGN KEY (address_id, organisation_id)
        REFERENCES addresses (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_facilities_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_facilities_status
        CHECK (operational_status IN ('planned', 'active', 'inactive', 'decommissioned', 'archived')),
    CONSTRAINT ck_facilities_dates
        CHECK (
            (opened_on IS NULL OR commissioned_on IS NULL OR opened_on >= commissioned_on)
            AND (decommissioned_on IS NULL OR commissioned_on IS NULL OR decommissioned_on >= commissioned_on)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE facility_project_links (
    organisation_id BIGINT UNSIGNED NOT NULL,
    facility_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    linked_on DATE NULL,
    ended_on DATE NULL,
    linked_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (organisation_id, facility_id, project_id, link_role),
    KEY idx_facility_project_links_project (project_id, organisation_id),
    CONSTRAINT fk_facility_project_links_facility
        FOREIGN KEY (facility_id, organisation_id)
        REFERENCES facilities (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_facility_project_links_participant
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_facility_project_links_member
        FOREIGN KEY (linked_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_facility_project_links_role
        CHECK (link_role IN (
            'construction', 'handover', 'fit_out', 'refurbishment', 'maintenance',
            'replacement', 'decommissioning', 'other'
        )),
    CONSTRAINT ck_facility_project_links_dates
        CHECK (ended_on IS NULL OR linked_on IS NULL OR ended_on >= linked_on)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Buildings, levels and spaces
-- -----------------------------------------------------------------------------

CREATE TABLE facility_buildings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    facility_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    building_code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    operational_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_facility_buildings_public_id (public_id),
    UNIQUE KEY uq_facility_buildings_id_org (id, organisation_id),
    UNIQUE KEY uq_facility_buildings_id_context (id, organisation_id, facility_id),
    UNIQUE KEY uq_facility_buildings_code (organisation_id, facility_id, building_code),
    CONSTRAINT fk_facility_buildings_facility
        FOREIGN KEY (facility_id, organisation_id)
        REFERENCES facilities (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_facility_buildings_status
        CHECK (operational_status IN ('planned', 'active', 'inactive', 'decommissioned', 'archived'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE building_levels (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    facility_id BIGINT UNSIGNED NOT NULL,
    facility_building_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    level_code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(255) NOT NULL,
    level_number DECIMAL(8,2) NULL,
    sort_order INT NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_building_levels_public_id (public_id),
    UNIQUE KEY uq_building_levels_id_org (id, organisation_id),
    UNIQUE KEY uq_building_levels_id_context (
        id, organisation_id, facility_id, facility_building_id
    ),
    UNIQUE KEY uq_building_levels_code (
        organisation_id, facility_building_id, level_code
    ),
    UNIQUE KEY uq_building_levels_sort (
        organisation_id, facility_building_id, sort_order
    ),
    CONSTRAINT fk_building_levels_building
        FOREIGN KEY (facility_building_id, organisation_id, facility_id)
        REFERENCES facility_buildings (id, organisation_id, facility_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE facility_spaces (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    facility_id BIGINT UNSIGNED NOT NULL,
    facility_building_id BIGINT UNSIGNED NOT NULL,
    building_level_id BIGINT UNSIGNED NULL,
    parent_space_id BIGINT UNSIGNED NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    space_code VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(255) NOT NULL,
    space_type VARCHAR(80) NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_facility_spaces_public_id (public_id),
    UNIQUE KEY uq_facility_spaces_id_org (id, organisation_id),
    UNIQUE KEY uq_facility_spaces_id_context (
        id, organisation_id, facility_id, facility_building_id
    ),
    UNIQUE KEY uq_facility_spaces_code (
        organisation_id, facility_id, space_code
    ),
    KEY idx_facility_spaces_level (
        building_level_id, organisation_id, facility_id, facility_building_id
    ),
    KEY idx_facility_spaces_parent (
        parent_space_id, organisation_id, facility_id, facility_building_id
    ),
    CONSTRAINT fk_facility_spaces_building
        FOREIGN KEY (facility_building_id, organisation_id, facility_id)
        REFERENCES facility_buildings (id, organisation_id, facility_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_facility_spaces_level
        FOREIGN KEY (
            building_level_id, organisation_id, facility_id, facility_building_id
        ) REFERENCES building_levels (
            id, organisation_id, facility_id, facility_building_id
        ) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_facility_spaces_parent
        FOREIGN KEY (
            parent_space_id, organisation_id, facility_id, facility_building_id
        ) REFERENCES facility_spaces (
            id, organisation_id, facility_id, facility_building_id
        ) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_facility_spaces_parent
        CHECK (parent_space_id IS NULL OR parent_space_id <> id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Building systems
-- -----------------------------------------------------------------------------

CREATE TABLE building_system_types (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_building_system_types_public_id (public_id),
    UNIQUE KEY uq_building_system_types_id_org (id, organisation_id),
    UNIQUE KEY uq_building_system_types_code (organisation_id, code),
    CONSTRAINT fk_building_system_types_org
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE building_systems (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    facility_id BIGINT UNSIGNED NOT NULL,
    facility_building_id BIGINT UNSIGNED NULL,
    building_system_type_id BIGINT UNSIGNED NOT NULL,
    parent_system_id BIGINT UNSIGNED NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    system_code VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    operational_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_building_systems_public_id (public_id),
    UNIQUE KEY uq_building_systems_id_org (id, organisation_id),
    UNIQUE KEY uq_building_systems_id_facility (id, organisation_id, facility_id),
    UNIQUE KEY uq_building_systems_code (organisation_id, facility_id, system_code),
    KEY idx_building_systems_building (facility_building_id, organisation_id, facility_id),
    KEY idx_building_systems_parent (parent_system_id, organisation_id, facility_id),
    CONSTRAINT fk_building_systems_facility
        FOREIGN KEY (facility_id, organisation_id)
        REFERENCES facilities (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_building_systems_building
        FOREIGN KEY (facility_building_id, organisation_id, facility_id)
        REFERENCES facility_buildings (id, organisation_id, facility_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_building_systems_type
        FOREIGN KEY (building_system_type_id, organisation_id)
        REFERENCES building_system_types (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_building_systems_parent
        FOREIGN KEY (parent_system_id, organisation_id, facility_id)
        REFERENCES building_systems (id, organisation_id, facility_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_building_systems_parent
        CHECK (parent_system_id IS NULL OR parent_system_id <> id),
    CONSTRAINT ck_building_systems_status
        CHECK (operational_status IN ('planned', 'active', 'inactive', 'isolated', 'decommissioned', 'archived'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Asset types, models and asset register
-- -----------------------------------------------------------------------------

CREATE TABLE asset_types (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    asset_category_id SMALLINT UNSIGNED NOT NULL,
    code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    is_maintainable BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_types_public_id (public_id),
    UNIQUE KEY uq_asset_types_id_org (id, organisation_id),
    UNIQUE KEY uq_asset_types_code (organisation_id, code),
    CONSTRAINT fk_asset_types_org
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_types_category
        FOREIGN KEY (asset_category_id)
        REFERENCES asset_categories (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE asset_models (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    asset_type_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    manufacturer_party_id BIGINT UNSIGNED NULL,
    manufacturer_name VARCHAR(255) NULL,
    model_number VARCHAR(160) NOT NULL,
    model_name VARCHAR(255) NULL,
    expected_life_months INT UNSIGNED NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_models_public_id (public_id),
    UNIQUE KEY uq_asset_models_id_org (id, organisation_id),
    UNIQUE KEY uq_asset_models_id_type (id, organisation_id, asset_type_id),
    UNIQUE KEY uq_asset_models_number (
        organisation_id, asset_type_id, manufacturer_name, model_number
    ),
    CONSTRAINT fk_asset_models_type
        FOREIGN KEY (asset_type_id, organisation_id)
        REFERENCES asset_types (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_models_manufacturer
        FOREIGN KEY (manufacturer_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_asset_models_manufacturer
        CHECK (manufacturer_party_id IS NOT NULL OR manufacturer_name IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE assets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    facility_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    asset_type_id BIGINT UNSIGNED NOT NULL,
    asset_model_id BIGINT UNSIGNED NULL,
    facility_building_id BIGINT UNSIGNED NULL,
    building_level_id BIGINT UNSIGNED NULL,
    facility_space_id BIGINT UNSIGNED NULL,
    building_system_id BIGINT UNSIGNED NULL,
    parent_asset_id BIGINT UNSIGNED NULL,
    asset_tag VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    serial_number VARCHAR(255) NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    criticality VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'medium',
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    installed_on DATE NULL,
    commissioned_on DATE NULL,
    decommissioned_on DATE NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_assets_public_id (public_id),
    UNIQUE KEY uq_assets_id_org (id, organisation_id),
    UNIQUE KEY uq_assets_id_facility (id, organisation_id, facility_id),
    UNIQUE KEY uq_assets_tag (organisation_id, facility_id, asset_tag),
    KEY idx_assets_type (asset_type_id, organisation_id, lifecycle_status),
    KEY idx_assets_model (asset_model_id, organisation_id, asset_type_id),
    KEY idx_assets_building (facility_building_id, organisation_id, facility_id),
    KEY idx_assets_level (building_level_id, organisation_id, facility_id, facility_building_id),
    KEY idx_assets_space (facility_space_id, organisation_id, facility_id, facility_building_id),
    KEY idx_assets_system (building_system_id, organisation_id, facility_id),
    KEY idx_assets_parent (parent_asset_id, organisation_id, facility_id),
    CONSTRAINT fk_assets_facility
        FOREIGN KEY (facility_id, organisation_id)
        REFERENCES facilities (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_assets_type
        FOREIGN KEY (asset_type_id, organisation_id)
        REFERENCES asset_types (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_assets_model
        FOREIGN KEY (asset_model_id, organisation_id, asset_type_id)
        REFERENCES asset_models (id, organisation_id, asset_type_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_assets_building
        FOREIGN KEY (facility_building_id, organisation_id, facility_id)
        REFERENCES facility_buildings (id, organisation_id, facility_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_assets_level
        FOREIGN KEY (
            building_level_id, organisation_id, facility_id, facility_building_id
        ) REFERENCES building_levels (
            id, organisation_id, facility_id, facility_building_id
        ) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_assets_space
        FOREIGN KEY (
            facility_space_id, organisation_id, facility_id, facility_building_id
        ) REFERENCES facility_spaces (
            id, organisation_id, facility_id, facility_building_id
        ) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_assets_system
        FOREIGN KEY (building_system_id, organisation_id, facility_id)
        REFERENCES building_systems (id, organisation_id, facility_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_assets_parent
        FOREIGN KEY (parent_asset_id, organisation_id, facility_id)
        REFERENCES assets (id, organisation_id, facility_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_assets_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_assets_parent
        CHECK (parent_asset_id IS NULL OR parent_asset_id <> id),
    CONSTRAINT ck_assets_location
        CHECK (
            (building_level_id IS NULL OR facility_building_id IS NOT NULL)
            AND (facility_space_id IS NULL OR facility_building_id IS NOT NULL)
        ),
    CONSTRAINT ck_assets_criticality
        CHECK (criticality IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT ck_assets_lifecycle
        CHECK (lifecycle_status IN (
            'planned', 'installed', 'active', 'inactive', 'isolated',
            'decommissioned', 'disposed', 'archived'
        )),
    CONSTRAINT ck_assets_dates
        CHECK (
            (commissioned_on IS NULL OR installed_on IS NULL OR commissioned_on >= installed_on)
            AND (decommissioned_on IS NULL OR installed_on IS NULL OR decommissioned_on >= installed_on)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE asset_identifiers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    asset_identifier_type_id SMALLINT UNSIGNED NOT NULL,
    identifier_value VARCHAR(255) NOT NULL,
    issuer VARCHAR(255) NULL,
    valid_from DATE NULL,
    valid_to DATE NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_identifiers_value (
        organisation_id, asset_id, asset_identifier_type_id, identifier_value
    ),
    CONSTRAINT fk_asset_identifiers_asset
        FOREIGN KEY (asset_id, organisation_id)
        REFERENCES assets (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_identifiers_type
        FOREIGN KEY (asset_identifier_type_id)
        REFERENCES asset_identifier_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_asset_identifiers_dates
        CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE asset_information_links (
    asset_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    linked_by_member_id BIGINT UNSIGNED NOT NULL,
    linked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (asset_id, information_container_version_id, link_role),
    CONSTRAINT fk_asset_information_links_asset
        FOREIGN KEY (asset_id, organisation_id)
        REFERENCES assets (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_information_links_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_information_links_member
        FOREIGN KEY (linked_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_asset_information_links_role
        CHECK (link_role IN (
            'om_manual', 'datasheet', 'drawing', 'commissioning', 'certificate',
            'photo', 'risk_information', 'service_record', 'other'
        ))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE asset_lifecycle_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    event_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    from_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    to_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    effective_at DATETIME(6) NOT NULL,
    acted_by_member_id BIGINT UNSIGNED NOT NULL,
    notes TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_asset_lifecycle_events_asset (asset_id, organisation_id, effective_at),
    CONSTRAINT fk_asset_lifecycle_events_asset
        FOREIGN KEY (asset_id, organisation_id)
        REFERENCES assets (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_lifecycle_events_member
        FOREIGN KEY (acted_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_asset_lifecycle_events_type
        CHECK (event_type IN (
            'installed', 'commissioned', 'in_service', 'moved', 'isolated',
            'returned_to_service', 'decommissioned', 'disposed', 'replaced', 'other'
        ))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Warranties
-- -----------------------------------------------------------------------------

CREATE TABLE asset_warranties (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    warranty_type_id SMALLINT UNSIGNED NOT NULL,
    warranty_provider_party_id BIGINT UNSIGNED NULL,
    warranty_reference VARCHAR(255) NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NULL,
    terms_summary TEXT NULL,
    claim_contact_name VARCHAR(255) NULL,
    claim_contact_email VARCHAR(320) NULL,
    claim_contact_phone VARCHAR(64) NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_warranties_public_id (public_id),
    UNIQUE KEY uq_asset_warranties_id_org (id, organisation_id),
    KEY idx_asset_warranties_asset (asset_id, organisation_id, ends_on),
    CONSTRAINT fk_asset_warranties_asset
        FOREIGN KEY (asset_id, organisation_id)
        REFERENCES assets (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_warranties_type
        FOREIGN KEY (warranty_type_id)
        REFERENCES warranty_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_warranties_provider
        FOREIGN KEY (warranty_provider_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_asset_warranties_dates
        CHECK (ends_on IS NULL OR ends_on >= starts_on),
    CONSTRAINT ck_asset_warranties_status
        CHECK (lifecycle_status IN ('active', 'cancelled', 'void', 'archived'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE asset_warranty_information_links (
    asset_warranty_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'evidence',
    linked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (asset_warranty_id, information_container_version_id, link_role),
    CONSTRAINT fk_asset_warranty_info_warranty
        FOREIGN KEY (asset_warranty_id, organisation_id)
        REFERENCES asset_warranties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_warranty_info_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_asset_warranty_info_role
        CHECK (link_role IN ('certificate', 'terms', 'claim', 'evidence', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Meters and readings
-- -----------------------------------------------------------------------------

CREATE TABLE asset_meters (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    meter_type_id SMALLINT UNSIGNED NOT NULL,
    unit_of_measure_id SMALLINT UNSIGNED NOT NULL,
    meter_code VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(255) NOT NULL,
    rollover_value DECIMAL(19,6) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_meters_public_id (public_id),
    UNIQUE KEY uq_asset_meters_id_org (id, organisation_id),
    UNIQUE KEY uq_asset_meters_code (organisation_id, asset_id, meter_code),
    CONSTRAINT fk_asset_meters_asset
        FOREIGN KEY (asset_id, organisation_id)
        REFERENCES assets (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_meters_type
        FOREIGN KEY (meter_type_id)
        REFERENCES meter_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_meters_unit
        FOREIGN KEY (unit_of_measure_id)
        REFERENCES units_of_measure (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_asset_meters_rollover
        CHECK (rollover_value IS NULL OR rollover_value > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE asset_meter_readings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    asset_meter_id BIGINT UNSIGNED NOT NULL,
    reading_at DATETIME(6) NOT NULL,
    reading_value DECIMAL(19,6) NOT NULL,
    reading_source VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'manual',
    recorded_by_member_id BIGINT UNSIGNED NULL,
    source_reference VARCHAR(255) NULL,
    notes VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_meter_readings_time (
        organisation_id, asset_meter_id, reading_at
    ),
    CONSTRAINT fk_asset_meter_readings_meter
        FOREIGN KEY (asset_meter_id, organisation_id)
        REFERENCES asset_meters (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_meter_readings_member
        FOREIGN KEY (recorded_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_asset_meter_readings_source
        CHECK (reading_source IN ('manual', 'import', 'api', 'bms', 'iot', 'service', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Handover packages
-- -----------------------------------------------------------------------------

CREATE TABLE handover_packages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    facility_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    handover_number VARCHAR(120) NOT NULL,
    title VARCHAR(500) NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    submitted_by_member_id BIGINT UNSIGNED NULL,
    submitted_at DATETIME(6) NULL,
    accepted_by_member_id BIGINT UNSIGNED NULL,
    accepted_at DATETIME(6) NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_handover_packages_public_id (public_id),
    UNIQUE KEY uq_handover_packages_id_org (id, organisation_id),
    UNIQUE KEY uq_handover_packages_number (organisation_id, facility_id, handover_number),
    KEY idx_handover_packages_project (project_id, organisation_id),
    CONSTRAINT fk_handover_packages_facility
        FOREIGN KEY (facility_id, organisation_id)
        REFERENCES facilities (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_handover_packages_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_handover_packages_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_handover_packages_submitter
        FOREIGN KEY (submitted_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_handover_packages_acceptor
        FOREIGN KEY (accepted_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_handover_packages_status
        CHECK (lifecycle_status IN ('draft', 'submitted', 'accepted', 'rejected', 'closed', 'cancelled')),
    CONSTRAINT ck_handover_packages_submission
        CHECK (
            (submitted_at IS NULL AND submitted_by_member_id IS NULL)
            OR (submitted_at IS NOT NULL AND submitted_by_member_id IS NOT NULL)
        ),
    CONSTRAINT ck_handover_packages_acceptance
        CHECK (
            (accepted_at IS NULL AND accepted_by_member_id IS NULL)
            OR (accepted_at IS NOT NULL AND accepted_by_member_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE handover_package_assets (
    organisation_id BIGINT UNSIGNED NOT NULL,
    handover_package_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 1,
    included_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (organisation_id, handover_package_id, asset_id),
    UNIQUE KEY uq_handover_package_assets_sort (
        organisation_id, handover_package_id, sort_order
    ),
    CONSTRAINT fk_handover_package_assets_package
        FOREIGN KEY (handover_package_id, organisation_id)
        REFERENCES handover_packages (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_handover_package_assets_asset
        FOREIGN KEY (asset_id, organisation_id)
        REFERENCES assets (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_handover_package_assets_sort CHECK (sort_order > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE handover_package_information_links (
    handover_package_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'handover',
    sort_order INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (handover_package_id, information_container_version_id, link_role),
    UNIQUE KEY uq_handover_package_information_sort (
        handover_package_id, link_role, sort_order
    ),
    CONSTRAINT fk_handover_package_information_package
        FOREIGN KEY (handover_package_id, organisation_id)
        REFERENCES handover_packages (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_handover_package_information_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_handover_package_information_role
        CHECK (link_role IN ('handover', 'om_manual', 'certificate', 'drawing', 'schedule', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Reactive maintenance requests
-- -----------------------------------------------------------------------------

CREATE TABLE maintenance_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    facility_id BIGINT UNSIGNED NOT NULL,
    facility_space_id BIGINT UNSIGNED NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_number VARCHAR(120) NOT NULL,
    request_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'fault',
    maintenance_priority_level_id SMALLINT UNSIGNED NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    request_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'new',
    reported_by_member_id BIGINT UNSIGNED NULL,
    reported_by_party_id BIGINT UNSIGNED NULL,
    reporter_name VARCHAR(255) NULL,
    reported_at DATETIME(6) NOT NULL,
    resolved_by_member_id BIGINT UNSIGNED NULL,
    resolved_at DATETIME(6) NULL,
    resolution_note TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_maintenance_requests_public_id (public_id),
    UNIQUE KEY uq_maintenance_requests_id_org (id, organisation_id),
    UNIQUE KEY uq_maintenance_requests_number (organisation_id, request_number),
    KEY idx_maintenance_requests_facility_status (
        facility_id, organisation_id, request_status, reported_at
    ),
    CONSTRAINT fk_maintenance_requests_facility
        FOREIGN KEY (facility_id, organisation_id)
        REFERENCES facilities (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_requests_space
        FOREIGN KEY (facility_space_id, organisation_id)
        REFERENCES facility_spaces (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_requests_priority
        FOREIGN KEY (maintenance_priority_level_id)
        REFERENCES maintenance_priority_levels (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_requests_member
        FOREIGN KEY (reported_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_requests_party
        FOREIGN KEY (reported_by_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_requests_resolver
        FOREIGN KEY (resolved_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_maintenance_requests_type
        CHECK (request_type IN ('fault', 'breakdown', 'damage', 'alarm', 'user_request', 'defect', 'other')),
    CONSTRAINT ck_maintenance_requests_status
        CHECK (request_status IN ('new', 'triaged', 'approved', 'rejected', 'in_progress', 'resolved', 'cancelled', 'duplicate')),
    CONSTRAINT ck_maintenance_requests_reporter
        CHECK (
            reported_by_member_id IS NOT NULL
            OR reported_by_party_id IS NOT NULL
            OR reporter_name IS NOT NULL
        ),
    CONSTRAINT ck_maintenance_requests_resolution
        CHECK (
            (resolved_at IS NULL AND resolved_by_member_id IS NULL)
            OR (resolved_at IS NOT NULL AND resolved_by_member_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE maintenance_request_assets (
    organisation_id BIGINT UNSIGNED NOT NULL,
    maintenance_request_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    relationship_role VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'affected',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (organisation_id, maintenance_request_id, asset_id, relationship_role),
    CONSTRAINT fk_maintenance_request_assets_request
        FOREIGN KEY (maintenance_request_id, organisation_id)
        REFERENCES maintenance_requests (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_request_assets_asset
        FOREIGN KEY (asset_id, organisation_id)
        REFERENCES assets (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_maintenance_request_assets_role
        CHECK (relationship_role IN ('affected', 'suspected_source', 'related', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Planned maintenance
-- -----------------------------------------------------------------------------

CREATE TABLE maintenance_plans (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    facility_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    maintenance_plan_type_id SMALLINT UNSIGNED NOT NULL,
    plan_number VARCHAR(120) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    starts_on DATE NULL,
    ends_on DATE NULL,
    owner_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_maintenance_plans_public_id (public_id),
    UNIQUE KEY uq_maintenance_plans_id_org (id, organisation_id),
    UNIQUE KEY uq_maintenance_plans_number (organisation_id, facility_id, plan_number),
    CONSTRAINT fk_maintenance_plans_facility
        FOREIGN KEY (facility_id, organisation_id)
        REFERENCES facilities (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_plans_type
        FOREIGN KEY (maintenance_plan_type_id)
        REFERENCES maintenance_plan_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_plans_owner
        FOREIGN KEY (owner_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_maintenance_plans_status
        CHECK (lifecycle_status IN ('draft', 'active', 'suspended', 'retired', 'cancelled')),
    CONSTRAINT ck_maintenance_plans_dates
        CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE maintenance_plan_assets (
    organisation_id BIGINT UNSIGNED NOT NULL,
    maintenance_plan_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    assigned_on DATE NULL,
    ended_on DATE NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (organisation_id, maintenance_plan_id, asset_id),
    CONSTRAINT fk_maintenance_plan_assets_plan
        FOREIGN KEY (maintenance_plan_id, organisation_id)
        REFERENCES maintenance_plans (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_plan_assets_asset
        FOREIGN KEY (asset_id, organisation_id)
        REFERENCES assets (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_maintenance_plan_assets_dates
        CHECK (ended_on IS NULL OR assigned_on IS NULL OR ended_on >= assigned_on)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE maintenance_plan_tasks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    maintenance_plan_id BIGINT UNSIGNED NOT NULL,
    task_number INT UNSIGNED NOT NULL,
    title VARCHAR(500) NOT NULL,
    instructions TEXT NULL,
    estimated_duration_minutes INT UNSIGNED NULL,
    requires_shutdown BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_maintenance_plan_tasks_id_org (id, organisation_id),
    UNIQUE KEY uq_maintenance_plan_tasks_number (
        organisation_id, maintenance_plan_id, task_number
    ),
    CONSTRAINT fk_maintenance_plan_tasks_plan
        FOREIGN KEY (maintenance_plan_id, organisation_id)
        REFERENCES maintenance_plans (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_maintenance_plan_tasks_number CHECK (task_number > 0),
    CONSTRAINT ck_maintenance_plan_tasks_duration
        CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE maintenance_task_schedule_rules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    maintenance_plan_task_id BIGINT UNSIGNED NOT NULL,
    schedule_basis VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    interval_value DECIMAL(19,6) NULL,
    interval_unit VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    asset_meter_id BIGINT UNSIGNED NULL,
    starts_on DATE NULL,
    tolerance_days SMALLINT UNSIGNED NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_maintenance_task_schedule_rules_id_org (id, organisation_id),
    KEY idx_maintenance_task_schedule_rules_task (
        maintenance_plan_task_id, organisation_id, is_active
    ),
    CONSTRAINT fk_maintenance_task_schedule_rules_task
        FOREIGN KEY (maintenance_plan_task_id, organisation_id)
        REFERENCES maintenance_plan_tasks (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_task_schedule_rules_meter
        FOREIGN KEY (asset_meter_id, organisation_id)
        REFERENCES asset_meters (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_maintenance_task_schedule_rules_basis
        CHECK (schedule_basis IN ('calendar', 'meter', 'manual')),
    CONSTRAINT ck_maintenance_task_schedule_rules_interval
        CHECK (
            (schedule_basis = 'calendar'
                AND interval_value IS NOT NULL
                AND interval_value > 0
                AND interval_unit IN ('day', 'week', 'month', 'year')
                AND asset_meter_id IS NULL)
            OR
            (schedule_basis = 'meter'
                AND interval_value IS NOT NULL
                AND interval_value > 0
                AND interval_unit = 'meter_unit'
                AND asset_meter_id IS NOT NULL)
            OR
            (schedule_basis = 'manual'
                AND interval_value IS NULL
                AND interval_unit IS NULL
                AND asset_meter_id IS NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Work orders
-- -----------------------------------------------------------------------------

CREATE TABLE work_orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    facility_id BIGINT UNSIGNED NOT NULL,
    facility_space_id BIGINT UNSIGNED NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    work_order_number VARCHAR(120) NOT NULL,
    work_order_type_id SMALLINT UNSIGNED NOT NULL,
    maintenance_priority_level_id SMALLINT UNSIGNED NOT NULL,
    source_maintenance_request_id BIGINT UNSIGNED NULL,
    source_maintenance_plan_task_id BIGINT UNSIGNED NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NULL,
    work_order_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    requested_on DATE NULL,
    scheduled_start_at DATETIME(6) NULL,
    scheduled_end_at DATETIME(6) NULL,
    started_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    owner_member_id BIGINT UNSIGNED NOT NULL,
    completed_by_member_id BIGINT UNSIGNED NULL,
    completion_summary TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_work_orders_public_id (public_id),
    UNIQUE KEY uq_work_orders_id_org (id, organisation_id),
    UNIQUE KEY uq_work_orders_number (organisation_id, work_order_number),
    KEY idx_work_orders_facility_status (
        facility_id, organisation_id, work_order_status, scheduled_start_at
    ),
    KEY idx_work_orders_request (source_maintenance_request_id, organisation_id),
    KEY idx_work_orders_plan_task (source_maintenance_plan_task_id, organisation_id),
    CONSTRAINT fk_work_orders_facility
        FOREIGN KEY (facility_id, organisation_id)
        REFERENCES facilities (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_orders_space
        FOREIGN KEY (facility_space_id, organisation_id)
        REFERENCES facility_spaces (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_orders_type
        FOREIGN KEY (work_order_type_id)
        REFERENCES work_order_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_orders_priority
        FOREIGN KEY (maintenance_priority_level_id)
        REFERENCES maintenance_priority_levels (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_orders_request
        FOREIGN KEY (source_maintenance_request_id, organisation_id)
        REFERENCES maintenance_requests (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_orders_plan_task
        FOREIGN KEY (source_maintenance_plan_task_id, organisation_id)
        REFERENCES maintenance_plan_tasks (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_orders_owner
        FOREIGN KEY (owner_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_orders_completer
        FOREIGN KEY (completed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_work_orders_status
        CHECK (work_order_status IN (
            'draft', 'open', 'assigned', 'in_progress', 'on_hold',
            'completed', 'cancelled', 'void'
        )),
    CONSTRAINT ck_work_orders_schedule
        CHECK (
            scheduled_end_at IS NULL
            OR scheduled_start_at IS NULL
            OR scheduled_end_at >= scheduled_start_at
        ),
    CONSTRAINT ck_work_orders_actual
        CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at),
    CONSTRAINT ck_work_orders_completion
        CHECK (
            (work_order_status = 'completed'
                AND completed_at IS NOT NULL
                AND completed_by_member_id IS NOT NULL)
            OR work_order_status <> 'completed'
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE work_order_assets (
    organisation_id BIGINT UNSIGNED NOT NULL,
    work_order_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    relationship_role VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'maintained',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (organisation_id, work_order_id, asset_id, relationship_role),
    CONSTRAINT fk_work_order_assets_work_order
        FOREIGN KEY (work_order_id, organisation_id)
        REFERENCES work_orders (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_order_assets_asset
        FOREIGN KEY (asset_id, organisation_id)
        REFERENCES assets (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_work_order_assets_role
        CHECK (relationship_role IN ('maintained', 'inspected', 'isolated', 'related', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE work_order_worker_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    work_order_id BIGINT UNSIGNED NOT NULL,
    worker_id BIGINT UNSIGNED NOT NULL,
    assignment_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'operative',
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    unassigned_at DATETIME(6) NULL,
    assigned_by_member_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_work_order_worker_assignments_id_org (id, organisation_id),
    KEY idx_work_order_worker_assignments_work_order (
        work_order_id, organisation_id, assigned_at
    ),
    KEY idx_work_order_worker_assignments_worker (
        worker_id, organisation_id, assigned_at
    ),
    CONSTRAINT fk_work_order_worker_assignments_order
        FOREIGN KEY (work_order_id, organisation_id)
        REFERENCES work_orders (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_order_worker_assignments_worker
        FOREIGN KEY (worker_id, organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_order_worker_assignments_member
        FOREIGN KEY (assigned_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_work_order_worker_assignments_role
        CHECK (assignment_role IN ('lead', 'operative', 'engineer', 'inspector', 'supervisor', 'other')),
    CONSTRAINT ck_work_order_worker_assignments_dates
        CHECK (unassigned_at IS NULL OR unassigned_at >= assigned_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE work_order_party_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    work_order_id BIGINT UNSIGNED NOT NULL,
    party_id BIGINT UNSIGNED NOT NULL,
    assignment_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'contractor',
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    unassigned_at DATETIME(6) NULL,
    assigned_by_member_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_work_order_party_assignments_id_org (id, organisation_id),
    KEY idx_work_order_party_assignments_work_order (
        work_order_id, organisation_id, assigned_at
    ),
    KEY idx_work_order_party_assignments_party (
        party_id, organisation_id, assigned_at
    ),
    CONSTRAINT fk_work_order_party_assignments_order
        FOREIGN KEY (work_order_id, organisation_id)
        REFERENCES work_orders (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_order_party_assignments_party
        FOREIGN KEY (party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_order_party_assignments_member
        FOREIGN KEY (assigned_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_work_order_party_assignments_role
        CHECK (assignment_role IN ('contractor', 'service_provider', 'manufacturer', 'specialist', 'other')),
    CONSTRAINT ck_work_order_party_assignments_dates
        CHECK (unassigned_at IS NULL OR unassigned_at >= assigned_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE work_order_tasks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    work_order_id BIGINT UNSIGNED NOT NULL,
    source_maintenance_plan_task_id BIGINT UNSIGNED NULL,
    task_number INT UNSIGNED NOT NULL,
    description TEXT NOT NULL,
    task_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    completed_by_member_id BIGINT UNSIGNED NULL,
    completed_at DATETIME(6) NULL,
    completion_note VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_work_order_tasks_id_org (id, organisation_id),
    UNIQUE KEY uq_work_order_tasks_number (organisation_id, work_order_id, task_number),
    CONSTRAINT fk_work_order_tasks_order
        FOREIGN KEY (work_order_id, organisation_id)
        REFERENCES work_orders (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_order_tasks_plan_task
        FOREIGN KEY (source_maintenance_plan_task_id, organisation_id)
        REFERENCES maintenance_plan_tasks (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_order_tasks_completer
        FOREIGN KEY (completed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_work_order_tasks_number CHECK (task_number > 0),
    CONSTRAINT ck_work_order_tasks_status
        CHECK (task_status IN ('pending', 'in_progress', 'completed', 'skipped', 'cancelled')),
    CONSTRAINT ck_work_order_tasks_completion
        CHECK (
            (task_status = 'completed'
                AND completed_at IS NOT NULL
                AND completed_by_member_id IS NOT NULL)
            OR task_status <> 'completed'
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE work_order_status_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    work_order_id BIGINT UNSIGNED NOT NULL,
    from_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    to_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    acted_by_member_id BIGINT UNSIGNED NOT NULL,
    acted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    comment VARCHAR(1000) NULL,
    PRIMARY KEY (id),
    KEY idx_work_order_status_events_order (
        work_order_id, organisation_id, acted_at, id
    ),
    CONSTRAINT fk_work_order_status_events_order
        FOREIGN KEY (work_order_id, organisation_id)
        REFERENCES work_orders (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_order_status_events_member
        FOREIGN KEY (acted_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_work_order_status_events_from
        CHECK (
            from_status IS NULL OR from_status IN (
                'draft', 'open', 'assigned', 'in_progress', 'on_hold',
                'completed', 'cancelled', 'void'
            )
        ),
    CONSTRAINT ck_work_order_status_events_to
        CHECK (to_status IN (
            'draft', 'open', 'assigned', 'in_progress', 'on_hold',
            'completed', 'cancelled', 'void'
        ))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE work_order_information_links (
    work_order_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'evidence',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (work_order_id, information_container_version_id, link_role),
    CONSTRAINT fk_work_order_information_order
        FOREIGN KEY (work_order_id, organisation_id)
        REFERENCES work_orders (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_order_information_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_work_order_information_role
        CHECK (link_role IN ('instruction', 'evidence', 'photo', 'certificate', 'report', 'drawing', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE work_order_timesheet_entries (
    organisation_id BIGINT UNSIGNED NOT NULL,
    work_order_id BIGINT UNSIGNED NOT NULL,
    timesheet_entry_id BIGINT UNSIGNED NOT NULL,
    linked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (organisation_id, work_order_id, timesheet_entry_id),
    CONSTRAINT fk_work_order_timesheet_entries_order
        FOREIGN KEY (work_order_id, organisation_id)
        REFERENCES work_orders (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_order_timesheet_entries_entry
        FOREIGN KEY (timesheet_entry_id, organisation_id)
        REFERENCES timesheet_entries (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE work_order_purchase_order_items (
    organisation_id BIGINT UNSIGNED NOT NULL,
    work_order_id BIGINT UNSIGNED NOT NULL,
    purchase_order_item_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'used_for_work',
    linked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (organisation_id, work_order_id, purchase_order_item_id, link_role),
    CONSTRAINT fk_work_order_po_items_order
        FOREIGN KEY (work_order_id, organisation_id)
        REFERENCES work_orders (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_order_po_items_item
        FOREIGN KEY (purchase_order_item_id, organisation_id)
        REFERENCES purchase_order_items (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_work_order_po_items_role
        CHECK (link_role IN ('used_for_work', 'replacement', 'service', 'hire', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Asset service history
-- -----------------------------------------------------------------------------

CREATE TABLE asset_service_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    work_order_id BIGINT UNSIGNED NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    service_event_type_id SMALLINT UNSIGNED NOT NULL,
    performed_at DATETIME(6) NOT NULL,
    provider_party_id BIGINT UNSIGNED NULL,
    performed_by_member_id BIGINT UNSIGNED NULL,
    result_code VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'completed',
    condition_rating VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
    notes TEXT NULL,
    recommended_next_service_on DATE NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_service_events_public_id (public_id),
    UNIQUE KEY uq_asset_service_events_id_org (id, organisation_id),
    KEY idx_asset_service_events_asset (asset_id, organisation_id, performed_at),
    KEY idx_asset_service_events_order (work_order_id, organisation_id),
    CONSTRAINT fk_asset_service_events_asset
        FOREIGN KEY (asset_id, organisation_id)
        REFERENCES assets (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_service_events_order
        FOREIGN KEY (work_order_id, organisation_id)
        REFERENCES work_orders (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_service_events_type
        FOREIGN KEY (service_event_type_id)
        REFERENCES service_event_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_service_events_provider
        FOREIGN KEY (provider_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_service_events_member
        FOREIGN KEY (performed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_asset_service_events_result
        CHECK (result_code IN ('completed', 'partial', 'failed', 'no_fault_found', 'cancelled', 'void')),
    CONSTRAINT ck_asset_service_events_condition
        CHECK (condition_rating IS NULL OR condition_rating IN ('good', 'fair', 'poor', 'critical', 'unknown'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE service_event_information_links (
    asset_service_event_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'service_report',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (asset_service_event_id, information_container_version_id, link_role),
    CONSTRAINT fk_service_event_information_event
        FOREIGN KEY (asset_service_event_id, organisation_id)
        REFERENCES asset_service_events (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_service_event_information_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_service_event_information_role
        CHECK (link_role IN ('service_report', 'certificate', 'photo', 'test_result', 'invoice_support', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Compliance requirements and versioned rules
-- -----------------------------------------------------------------------------

CREATE TABLE compliance_requirements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    compliance_requirement_category_id SMALLINT UNSIGNED NOT NULL,
    requirement_code VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_compliance_requirements_public_id (public_id),
    UNIQUE KEY uq_compliance_requirements_id_org (id, organisation_id),
    UNIQUE KEY uq_compliance_requirements_code (organisation_id, requirement_code),
    CONSTRAINT fk_compliance_requirements_category
        FOREIGN KEY (compliance_requirement_category_id)
        REFERENCES compliance_requirement_categories (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_compliance_requirements_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_compliance_requirements_status
        CHECK (lifecycle_status IN ('active', 'inactive', 'retired', 'archived'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE compliance_requirement_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    compliance_requirement_id BIGINT UNSIGNED NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    version_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    reference_code VARCHAR(255) NULL,
    requirement_text TEXT NOT NULL,
    interval_value INT UNSIGNED NULL,
    interval_unit VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
    effective_from DATE NULL,
    effective_to DATE NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    published_by_member_id BIGINT UNSIGNED NULL,
    published_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_compliance_requirement_versions_id_org (id, organisation_id),
    UNIQUE KEY uq_compliance_requirement_versions_id_requirement (
        id, organisation_id, compliance_requirement_id
    ),
    UNIQUE KEY uq_compliance_requirement_versions_number (
        organisation_id, compliance_requirement_id, version_number
    ),
    CONSTRAINT fk_compliance_requirement_versions_requirement
        FOREIGN KEY (compliance_requirement_id, organisation_id)
        REFERENCES compliance_requirements (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_compliance_requirement_versions_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_compliance_requirement_versions_publisher
        FOREIGN KEY (published_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_compliance_requirement_versions_number CHECK (version_number > 0),
    CONSTRAINT ck_compliance_requirement_versions_status
        CHECK (version_status IN ('draft', 'published', 'retired', 'cancelled')),
    CONSTRAINT ck_compliance_requirement_versions_interval
        CHECK (
            (interval_value IS NULL AND interval_unit IS NULL)
            OR (interval_value IS NOT NULL AND interval_value > 0 AND interval_unit IN ('day', 'week', 'month', 'year'))
        ),
    CONSTRAINT ck_compliance_requirement_versions_dates
        CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
    CONSTRAINT ck_compliance_requirement_versions_publish
        CHECK (
            (version_status IN ('draft', 'cancelled')
                AND published_at IS NULL
                AND published_by_member_id IS NULL)
            OR
            (version_status IN ('published', 'retired')
                AND published_at IS NOT NULL
                AND published_by_member_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE facility_compliance_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    facility_id BIGINT UNSIGNED NOT NULL,
    compliance_requirement_id BIGINT UNSIGNED NOT NULL,
    assigned_from DATE NULL,
    assigned_to DATE NULL,
    responsible_member_id BIGINT UNSIGNED NULL,
    responsible_party_id BIGINT UNSIGNED NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_facility_compliance_assignments_id_org (id, organisation_id),
    UNIQUE KEY uq_facility_compliance_assignments_requirement (
        organisation_id, facility_id, compliance_requirement_id, assigned_from
    ),
    CONSTRAINT fk_facility_compliance_assignments_facility
        FOREIGN KEY (facility_id, organisation_id)
        REFERENCES facilities (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_facility_compliance_assignments_requirement
        FOREIGN KEY (compliance_requirement_id, organisation_id)
        REFERENCES compliance_requirements (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_facility_compliance_assignments_member
        FOREIGN KEY (responsible_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_facility_compliance_assignments_party
        FOREIGN KEY (responsible_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_facility_compliance_assignments_dates
        CHECK (assigned_to IS NULL OR assigned_from IS NULL OR assigned_to >= assigned_from)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE asset_compliance_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    compliance_requirement_id BIGINT UNSIGNED NOT NULL,
    assigned_from DATE NULL,
    assigned_to DATE NULL,
    responsible_member_id BIGINT UNSIGNED NULL,
    responsible_party_id BIGINT UNSIGNED NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_compliance_assignments_id_org (id, organisation_id),
    UNIQUE KEY uq_asset_compliance_assignments_requirement (
        organisation_id, asset_id, compliance_requirement_id, assigned_from
    ),
    CONSTRAINT fk_asset_compliance_assignments_asset
        FOREIGN KEY (asset_id, organisation_id)
        REFERENCES assets (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_compliance_assignments_requirement
        FOREIGN KEY (compliance_requirement_id, organisation_id)
        REFERENCES compliance_requirements (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_compliance_assignments_member
        FOREIGN KEY (responsible_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_asset_compliance_assignments_party
        FOREIGN KEY (responsible_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_asset_compliance_assignments_dates
        CHECK (assigned_to IS NULL OR assigned_from IS NULL OR assigned_to >= assigned_from)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE compliance_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    compliance_requirement_version_id BIGINT UNSIGNED NOT NULL,
    facility_compliance_assignment_id BIGINT UNSIGNED NULL,
    asset_compliance_assignment_id BIGINT UNSIGNED NULL,
    quality_inspection_id BIGINT UNSIGNED NULL,
    compliance_event_number VARCHAR(120) NOT NULL,
    performed_at DATETIME(6) NOT NULL,
    performed_by_member_id BIGINT UNSIGNED NULL,
    provider_party_id BIGINT UNSIGNED NULL,
    outcome VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    findings_summary TEXT NULL,
    recommended_next_due_on DATE NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_compliance_events_public_id (public_id),
    UNIQUE KEY uq_compliance_events_id_org (id, organisation_id),
    UNIQUE KEY uq_compliance_events_number (organisation_id, compliance_event_number),
    KEY idx_compliance_events_requirement (
        compliance_requirement_version_id, organisation_id, performed_at
    ),
    KEY idx_compliance_events_facility_assignment (
        facility_compliance_assignment_id, organisation_id
    ),
    KEY idx_compliance_events_asset_assignment (
        asset_compliance_assignment_id, organisation_id
    ),
    CONSTRAINT fk_compliance_events_requirement_version
        FOREIGN KEY (compliance_requirement_version_id, organisation_id)
        REFERENCES compliance_requirement_versions (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_compliance_events_facility_assignment
        FOREIGN KEY (facility_compliance_assignment_id, organisation_id)
        REFERENCES facility_compliance_assignments (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_compliance_events_asset_assignment
        FOREIGN KEY (asset_compliance_assignment_id, organisation_id)
        REFERENCES asset_compliance_assignments (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_compliance_events_quality_inspection
        FOREIGN KEY (quality_inspection_id, organisation_id)
        REFERENCES quality_inspections (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_compliance_events_member
        FOREIGN KEY (performed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_compliance_events_provider
        FOREIGN KEY (provider_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_compliance_events_scope
        CHECK (
            (facility_compliance_assignment_id IS NOT NULL AND asset_compliance_assignment_id IS NULL)
            OR (facility_compliance_assignment_id IS NULL AND asset_compliance_assignment_id IS NOT NULL)
        ),
    CONSTRAINT ck_compliance_events_outcome
        CHECK (outcome IN (
            'pass', 'pass_with_observations', 'fail', 'not_applicable', 'cancelled', 'void'
        )),
    CONSTRAINT ck_compliance_events_performer
        CHECK (performed_by_member_id IS NOT NULL OR provider_party_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE compliance_event_information_links (
    compliance_event_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'certificate',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (compliance_event_id, information_container_version_id, link_role),
    CONSTRAINT fk_compliance_event_information_event
        FOREIGN KEY (compliance_event_id, organisation_id)
        REFERENCES compliance_events (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_compliance_event_information_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_compliance_event_information_role
        CHECK (link_role IN ('certificate', 'report', 'test_result', 'photo', 'evidence', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Initial controlled global reference values
-- -----------------------------------------------------------------------------

INSERT INTO asset_categories (code, name) VALUES
    ('mechanical', 'Mechanical'),
    ('electrical', 'Electrical'),
    ('public_health', 'Public health'),
    ('fire_safety', 'Fire safety'),
    ('security', 'Security'),
    ('vertical_transport', 'Vertical transport'),
    ('building_fabric', 'Building fabric'),
    ('renewable_energy', 'Renewable energy'),
    ('controls_bms', 'Controls / BMS'),
    ('it_communications', 'IT / communications'),
    ('other', 'Other');

INSERT INTO asset_identifier_types (code, name) VALUES
    ('serial_number', 'Manufacturer serial number'),
    ('barcode', 'Barcode'),
    ('qr_code', 'QR code reference'),
    ('rfid', 'RFID'),
    ('bms_reference', 'BMS reference'),
    ('legacy_asset_number', 'Legacy asset number'),
    ('statutory_registration', 'Statutory registration'),
    ('other', 'Other');

INSERT INTO warranty_types (code, name) VALUES
    ('manufacturer', 'Manufacturer warranty'),
    ('installer', 'Installer warranty'),
    ('supplier', 'Supplier warranty'),
    ('extended', 'Extended warranty'),
    ('workmanship', 'Workmanship warranty'),
    ('other', 'Other');

INSERT INTO meter_types (code, name, is_cumulative) VALUES
    ('run_hours', 'Run hours', TRUE),
    ('operating_cycles', 'Operating cycles', TRUE),
    ('electricity', 'Electricity consumption', TRUE),
    ('gas', 'Gas consumption', TRUE),
    ('water', 'Water consumption', TRUE),
    ('heat', 'Heat consumption', TRUE),
    ('counter', 'General counter', TRUE),
    ('other', 'Other meter', TRUE);

INSERT INTO maintenance_plan_types (code, name) VALUES
    ('ppm', 'Planned preventive maintenance'),
    ('condition_based', 'Condition-based maintenance'),
    ('meter_based', 'Meter / usage-based maintenance'),
    ('manufacturer', 'Manufacturer maintenance schedule'),
    ('statutory_support', 'Maintenance supporting compliance'),
    ('other', 'Other');

INSERT INTO work_order_types (code, name) VALUES
    ('planned', 'Planned maintenance'),
    ('reactive', 'Reactive maintenance'),
    ('inspection', 'Inspection'),
    ('repair', 'Repair'),
    ('replacement', 'Replacement'),
    ('service', 'Service'),
    ('compliance', 'Compliance work'),
    ('other', 'Other');

INSERT INTO maintenance_priority_levels (
    code, name, sort_order, target_response_minutes
) VALUES
    ('critical', 'Critical', 1, 60),
    ('urgent', 'Urgent', 2, 240),
    ('high', 'High', 3, 1440),
    ('normal', 'Normal', 4, NULL),
    ('low', 'Low', 5, NULL);

INSERT INTO service_event_types (code, name) VALUES
    ('planned_service', 'Planned service'),
    ('reactive_repair', 'Reactive repair'),
    ('inspection', 'Inspection'),
    ('test', 'Test'),
    ('commissioning', 'Commissioning'),
    ('replacement', 'Replacement'),
    ('calibration', 'Calibration'),
    ('cleaning', 'Cleaning'),
    ('other', 'Other');

INSERT INTO compliance_requirement_categories (code, name) VALUES
    ('fire', 'Fire safety'),
    ('electrical', 'Electrical safety'),
    ('gas', 'Gas safety'),
    ('lifting', 'Lifting equipment'),
    ('pressure', 'Pressure systems'),
    ('water_hygiene', 'Water hygiene'),
    ('emergency_lighting', 'Emergency lighting'),
    ('security', 'Security'),
    ('environmental', 'Environmental'),
    ('insurance', 'Insurance requirement'),
    ('client', 'Client requirement'),
    ('other', 'Other');

-- -----------------------------------------------------------------------------
-- Required application invariants not completely expressible as simple FKs
-- -----------------------------------------------------------------------------
--
-- 1. A facility-project link requires visibility/authority in addition to project participation.
-- 2. A selected asset building/level/space/system must belong to the asset's facility.
-- 3. parent_asset_id and parent_system_id must never create cycles.
-- 4. asset_model_id must remain semantically compatible with asset_type_id; the composite FK
--    enforces direct type identity but model master edits are controlled lifecycle operations.
-- 5. Asset/location/system cross-links are private operational data unless explicit sharing policy grants access.
-- 6. Controlled-information links require effective visibility to the exact referenced revision.
-- 7. Handover package assets must belong to the handover facility; linked revisions must be
--    authorised for the handover/project context where a project is present.
-- 8. Cumulative meter reading rollback/rollover rules depend on meter type and must be validated
--    by domain policy; raw historical readings are never silently rewritten.
-- 9. Maintenance plan assets must belong to the plan facility.
-- 10. Meter-based schedule rules must use meters belonging to assets included in the plan/task scope.
-- 11. Derived next-due dates/values come from active schedule rules plus completed service history;
--     they are not maintained as unrelated editable balances.
-- 12. Work-order facility/space, source request and source plan task must resolve to compatible facility context.
-- 13. Work-order assets must belong to the work-order facility.
-- 14. Timesheet entries linked to a work order must relate to authorised workers/work performed for that order.
-- 15. PO items linked to a work order must belong to authorised procurement for the tenant and must not
--     have their quantity/value copied into the maintenance domain.
-- 16. A service event linked to a work order must reference an asset associated with that work order.
-- 17. Compliance assignment/requirement effective-period overlap policy is enforced by domain service.
-- 18. A compliance event's assignment requirement must match the requirement represented by the exact
--     compliance_requirement_version_id.
-- 19. A Package 008 quality inspection linked to a compliance event must be authorised and relevant to
--     the assigned facility/asset scope.
-- 20. Legal/statutory applicability is configured by competent users; presence of a NuBlox template does
--     not itself establish that a requirement legally applies.
-- 21. Asset lifecycle changes, handover acceptance, work-order completion, critical maintenance and
--     compliance outcomes require tenant authorisation and append-only audit events.
-- 22. Facilities/assets with operational history are archived/decommissioned rather than hard-deleted.
