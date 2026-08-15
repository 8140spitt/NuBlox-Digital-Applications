-- NuBlox: Digital Applications
-- Schema package 008: Site Operations, Quality and Safety
-- Depends on: 001-platform-kernel.sql, 002-crm-parties.sql,
--             003-sales-quotes.sql, 006-workforce-time-scheduling.sql,
--             007-project-information-documents.sql,
--             007-project-information-integrity.sql
-- Target: MySQL 8.4 / InnoDB
-- Design target: 3NF by default
-- Generated: 2026-08-15
--
-- PRINCIPLES:
-- 1. Site diary, quality and safety evidence are independent auditable facts.
-- 2. Projects, project sites, workers, CRM parties and controlled information are reused.
-- 3. Inspection definitions are versioned; published definitions are historical facts.
-- 4. Defects and NCRs have separate lifecycles even when related.
-- 5. RAMS approval and briefing evidence targets exact controlled-information revisions.
-- 6. Safety events use a supertype/subtype model to avoid duplicated nullable columns.
-- 7. Historical plant/visitor/delivery snapshots are evidence, not competing master data.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
-- Global controlled reference data
-- -----------------------------------------------------------------------------

CREATE TABLE quality_inspection_item_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(120) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_inspection_item_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quality_finding_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(120) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_finding_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE permit_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_permit_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE safety_briefing_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_safety_briefing_types_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Site diaries
-- -----------------------------------------------------------------------------

CREATE TABLE site_diaries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    project_site_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    diary_date DATE NOT NULL,
    shift_label VARCHAR(80) NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    summary TEXT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    submitted_by_member_id BIGINT UNSIGNED NULL,
    submitted_at DATETIME(6) NULL,
    approved_by_member_id BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    locked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_site_diaries_public_id (public_id),
    UNIQUE KEY uq_site_diaries_id_owner (id, owning_organisation_id),
    UNIQUE KEY uq_site_diaries_day (
        project_id, owning_organisation_id, project_site_id, diary_date
    ),
    KEY idx_site_diaries_project_date (project_id, diary_date, status),
    CONSTRAINT fk_site_diaries_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_site_diaries_site
        FOREIGN KEY (project_site_id, project_id)
        REFERENCES project_sites (id, project_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_site_diaries_creator
        FOREIGN KEY (created_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_site_diaries_submitter
        FOREIGN KEY (submitted_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_site_diaries_approver
        FOREIGN KEY (approved_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_site_diaries_status
        CHECK (status IN ('draft', 'submitted', 'approved', 'locked', 'cancelled')),
    CONSTRAINT ck_site_diaries_submit
        CHECK (
            (submitted_at IS NULL AND submitted_by_member_id IS NULL)
            OR (submitted_at IS NOT NULL AND submitted_by_member_id IS NOT NULL)
        ),
    CONSTRAINT ck_site_diaries_approve
        CHECK (
            (approved_at IS NULL AND approved_by_member_id IS NULL)
            OR (approved_at IS NOT NULL AND approved_by_member_id IS NOT NULL)
        ),
    CONSTRAINT ck_site_diaries_lock
        CHECK (locked_at IS NULL OR status = 'locked')
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE site_diary_weather_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_diary_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    observed_at DATETIME(6) NOT NULL,
    condition_code VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    temperature_c DECIMAL(5,2) NULL,
    wind_speed_mps DECIMAL(8,3) NULL,
    rainfall_mm DECIMAL(10,3) NULL,
    impact_note VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_site_diary_weather_observation (
        site_diary_id, observed_at
    ),
    CONSTRAINT fk_site_diary_weather_diary
        FOREIGN KEY (site_diary_id, owning_organisation_id)
        REFERENCES site_diaries (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_site_diary_weather_condition
        CHECK (condition_code IN (
            'clear', 'cloudy', 'rain', 'heavy_rain', 'snow', 'ice',
            'fog', 'wind', 'storm', 'hot', 'cold', 'mixed', 'other'
        )),
    CONSTRAINT ck_site_diary_weather_wind CHECK (wind_speed_mps IS NULL OR wind_speed_mps >= 0),
    CONSTRAINT ck_site_diary_weather_rain CHECK (rainfall_mm IS NULL OR rainfall_mm >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE site_diary_worker_entries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_diary_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    worker_id BIGINT UNSIGNED NOT NULL,
    attendance_record_id BIGINT UNSIGNED NULL,
    hours_on_site DECIMAL(7,2) NULL,
    activity_summary VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_site_diary_worker (site_diary_id, worker_id, attendance_record_id),
    KEY idx_site_diary_worker_worker (worker_id, owning_organisation_id),
    CONSTRAINT fk_site_diary_worker_diary
        FOREIGN KEY (site_diary_id, owning_organisation_id)
        REFERENCES site_diaries (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_site_diary_worker_worker
        FOREIGN KEY (worker_id, owning_organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_site_diary_worker_attendance
        FOREIGN KEY (attendance_record_id, owning_organisation_id)
        REFERENCES attendance_records (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_site_diary_worker_hours CHECK (hours_on_site IS NULL OR hours_on_site >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE site_diary_labour_groups (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_diary_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    contractor_party_id BIGINT UNSIGNED NULL,
    trade_description VARCHAR(255) NOT NULL,
    headcount SMALLINT UNSIGNED NOT NULL,
    total_hours DECIMAL(9,2) NULL,
    notes VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_site_diary_labour_diary
        FOREIGN KEY (site_diary_id, owning_organisation_id)
        REFERENCES site_diaries (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_site_diary_labour_party
        FOREIGN KEY (contractor_party_id, owning_organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_site_diary_labour_headcount CHECK (headcount > 0),
    CONSTRAINT ck_site_diary_labour_hours CHECK (total_hours IS NULL OR total_hours >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE site_diary_plant_entries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_diary_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    plant_description VARCHAR(255) NOT NULL,
    plant_reference_snapshot VARCHAR(160) NULL,
    operator_worker_id BIGINT UNSIGNED NULL,
    operating_hours DECIMAL(7,2) NULL,
    notes VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_site_diary_plant_diary
        FOREIGN KEY (site_diary_id, owning_organisation_id)
        REFERENCES site_diaries (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_site_diary_plant_operator
        FOREIGN KEY (operator_worker_id, owning_organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_site_diary_plant_hours CHECK (operating_hours IS NULL OR operating_hours >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE site_diary_activities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_diary_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    activity_reference VARCHAR(120) NULL,
    description TEXT NOT NULL,
    location_description VARCHAR(255) NULL,
    progress_percent DECIMAL(5,2) NULL,
    started_at DATETIME(6) NULL,
    ended_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_site_diary_activities_diary
        FOREIGN KEY (site_diary_id, owning_organisation_id)
        REFERENCES site_diaries (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_site_diary_activities_progress
        CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100)),
    CONSTRAINT ck_site_diary_activities_times
        CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE site_diary_delays (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_diary_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    delay_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    description TEXT NOT NULL,
    duration_minutes INT UNSIGNED NULL,
    impact_summary VARCHAR(1000) NULL,
    project_change_event_id BIGINT UNSIGNED NULL,
    change_owner_organisation_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_site_diary_delays_change (project_change_event_id, change_owner_organisation_id),
    CONSTRAINT fk_site_diary_delays_diary
        FOREIGN KEY (site_diary_id, owning_organisation_id)
        REFERENCES site_diaries (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_site_diary_delays_change
        FOREIGN KEY (project_change_event_id, change_owner_organisation_id)
        REFERENCES project_change_events (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_site_diary_delays_type
        CHECK (delay_type IN (
            'weather', 'labour', 'plant', 'material', 'information', 'access',
            'client', 'design', 'safety', 'quality', 'utility', 'other'
        )),
    CONSTRAINT ck_site_diary_delays_change_pair
        CHECK (
            (project_change_event_id IS NULL AND change_owner_organisation_id IS NULL)
            OR (project_change_event_id IS NOT NULL AND change_owner_organisation_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE site_diary_notes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_diary_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    note_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'general',
    note_text TEXT NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_site_diary_notes_diary
        FOREIGN KEY (site_diary_id, owning_organisation_id)
        REFERENCES site_diaries (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_site_diary_notes_creator
        FOREIGN KEY (created_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_site_diary_notes_type
        CHECK (note_type IN ('general', 'coordination', 'client', 'commercial', 'quality', 'safety', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE site_diary_information_links (
    site_diary_id BIGINT UNSIGNED NOT NULL,
    diary_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'evidence',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (site_diary_id, information_container_version_id, link_role),
    CONSTRAINT fk_site_diary_info_diary
        FOREIGN KEY (site_diary_id, diary_owner_organisation_id)
        REFERENCES site_diaries (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_site_diary_info_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_site_diary_info_role
        CHECK (link_role IN ('evidence', 'photo', 'drawing', 'instruction', 'report', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Deliveries and visitors
-- -----------------------------------------------------------------------------

CREATE TABLE site_deliveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    project_site_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    supplier_party_id BIGINT UNSIGNED NULL,
    delivery_reference VARCHAR(160) NULL,
    delivery_note_reference VARCHAR(160) NULL,
    received_at DATETIME(6) NOT NULL,
    received_by_member_id BIGINT UNSIGNED NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'received',
    notes VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_site_deliveries_public_id (public_id),
    UNIQUE KEY uq_site_deliveries_id_owner (id, owning_organisation_id),
    KEY idx_site_deliveries_project (project_id, project_site_id, received_at),
    CONSTRAINT fk_site_deliveries_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_site_deliveries_site
        FOREIGN KEY (project_site_id, project_id)
        REFERENCES project_sites (id, project_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_site_deliveries_supplier
        FOREIGN KEY (supplier_party_id, owning_organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_site_deliveries_receiver
        FOREIGN KEY (received_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_site_deliveries_status
        CHECK (status IN ('expected', 'received', 'part_received', 'rejected', 'returned', 'cancelled'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE site_delivery_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_delivery_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    line_number SMALLINT UNSIGNED NOT NULL,
    description VARCHAR(500) NOT NULL,
    quantity DECIMAL(19,4) NULL,
    unit_of_measure_id SMALLINT UNSIGNED NULL,
    accepted_quantity DECIMAL(19,4) NULL,
    rejected_quantity DECIMAL(19,4) NULL,
    notes VARCHAR(1000) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_site_delivery_items_line (site_delivery_id, line_number),
    CONSTRAINT fk_site_delivery_items_delivery
        FOREIGN KEY (site_delivery_id, owning_organisation_id)
        REFERENCES site_deliveries (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_site_delivery_items_uom
        FOREIGN KEY (unit_of_measure_id)
        REFERENCES units_of_measure (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_site_delivery_items_qty CHECK (quantity IS NULL OR quantity >= 0),
    CONSTRAINT ck_site_delivery_items_accepted CHECK (accepted_quantity IS NULL OR accepted_quantity >= 0),
    CONSTRAINT ck_site_delivery_items_rejected CHECK (rejected_quantity IS NULL OR rejected_quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE site_diary_deliveries (
    site_diary_id BIGINT UNSIGNED NOT NULL,
    site_delivery_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (site_diary_id, site_delivery_id),
    CONSTRAINT fk_site_diary_deliveries_diary
        FOREIGN KEY (site_diary_id, owning_organisation_id)
        REFERENCES site_diaries (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_site_diary_deliveries_delivery
        FOREIGN KEY (site_delivery_id, owning_organisation_id)
        REFERENCES site_deliveries (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE site_visitor_entries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    project_site_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    person_party_id BIGINT UNSIGNED NULL,
    visitor_name_snapshot VARCHAR(255) NOT NULL,
    organisation_name_snapshot VARCHAR(255) NULL,
    purpose VARCHAR(500) NULL,
    host_member_id BIGINT UNSIGNED NULL,
    entered_at DATETIME(6) NOT NULL,
    exited_at DATETIME(6) NULL,
    badge_reference VARCHAR(80) NULL,
    notes VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_site_visitor_entries_public_id (public_id),
    UNIQUE KEY uq_site_visitor_entries_id_owner (id, owning_organisation_id),
    KEY idx_site_visitor_entries_site_time (project_id, project_site_id, entered_at),
    CONSTRAINT fk_site_visitor_entries_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_site_visitor_entries_site
        FOREIGN KEY (project_site_id, project_id)
        REFERENCES project_sites (id, project_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_site_visitor_entries_party
        FOREIGN KEY (person_party_id, owning_organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_site_visitor_entries_host
        FOREIGN KEY (host_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_site_visitor_entries_times CHECK (exited_at IS NULL OR exited_at >= entered_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE site_diary_visitors (
    site_diary_id BIGINT UNSIGNED NOT NULL,
    site_visitor_entry_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (site_diary_id, site_visitor_entry_id),
    CONSTRAINT fk_site_diary_visitors_diary
        FOREIGN KEY (site_diary_id, owning_organisation_id)
        REFERENCES site_diaries (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_site_diary_visitors_entry
        FOREIGN KEY (site_visitor_entry_id, owning_organisation_id)
        REFERENCES site_visitor_entries (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Quality inspection templates
-- -----------------------------------------------------------------------------

CREATE TABLE quality_inspection_templates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_inspection_templates_public_id (public_id),
    UNIQUE KEY uq_quality_inspection_templates_id_org (id, organisation_id),
    UNIQUE KEY uq_quality_inspection_templates_code (organisation_id, code),
    CONSTRAINT fk_quality_inspection_templates_org
        FOREIGN KEY (organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_quality_inspection_templates_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quality_inspection_template_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    quality_inspection_template_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    published_at DATETIME(6) NULL,
    published_by_member_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_template_versions_public_id (public_id),
    UNIQUE KEY uq_quality_template_versions_id_org (id, organisation_id),
    UNIQUE KEY uq_quality_template_versions_number (
        organisation_id, quality_inspection_template_id, version_number
    ),
    CONSTRAINT fk_quality_template_versions_template
        FOREIGN KEY (quality_inspection_template_id, organisation_id)
        REFERENCES quality_inspection_templates (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_quality_template_versions_publisher
        FOREIGN KEY (published_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_quality_template_versions_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_quality_template_versions_number CHECK (version_number > 0),
    CONSTRAINT ck_quality_template_versions_status
        CHECK (status IN ('draft', 'published', 'retired', 'cancelled')),
    CONSTRAINT ck_quality_template_versions_published
        CHECK (
            (published_at IS NULL AND published_by_member_id IS NULL)
            OR (published_at IS NOT NULL AND published_by_member_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quality_inspection_template_sections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    quality_inspection_template_version_id BIGINT UNSIGNED NOT NULL,
    section_number SMALLINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_template_sections_context (
        id, quality_inspection_template_version_id, organisation_id
    ),
    UNIQUE KEY uq_quality_template_sections_number (
        quality_inspection_template_version_id, section_number
    ),
    CONSTRAINT fk_quality_template_sections_version
        FOREIGN KEY (quality_inspection_template_version_id, organisation_id)
        REFERENCES quality_inspection_template_versions (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_quality_template_sections_number CHECK (section_number > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quality_inspection_template_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    quality_inspection_template_version_id BIGINT UNSIGNED NOT NULL,
    quality_inspection_template_section_id BIGINT UNSIGNED NOT NULL,
    item_number SMALLINT UNSIGNED NOT NULL,
    quality_inspection_item_type_id SMALLINT UNSIGNED NOT NULL,
    prompt_text VARCHAR(1000) NOT NULL,
    guidance_text TEXT NULL,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    allow_finding BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_template_items_context (
        id, quality_inspection_template_version_id, organisation_id
    ),
    UNIQUE KEY uq_quality_template_items_number (
        quality_inspection_template_section_id, item_number
    ),
    CONSTRAINT fk_quality_template_items_section
        FOREIGN KEY (
            quality_inspection_template_section_id,
            quality_inspection_template_version_id,
            organisation_id
        ) REFERENCES quality_inspection_template_sections (
            id, quality_inspection_template_version_id, organisation_id
        ) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_quality_template_items_type
        FOREIGN KEY (quality_inspection_item_type_id)
        REFERENCES quality_inspection_item_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_quality_template_items_number CHECK (item_number > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quality_inspection_item_options (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    quality_inspection_template_item_id BIGINT UNSIGNED NOT NULL,
    quality_inspection_template_version_id BIGINT UNSIGNED NOT NULL,
    option_code VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    option_label VARCHAR(255) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_item_options_context (id, quality_inspection_template_item_id, organisation_id),
    UNIQUE KEY uq_quality_item_options_code (quality_inspection_template_item_id, option_code),
    UNIQUE KEY uq_quality_item_options_sort (quality_inspection_template_item_id, sort_order),
    CONSTRAINT fk_quality_item_options_item
        FOREIGN KEY (
            quality_inspection_template_item_id,
            quality_inspection_template_version_id,
            organisation_id
        ) REFERENCES quality_inspection_template_items (
            id, quality_inspection_template_version_id, organisation_id
        ) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_quality_item_options_sort CHECK (sort_order > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Quality inspections and responses
-- -----------------------------------------------------------------------------

CREATE TABLE quality_inspections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    project_site_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    inspection_number VARCHAR(120) NOT NULL,
    quality_inspection_template_version_id BIGINT UNSIGNED NULL,
    title VARCHAR(500) NOT NULL,
    location_description VARCHAR(255) NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    scheduled_at DATETIME(6) NULL,
    started_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    inspected_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_inspections_public_id (public_id),
    UNIQUE KEY uq_quality_inspections_id_owner (id, owning_organisation_id),
    UNIQUE KEY uq_quality_inspections_template_context (
        id, quality_inspection_template_version_id, owning_organisation_id
    ),
    UNIQUE KEY uq_quality_inspections_number (
        project_id, owning_organisation_id, inspection_number
    ),
    KEY idx_quality_inspections_site_status (project_id, project_site_id, status, scheduled_at),
    CONSTRAINT fk_quality_inspections_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_quality_inspections_site
        FOREIGN KEY (project_site_id, project_id)
        REFERENCES project_sites (id, project_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_quality_inspections_template
        FOREIGN KEY (quality_inspection_template_version_id, owning_organisation_id)
        REFERENCES quality_inspection_template_versions (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_quality_inspections_inspector
        FOREIGN KEY (inspected_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_quality_inspections_status
        CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled', 'void')),
    CONSTRAINT ck_quality_inspections_times
        CHECK (
            (started_at IS NULL OR scheduled_at IS NULL OR started_at >= scheduled_at)
            AND (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quality_inspection_responses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    quality_inspection_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    quality_inspection_template_version_id BIGINT UNSIGNED NOT NULL,
    quality_inspection_template_item_id BIGINT UNSIGNED NOT NULL,
    result_code VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'not_checked',
    response_text TEXT NULL,
    response_decimal DECIMAL(19,6) NULL,
    response_boolean BOOLEAN NULL,
    response_date DATE NULL,
    selected_option_id BIGINT UNSIGNED NULL,
    comments TEXT NULL,
    responded_by_member_id BIGINT UNSIGNED NOT NULL,
    responded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_inspection_responses_item (
        quality_inspection_id, quality_inspection_template_item_id
    ),
    CONSTRAINT fk_quality_responses_inspection
        FOREIGN KEY (
            quality_inspection_id,
            quality_inspection_template_version_id,
            owning_organisation_id
        ) REFERENCES quality_inspections (
            id, quality_inspection_template_version_id, owning_organisation_id
        ) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_quality_responses_item
        FOREIGN KEY (
            quality_inspection_template_item_id,
            quality_inspection_template_version_id,
            owning_organisation_id
        ) REFERENCES quality_inspection_template_items (
            id, quality_inspection_template_version_id, organisation_id
        ) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_quality_responses_option
        FOREIGN KEY (selected_option_id, quality_inspection_template_item_id, owning_organisation_id)
        REFERENCES quality_inspection_item_options (id, quality_inspection_template_item_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_quality_responses_member
        FOREIGN KEY (responded_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_quality_responses_result
        CHECK (result_code IN ('not_checked', 'pass', 'fail', 'not_applicable', 'observation'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE quality_inspection_findings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    quality_inspection_id BIGINT UNSIGNED NOT NULL,
    quality_inspection_response_id BIGINT UNSIGNED NULL,
    quality_finding_type_id SMALLINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'medium',
    raised_by_member_id BIGINT UNSIGNED NOT NULL,
    raised_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_quality_inspection_findings_public_id (public_id),
    UNIQUE KEY uq_quality_inspection_findings_id_owner (id, owning_organisation_id),
    KEY idx_quality_findings_inspection (quality_inspection_id, owning_organisation_id),
    CONSTRAINT fk_quality_findings_inspection
        FOREIGN KEY (quality_inspection_id, owning_organisation_id)
        REFERENCES quality_inspections (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_quality_findings_response
        FOREIGN KEY (quality_inspection_response_id)
        REFERENCES quality_inspection_responses (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_quality_findings_type
        FOREIGN KEY (quality_finding_type_id)
        REFERENCES quality_finding_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_quality_findings_raiser
        FOREIGN KEY (raised_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_quality_findings_severity
        CHECK (severity IN ('low', 'medium', 'high', 'critical'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Defects / snagging
-- -----------------------------------------------------------------------------

CREATE TABLE defect_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    project_site_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    defect_number VARCHAR(120) NOT NULL,
    source_inspection_finding_id BIGINT UNSIGNED NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    location_description VARCHAR(255) NULL,
    severity VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'medium',
    status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    responsible_organisation_id BIGINT UNSIGNED NULL,
    responsible_member_id BIGINT UNSIGNED NULL,
    target_date DATE NULL,
    raised_by_member_id BIGINT UNSIGNED NOT NULL,
    raised_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    closed_by_member_id BIGINT UNSIGNED NULL,
    closed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_defect_records_public_id (public_id),
    UNIQUE KEY uq_defect_records_id_owner (id, owning_organisation_id),
    UNIQUE KEY uq_defect_records_number (project_id, owning_organisation_id, defect_number),
    KEY idx_defect_records_status (project_id, status, target_date),
    CONSTRAINT fk_defect_records_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_defect_records_site
        FOREIGN KEY (project_site_id, project_id)
        REFERENCES project_sites (id, project_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_defect_records_finding
        FOREIGN KEY (source_inspection_finding_id, owning_organisation_id)
        REFERENCES quality_inspection_findings (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_defect_records_resp_org
        FOREIGN KEY (project_id, responsible_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_defect_records_resp_member
        FOREIGN KEY (responsible_member_id, responsible_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_defect_records_raiser
        FOREIGN KEY (raised_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_defect_records_closer
        FOREIGN KEY (closed_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_defect_records_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT ck_defect_records_status
        CHECK (status IN ('open', 'assigned', 'in_progress', 'ready_for_review', 'closed', 'reopened', 'cancelled')),
    CONSTRAINT ck_defect_records_responsible
        CHECK (
            (responsible_organisation_id IS NULL AND responsible_member_id IS NULL)
            OR responsible_organisation_id IS NOT NULL
        ),
    CONSTRAINT ck_defect_records_closed
        CHECK (
            (closed_at IS NULL AND closed_by_member_id IS NULL)
            OR (closed_at IS NOT NULL AND closed_by_member_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE defect_actions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    defect_record_id BIGINT UNSIGNED NOT NULL,
    defect_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    action_text TEXT NOT NULL,
    responsible_organisation_id BIGINT UNSIGNED NULL,
    responsible_member_id BIGINT UNSIGNED NULL,
    target_date DATE NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    completed_by_member_id BIGINT UNSIGNED NULL,
    completed_at DATETIME(6) NULL,
    completion_note TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_defect_actions_defect
        FOREIGN KEY (defect_record_id, defect_owner_organisation_id)
        REFERENCES defect_records (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_defect_actions_resp_member
        FOREIGN KEY (responsible_member_id, responsible_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_defect_actions_completed_by
        FOREIGN KEY (completed_by_member_id, defect_owner_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_defect_actions_status
        CHECK (status IN ('open', 'in_progress', 'completed', 'verified', 'cancelled')),
    CONSTRAINT ck_defect_actions_responsible
        CHECK (
            (responsible_organisation_id IS NULL AND responsible_member_id IS NULL)
            OR responsible_organisation_id IS NOT NULL
        ),
    CONSTRAINT ck_defect_actions_completed
        CHECK (
            (completed_at IS NULL AND completed_by_member_id IS NULL)
            OR (completed_at IS NOT NULL AND completed_by_member_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE defect_information_links (
    defect_record_id BIGINT UNSIGNED NOT NULL,
    defect_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'evidence',
    PRIMARY KEY (defect_record_id, information_container_version_id, link_role),
    CONSTRAINT fk_defect_info_defect
        FOREIGN KEY (defect_record_id, defect_owner_organisation_id)
        REFERENCES defect_records (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_defect_info_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_defect_info_role
        CHECK (link_role IN ('evidence', 'photo', 'drawing', 'specification', 'closeout', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Non-conformance reports
-- -----------------------------------------------------------------------------

CREATE TABLE nonconformance_reports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    project_site_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    ncr_number VARCHAR(120) NOT NULL,
    source_inspection_finding_id BIGINT UNSIGNED NULL,
    title VARCHAR(500) NOT NULL,
    nonconformance_statement TEXT NOT NULL,
    severity VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'medium',
    immediate_containment TEXT NULL,
    root_cause TEXT NULL,
    proposed_disposition TEXT NULL,
    status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    responsible_organisation_id BIGINT UNSIGNED NULL,
    responsible_member_id BIGINT UNSIGNED NULL,
    target_date DATE NULL,
    raised_by_member_id BIGINT UNSIGNED NOT NULL,
    raised_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    closed_by_member_id BIGINT UNSIGNED NULL,
    closed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_ncr_public_id (public_id),
    UNIQUE KEY uq_ncr_id_owner (id, owning_organisation_id),
    UNIQUE KEY uq_ncr_number (project_id, owning_organisation_id, ncr_number),
    KEY idx_ncr_status (project_id, status, target_date),
    CONSTRAINT fk_ncr_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_ncr_site
        FOREIGN KEY (project_site_id, project_id)
        REFERENCES project_sites (id, project_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_ncr_finding
        FOREIGN KEY (source_inspection_finding_id, owning_organisation_id)
        REFERENCES quality_inspection_findings (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_ncr_resp_org
        FOREIGN KEY (project_id, responsible_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_ncr_resp_member
        FOREIGN KEY (responsible_member_id, responsible_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_ncr_raiser
        FOREIGN KEY (raised_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_ncr_closer
        FOREIGN KEY (closed_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_ncr_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT ck_ncr_status
        CHECK (status IN ('open', 'containment', 'investigation', 'corrective_action', 'verification', 'closed', 'reopened', 'cancelled')),
    CONSTRAINT ck_ncr_responsible
        CHECK (
            (responsible_organisation_id IS NULL AND responsible_member_id IS NULL)
            OR responsible_organisation_id IS NOT NULL
        ),
    CONSTRAINT ck_ncr_closed
        CHECK (
            (closed_at IS NULL AND closed_by_member_id IS NULL)
            OR (closed_at IS NOT NULL AND closed_by_member_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE ncr_actions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nonconformance_report_id BIGINT UNSIGNED NOT NULL,
    ncr_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    action_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'corrective',
    action_text TEXT NOT NULL,
    responsible_organisation_id BIGINT UNSIGNED NULL,
    responsible_member_id BIGINT UNSIGNED NULL,
    target_date DATE NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    completed_by_member_id BIGINT UNSIGNED NULL,
    completed_at DATETIME(6) NULL,
    verification_note TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_ncr_actions_ncr
        FOREIGN KEY (nonconformance_report_id, ncr_owner_organisation_id)
        REFERENCES nonconformance_reports (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_ncr_actions_resp_member
        FOREIGN KEY (responsible_member_id, responsible_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_ncr_actions_completed_by
        FOREIGN KEY (completed_by_member_id, ncr_owner_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_ncr_actions_type
        CHECK (action_type IN ('containment', 'corrective', 'preventive', 'verification')),
    CONSTRAINT ck_ncr_actions_status
        CHECK (status IN ('open', 'in_progress', 'completed', 'verified', 'cancelled')),
    CONSTRAINT ck_ncr_actions_responsible
        CHECK (
            (responsible_organisation_id IS NULL AND responsible_member_id IS NULL)
            OR responsible_organisation_id IS NOT NULL
        ),
    CONSTRAINT ck_ncr_actions_completed
        CHECK (
            (completed_at IS NULL AND completed_by_member_id IS NULL)
            OR (completed_at IS NOT NULL AND completed_by_member_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE ncr_information_links (
    nonconformance_report_id BIGINT UNSIGNED NOT NULL,
    ncr_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'evidence',
    PRIMARY KEY (nonconformance_report_id, information_container_version_id, link_role),
    CONSTRAINT fk_ncr_info_ncr
        FOREIGN KEY (nonconformance_report_id, ncr_owner_organisation_id)
        REFERENCES nonconformance_reports (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_ncr_info_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_ncr_info_role
        CHECK (link_role IN ('evidence', 'photo', 'drawing', 'specification', 'method', 'closeout', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE ncr_defect_links (
    nonconformance_report_id BIGINT UNSIGNED NOT NULL,
    ncr_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    defect_record_id BIGINT UNSIGNED NOT NULL,
    defect_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (nonconformance_report_id, defect_record_id),
    CONSTRAINT fk_ncr_defect_links_ncr
        FOREIGN KEY (nonconformance_report_id, ncr_owner_organisation_id)
        REFERENCES nonconformance_reports (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_ncr_defect_links_defect
        FOREIGN KEY (defect_record_id, defect_owner_organisation_id)
        REFERENCES defect_records (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- RAMS register and approval evidence
-- -----------------------------------------------------------------------------

CREATE TABLE rams_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    project_site_id BIGINT UNSIGNED NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    rams_number VARCHAR(120) NOT NULL,
    title VARCHAR(500) NOT NULL,
    information_container_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_rams_records_public_id (public_id),
    UNIQUE KEY uq_rams_records_id_owner (id, owning_organisation_id),
    UNIQUE KEY uq_rams_records_number (project_id, owning_organisation_id, rams_number),
    UNIQUE KEY uq_rams_records_container (information_container_id, owning_organisation_id),
    CONSTRAINT fk_rams_records_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_rams_records_site
        FOREIGN KEY (project_site_id, project_id)
        REFERENCES project_sites (id, project_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_rams_records_container
        FOREIGN KEY (information_container_id, project_id, owning_organisation_id)
        REFERENCES information_containers (id, project_id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_rams_records_creator
        FOREIGN KEY (created_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_rams_records_status CHECK (status IN ('active', 'closed', 'cancelled', 'archived'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE rams_approval_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    rams_record_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    decision VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    decided_by_member_id BIGINT UNSIGNED NOT NULL,
    decided_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    comments TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_rams_approval_events_version_decision (
        rams_record_id, information_container_version_id, decision, decided_at
    ),
    CONSTRAINT fk_rams_approval_events_rams
        FOREIGN KEY (rams_record_id, owning_organisation_id)
        REFERENCES rams_records (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_rams_approval_events_version
        FOREIGN KEY (
            information_container_version_id,
            owning_organisation_id,
            rams_record_id
        ) REFERENCES information_container_versions (
            id, owning_organisation_id, information_container_id
        ) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_rams_approval_events_member
        FOREIGN KEY (decided_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_rams_approval_events_decision
        CHECK (decision IN ('approved', 'approved_with_conditions', 'rejected', 'withdrawn'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Safety briefings / toolbox talks / inductions
-- -----------------------------------------------------------------------------

CREATE TABLE safety_briefings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    project_site_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    safety_briefing_type_id SMALLINT UNSIGNED NOT NULL,
    briefing_reference VARCHAR(120) NULL,
    title VARCHAR(500) NOT NULL,
    topic_summary TEXT NULL,
    held_at DATETIME(6) NOT NULL,
    delivered_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_safety_briefings_public_id (public_id),
    UNIQUE KEY uq_safety_briefings_id_owner (id, owning_organisation_id),
    KEY idx_safety_briefings_site_time (project_id, project_site_id, held_at),
    CONSTRAINT fk_safety_briefings_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_safety_briefings_site
        FOREIGN KEY (project_site_id, project_id)
        REFERENCES project_sites (id, project_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_safety_briefings_type
        FOREIGN KEY (safety_briefing_type_id)
        REFERENCES safety_briefing_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_safety_briefings_deliverer
        FOREIGN KEY (delivered_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE safety_briefing_attendees (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    safety_briefing_id BIGINT UNSIGNED NOT NULL,
    briefing_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    attendee_worker_id BIGINT UNSIGNED NULL,
    attendee_worker_organisation_id BIGINT UNSIGNED NULL,
    attendee_name_snapshot VARCHAR(255) NOT NULL,
    attendee_organisation_snapshot VARCHAR(255) NULL,
    acknowledged_at DATETIME(6) NULL,
    notes VARCHAR(500) NULL,
    PRIMARY KEY (id),
    KEY idx_safety_briefing_attendees_worker (attendee_worker_id, attendee_worker_organisation_id),
    CONSTRAINT fk_safety_briefing_attendees_briefing
        FOREIGN KEY (safety_briefing_id, briefing_owner_organisation_id)
        REFERENCES safety_briefings (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_safety_briefing_attendees_worker
        FOREIGN KEY (attendee_worker_id, attendee_worker_organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_safety_briefing_attendee_worker_pair
        CHECK (
            (attendee_worker_id IS NULL AND attendee_worker_organisation_id IS NULL)
            OR (attendee_worker_id IS NOT NULL AND attendee_worker_organisation_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE safety_briefing_information_links (
    safety_briefing_id BIGINT UNSIGNED NOT NULL,
    briefing_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'briefed',
    PRIMARY KEY (safety_briefing_id, information_container_version_id, link_role),
    CONSTRAINT fk_safety_briefing_info_briefing
        FOREIGN KEY (safety_briefing_id, briefing_owner_organisation_id)
        REFERENCES safety_briefings (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_safety_briefing_info_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_safety_briefing_info_role
        CHECK (link_role IN ('briefed', 'rams', 'drawing', 'procedure', 'evidence', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Permits to work
-- -----------------------------------------------------------------------------

CREATE TABLE permits_to_work (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    project_site_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    permit_number VARCHAR(120) NOT NULL,
    permit_type_id SMALLINT UNSIGNED NOT NULL,
    work_description TEXT NOT NULL,
    location_description VARCHAR(255) NULL,
    responsible_organisation_id BIGINT UNSIGNED NULL,
    valid_from DATETIME(6) NOT NULL,
    valid_to DATETIME(6) NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    issued_by_member_id BIGINT UNSIGNED NOT NULL,
    issued_at DATETIME(6) NULL,
    suspended_at DATETIME(6) NULL,
    closed_by_member_id BIGINT UNSIGNED NULL,
    closed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_permits_to_work_public_id (public_id),
    UNIQUE KEY uq_permits_to_work_id_owner (id, owning_organisation_id),
    UNIQUE KEY uq_permits_to_work_number (project_id, owning_organisation_id, permit_number),
    KEY idx_permits_to_work_validity (project_id, project_site_id, status, valid_from, valid_to),
    CONSTRAINT fk_permits_to_work_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_permits_to_work_site
        FOREIGN KEY (project_site_id, project_id)
        REFERENCES project_sites (id, project_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_permits_to_work_type
        FOREIGN KEY (permit_type_id) REFERENCES permit_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_permits_to_work_resp_org
        FOREIGN KEY (project_id, responsible_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_permits_to_work_issuer
        FOREIGN KEY (issued_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_permits_to_work_closer
        FOREIGN KEY (closed_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_permits_to_work_validity CHECK (valid_to > valid_from),
    CONSTRAINT ck_permits_to_work_status
        CHECK (status IN ('draft', 'issued', 'active', 'suspended', 'expired', 'closed', 'cancelled')),
    CONSTRAINT ck_permits_to_work_issued
        CHECK (issued_at IS NULL OR status IN ('issued', 'active', 'suspended', 'expired', 'closed', 'cancelled')),
    CONSTRAINT ck_permits_to_work_closed
        CHECK (
            (closed_at IS NULL AND closed_by_member_id IS NULL)
            OR (closed_at IS NOT NULL AND closed_by_member_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE permit_authorised_persons (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    permit_to_work_id BIGINT UNSIGNED NOT NULL,
    permit_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    worker_id BIGINT UNSIGNED NULL,
    worker_organisation_id BIGINT UNSIGNED NULL,
    person_name_snapshot VARCHAR(255) NOT NULL,
    organisation_name_snapshot VARCHAR(255) NULL,
    role_description VARCHAR(160) NULL,
    authorised_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_permit_authorised_persons_worker (worker_id, worker_organisation_id),
    CONSTRAINT fk_permit_authorised_persons_permit
        FOREIGN KEY (permit_to_work_id, permit_owner_organisation_id)
        REFERENCES permits_to_work (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_permit_authorised_persons_worker
        FOREIGN KEY (worker_id, worker_organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_permit_authorised_persons_worker
        CHECK (
            (worker_id IS NULL AND worker_organisation_id IS NULL)
            OR (worker_id IS NOT NULL AND worker_organisation_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE permit_controls (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    permit_to_work_id BIGINT UNSIGNED NOT NULL,
    permit_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    control_number SMALLINT UNSIGNED NOT NULL,
    control_text TEXT NOT NULL,
    confirmation_required BOOLEAN NOT NULL DEFAULT TRUE,
    confirmed_by_member_id BIGINT UNSIGNED NULL,
    confirmed_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_permit_controls_number (permit_to_work_id, control_number),
    CONSTRAINT fk_permit_controls_permit
        FOREIGN KEY (permit_to_work_id, permit_owner_organisation_id)
        REFERENCES permits_to_work (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_permit_controls_confirmer
        FOREIGN KEY (confirmed_by_member_id, permit_owner_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_permit_controls_number CHECK (control_number > 0),
    CONSTRAINT ck_permit_controls_confirm
        CHECK (
            (confirmed_at IS NULL AND confirmed_by_member_id IS NULL)
            OR (confirmed_at IS NOT NULL AND confirmed_by_member_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE permit_information_links (
    permit_to_work_id BIGINT UNSIGNED NOT NULL,
    permit_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'basis',
    PRIMARY KEY (permit_to_work_id, information_container_version_id, link_role),
    CONSTRAINT fk_permit_info_permit
        FOREIGN KEY (permit_to_work_id, permit_owner_organisation_id)
        REFERENCES permits_to_work (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_permit_info_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_permit_info_role
        CHECK (link_role IN ('basis', 'rams', 'drawing', 'isolation', 'evidence', 'closeout', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Safety-event supertype and subtypes
-- -----------------------------------------------------------------------------

CREATE TABLE safety_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    project_site_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    event_number VARCHAR(120) NOT NULL,
    event_kind VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    location_description VARCHAR(255) NULL,
    occurred_at DATETIME(6) NOT NULL,
    reported_by_member_id BIGINT UNSIGNED NOT NULL,
    reported_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'reported',
    closed_by_member_id BIGINT UNSIGNED NULL,
    closed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_safety_events_public_id (public_id),
    UNIQUE KEY uq_safety_events_id_owner (id, owning_organisation_id),
    UNIQUE KEY uq_safety_events_number (project_id, owning_organisation_id, event_number),
    KEY idx_safety_events_site_time (project_id, project_site_id, event_kind, occurred_at),
    KEY idx_safety_events_status (project_id, status, occurred_at),
    CONSTRAINT fk_safety_events_participant
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES project_organisations (project_id, participant_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_safety_events_site
        FOREIGN KEY (project_site_id, project_id)
        REFERENCES project_sites (id, project_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_safety_events_reporter
        FOREIGN KEY (reported_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_safety_events_closer
        FOREIGN KEY (closed_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_safety_events_kind
        CHECK (event_kind IN ('incident', 'near_miss', 'observation')),
    CONSTRAINT ck_safety_events_status
        CHECK (status IN ('reported', 'triage', 'investigation', 'action', 'closed', 'cancelled')),
    CONSTRAINT ck_safety_events_closed
        CHECK (
            (closed_at IS NULL AND closed_by_member_id IS NULL)
            OR (closed_at IS NOT NULL AND closed_by_member_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE safety_incidents (
    safety_event_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    severity VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'medium',
    injury_occurred BOOLEAN NOT NULL DEFAULT FALSE,
    property_damage_occurred BOOLEAN NOT NULL DEFAULT FALSE,
    environmental_impact_occurred BOOLEAN NOT NULL DEFAULT FALSE,
    immediate_response TEXT NULL,
    investigation_summary TEXT NULL,
    external_report_reference VARCHAR(160) NULL,
    PRIMARY KEY (safety_event_id),
    CONSTRAINT fk_safety_incidents_event
        FOREIGN KEY (safety_event_id, owning_organisation_id)
        REFERENCES safety_events (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_safety_incidents_severity
        CHECK (severity IN ('low', 'medium', 'high', 'critical', 'fatal'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE safety_near_misses (
    safety_event_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    potential_severity VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'medium',
    potential_outcome TEXT NULL,
    immediate_control TEXT NULL,
    PRIMARY KEY (safety_event_id),
    CONSTRAINT fk_safety_near_misses_event
        FOREIGN KEY (safety_event_id, owning_organisation_id)
        REFERENCES safety_events (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_safety_near_misses_severity
        CHECK (potential_severity IN ('low', 'medium', 'high', 'critical', 'fatal'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE safety_observations (
    safety_event_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    observation_category VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    is_positive_observation BOOLEAN NOT NULL DEFAULT FALSE,
    immediate_action_taken TEXT NULL,
    PRIMARY KEY (safety_event_id),
    CONSTRAINT fk_safety_observations_event
        FOREIGN KEY (safety_event_id, owning_organisation_id)
        REFERENCES safety_events (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_safety_observations_category
        CHECK (observation_category IN ('condition', 'behaviour', 'process', 'housekeeping', 'environment', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE safety_event_people (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    safety_event_id BIGINT UNSIGNED NOT NULL,
    event_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    worker_id BIGINT UNSIGNED NULL,
    worker_organisation_id BIGINT UNSIGNED NULL,
    person_name_snapshot VARCHAR(255) NOT NULL,
    organisation_name_snapshot VARCHAR(255) NULL,
    involvement_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    injury_summary TEXT NULL,
    treatment_summary TEXT NULL,
    lost_time_days DECIMAL(7,2) NULL,
    PRIMARY KEY (id),
    KEY idx_safety_event_people_worker (worker_id, worker_organisation_id),
    CONSTRAINT fk_safety_event_people_event
        FOREIGN KEY (safety_event_id, event_owner_organisation_id)
        REFERENCES safety_events (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_safety_event_people_worker
        FOREIGN KEY (worker_id, worker_organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_safety_event_people_worker_pair
        CHECK (
            (worker_id IS NULL AND worker_organisation_id IS NULL)
            OR (worker_id IS NOT NULL AND worker_organisation_id IS NOT NULL)
        ),
    CONSTRAINT ck_safety_event_people_involvement
        CHECK (involvement_type IN ('injured', 'involved', 'witness', 'reporter', 'first_aider', 'other')),
    CONSTRAINT ck_safety_event_people_lost_time
        CHECK (lost_time_days IS NULL OR lost_time_days >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE safety_actions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    safety_event_id BIGINT UNSIGNED NOT NULL,
    event_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    action_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'corrective',
    action_text TEXT NOT NULL,
    responsible_organisation_id BIGINT UNSIGNED NULL,
    responsible_member_id BIGINT UNSIGNED NULL,
    target_date DATE NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    completed_by_member_id BIGINT UNSIGNED NULL,
    completed_at DATETIME(6) NULL,
    verification_note TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_safety_actions_event
        FOREIGN KEY (safety_event_id, event_owner_organisation_id)
        REFERENCES safety_events (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_safety_actions_resp_member
        FOREIGN KEY (responsible_member_id, responsible_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_safety_actions_completed_by
        FOREIGN KEY (completed_by_member_id, event_owner_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_safety_actions_type
        CHECK (action_type IN ('immediate', 'corrective', 'preventive', 'investigation', 'verification')),
    CONSTRAINT ck_safety_actions_status
        CHECK (status IN ('open', 'in_progress', 'completed', 'verified', 'cancelled')),
    CONSTRAINT ck_safety_actions_responsible
        CHECK (
            (responsible_organisation_id IS NULL AND responsible_member_id IS NULL)
            OR responsible_organisation_id IS NOT NULL
        ),
    CONSTRAINT ck_safety_actions_completed
        CHECK (
            (completed_at IS NULL AND completed_by_member_id IS NULL)
            OR (completed_at IS NOT NULL AND completed_by_member_id IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE safety_event_information_links (
    safety_event_id BIGINT UNSIGNED NOT NULL,
    event_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_version_id BIGINT UNSIGNED NOT NULL,
    version_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'evidence',
    PRIMARY KEY (safety_event_id, information_container_version_id, link_role),
    CONSTRAINT fk_safety_event_info_event
        FOREIGN KEY (safety_event_id, event_owner_organisation_id)
        REFERENCES safety_events (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_safety_event_info_version
        FOREIGN KEY (information_container_version_id, version_owner_organisation_id)
        REFERENCES information_container_versions (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_safety_event_info_role
        CHECK (link_role IN ('evidence', 'photo', 'rams', 'drawing', 'statement', 'report', 'closeout', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Initial controlled reference values
-- -----------------------------------------------------------------------------

INSERT INTO quality_inspection_item_types (code, name) VALUES
    ('text', 'Text response'),
    ('boolean', 'Yes / No response'),
    ('decimal', 'Numeric response'),
    ('date', 'Date response'),
    ('single_option', 'Single controlled option'),
    ('acknowledgement', 'Acknowledgement / check');

INSERT INTO quality_finding_types (code, name) VALUES
    ('defect', 'Defect / snag'),
    ('nonconformance', 'Non-conformance'),
    ('observation', 'Observation'),
    ('improvement', 'Improvement opportunity');

INSERT INTO permit_types (code, name) VALUES
    ('hot_work', 'Hot work'),
    ('confined_space', 'Confined space'),
    ('electrical_isolation', 'Electrical isolation'),
    ('excavation', 'Excavation'),
    ('work_at_height', 'Work at height'),
    ('lifting', 'Lifting operation'),
    ('roof_access', 'Roof access'),
    ('other', 'Other controlled work');

INSERT INTO safety_briefing_types (code, name) VALUES
    ('toolbox_talk', 'Toolbox talk'),
    ('site_induction', 'Site induction'),
    ('rams_briefing', 'RAMS briefing'),
    ('task_briefing', 'Task briefing'),
    ('safety_stand_down', 'Safety stand-down'),
    ('other', 'Other safety briefing');

-- -----------------------------------------------------------------------------
-- Required application invariants not fully expressible as simple MySQL FKs
-- -----------------------------------------------------------------------------
-- 1. Site diary/delivery/visitor/inspection/defect/NCR/RAMS/briefing/permit/safety-event
--    project_site_id must belong to the same project; the FK enforces this using the
--    shared Package 007 (id, project_id) site candidate key.
-- 2. Cross-organisation project participation never implies record visibility. Effective
--    permission/project scope must be checked before every read/write.
-- 3. Approved/locked diaries are immutable through ordinary write APIs. Corrections/addenda
--    must be auditable rather than silent rewrites.
-- 4. A linked attendance record must represent the same worker as the diary worker entry
--    and must be temporally relevant to the diary date.
-- 5. Diary delivery/visitor links must relate records from the same project/site context.
-- 6. project_change_event links in delay records must belong to the same project.
-- 7. Published/retired inspection-template versions and their section/item/option definitions
--    are immutable through ordinary APIs.
-- 8. quality_inspection_responses response value columns must match the configured item type;
--    only the permitted value representation may be populated for the item.
-- 9. A quality inspection response/finding must belong to the same inspection/project context.
-- 10. Defect/NCR source findings must belong to the same project; NCR-defect links must not
--     cross unrelated projects even if individual FKs are valid.
-- 11. Responsible organisations/members for defects, NCRs, permits and safety actions must be
--     active/authorised project participants for the relevant action.
-- 12. RAMS approval events must reference a version belonging to the RAMS information container.
--     The relational FK uses the container identity; project/visibility checks remain mandatory.
-- 13. Current approved RAMS revision is derived from approval events plus document lifecycle.
-- 14. Briefing/permit/safety-event information links must remain within the same project and
--     reference revisions visible to the acting organisation.
-- 15. Each safety_events row must have exactly one subtype row matching event_kind:
--       incident    -> safety_incidents only
--       near_miss   -> safety_near_misses only
--       observation -> safety_observations only
-- 16. Injury/person fields may require stricter privacy policy than ordinary project records.
-- 17. Permit issue/suspend/expire/close lifecycle is a business state machine; clock time alone
--     does not overwrite status.
-- 18. Issued/approved/closed evidence cannot be physically deleted through ordinary business APIs.
-- 19. Material lifecycle transitions and evidence changes must emit audit/outbox events
--     transactionally where practicable.
