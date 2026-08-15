-- NuBlox: Digital Applications
-- Schema package 006: Workforce, Time and Scheduling
-- Depends on: 001-platform-kernel.sql, 002-crm-parties.sql,
--             003-sales-quotes.sql, 004-contracts-finance.sql, 005-procurement.sql
-- Target: MySQL 8.4 / InnoDB
-- Design target: 3NF by default
-- Generated: 2026-08-15
--
-- PRINCIPLES:
-- 1. User account, CRM person and workforce record are separate concepts.
-- 2. Engagement, competency, credentials and rates are separate effective/historical facts.
-- 3. Planned schedule, actual attendance and claimed/approved time are not collapsed.
-- 4. Approved labour-cost snapshots are historical facts; current rates remain mutable reference data.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
-- Global controlled reference data
-- -----------------------------------------------------------------------------

CREATE TABLE workforce_engagement_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_workforce_engagement_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE worker_cost_rate_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_worker_cost_rate_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE schedule_event_types (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    UNIQUE KEY uq_schedule_event_types_code (code)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Workforce identity
-- -----------------------------------------------------------------------------

CREATE TABLE workers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    organisation_member_id BIGINT UNSIGNED NULL,
    person_party_id BIGINT UNSIGNED NULL,
    worker_number VARCHAR(80) NULL,
    display_name VARCHAR(255) NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_workers_public_id (public_id),
    UNIQUE KEY uq_workers_id_organisation (id, organisation_id),
    UNIQUE KEY uq_workers_member (organisation_id, organisation_member_id),
    UNIQUE KEY uq_workers_person_party (organisation_id, person_party_id),
    UNIQUE KEY uq_workers_number (organisation_id, worker_number),
    KEY idx_workers_status (organisation_id, status, id),

    CONSTRAINT fk_workers_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_workers_member
        FOREIGN KEY (organisation_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_workers_person_party
        FOREIGN KEY (person_party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_workers_identity
        CHECK (organisation_member_id IS NOT NULL OR person_party_id IS NOT NULL),
    CONSTRAINT ck_workers_status
        CHECK (status IN ('active', 'inactive', 'suspended', 'archived'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Engagements and organisation-specific career classification
-- -----------------------------------------------------------------------------

CREATE TABLE worker_engagements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    worker_id BIGINT UNSIGNED NOT NULL,
    workforce_engagement_type_id SMALLINT UNSIGNED NOT NULL,
    primary_team_id BIGINT UNSIGNED NULL,
    manager_worker_id BIGINT UNSIGNED NULL,
    engagement_reference VARCHAR(120) NULL,
    job_title VARCHAR(200) NULL,
    department VARCHAR(200) NULL,
    started_on DATE NOT NULL,
    ended_on DATE NULL,
    engagement_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_worker_engagements_id_organisation (id, organisation_id),
    UNIQUE KEY uq_worker_engagements_reference (organisation_id, engagement_reference),
    KEY idx_worker_engagements_worker (organisation_id, worker_id, engagement_status, started_on),
    KEY idx_worker_engagements_team (primary_team_id, organisation_id),
    KEY idx_worker_engagements_manager (manager_worker_id, organisation_id),

    CONSTRAINT fk_worker_engagements_worker
        FOREIGN KEY (worker_id, organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_worker_engagements_type
        FOREIGN KEY (workforce_engagement_type_id)
        REFERENCES workforce_engagement_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_worker_engagements_team
        FOREIGN KEY (primary_team_id, organisation_id)
        REFERENCES teams (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_worker_engagements_manager
        FOREIGN KEY (manager_worker_id, organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_worker_engagements_dates
        CHECK (ended_on IS NULL OR ended_on >= started_on),
    CONSTRAINT ck_worker_engagements_manager
        CHECK (manager_worker_id IS NULL OR manager_worker_id <> worker_id),
    CONSTRAINT ck_worker_engagements_status
        CHECK (engagement_status IN ('planned', 'active', 'ended', 'suspended', 'cancelled'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE worker_careers (
    organisation_id BIGINT UNSIGNED NOT NULL,
    worker_id BIGINT UNSIGNED NOT NULL,
    career_id BIGINT UNSIGNED NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    primary_worker_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE WHEN is_primary = TRUE THEN worker_id ELSE NULL END
        ) STORED,

    PRIMARY KEY (organisation_id, worker_id, career_id),
    UNIQUE KEY uq_worker_careers_one_primary (organisation_id, primary_worker_id),
    KEY idx_worker_careers_career (career_id, organisation_id, worker_id),

    CONSTRAINT fk_worker_careers_worker
        FOREIGN KEY (worker_id, organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT fk_worker_careers_career
        FOREIGN KEY (career_id)
        REFERENCES careers (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Competencies
-- -----------------------------------------------------------------------------

CREATE TABLE competency_types (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    requires_expiry BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_competency_types_public_id (public_id),
    UNIQUE KEY uq_competency_types_id_organisation (id, organisation_id),
    UNIQUE KEY uq_competency_types_code (organisation_id, code),

    CONSTRAINT fk_competency_types_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE worker_competencies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    worker_id BIGINT UNSIGNED NOT NULL,
    competency_type_id BIGINT UNSIGNED NOT NULL,
    proficiency_level VARCHAR(64) NULL,
    assessment_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'declared',
    assessed_on DATE NULL,
    assessed_by_member_id BIGINT UNSIGNED NULL,
    valid_from DATE NULL,
    valid_to DATE NULL,
    notes TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_worker_competencies_id_organisation (id, organisation_id),
    KEY idx_worker_competencies_worker (organisation_id, worker_id, competency_type_id, valid_to),
    KEY idx_worker_competencies_type (organisation_id, competency_type_id, assessment_status),
    KEY idx_worker_competencies_assessor (assessed_by_member_id, organisation_id),

    CONSTRAINT fk_worker_competencies_worker
        FOREIGN KEY (worker_id, organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_worker_competencies_type
        FOREIGN KEY (competency_type_id, organisation_id)
        REFERENCES competency_types (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_worker_competencies_assessor
        FOREIGN KEY (assessed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_worker_competencies_status
        CHECK (assessment_status IN ('declared', 'assessed', 'verified', 'suspended', 'revoked')),
    CONSTRAINT ck_worker_competencies_dates
        CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Credentials, qualifications, cards and licences
-- -----------------------------------------------------------------------------

CREATE TABLE credential_types (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(200) NOT NULL,
    credential_category VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    default_validity_months SMALLINT UNSIGNED NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_credential_types_public_id (public_id),
    UNIQUE KEY uq_credential_types_id_organisation (id, organisation_id),
    UNIQUE KEY uq_credential_types_code (organisation_id, code),

    CONSTRAINT fk_credential_types_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_credential_types_category
        CHECK (credential_category IN (
            'qualification', 'licence', 'registration', 'card',
            'certificate', 'membership', 'training', 'other'
        ))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE worker_credentials (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    worker_id BIGINT UNSIGNED NOT NULL,
    credential_type_id BIGINT UNSIGNED NOT NULL,
    credential_number VARCHAR(160) NULL,
    issuing_body VARCHAR(255) NULL,
    issued_on DATE NULL,
    valid_from DATE NULL,
    valid_to DATE NULL,
    verification_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'unverified',
    verified_at DATETIME(6) NULL,
    verified_by_member_id BIGINT UNSIGNED NULL,
    notes TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_worker_credentials_public_id (public_id),
    UNIQUE KEY uq_worker_credentials_id_organisation (id, organisation_id),
    UNIQUE KEY uq_worker_credentials_number (
        organisation_id,
        worker_id,
        credential_type_id,
        credential_number
    ),
    KEY idx_worker_credentials_expiry (organisation_id, valid_to, verification_status),
    KEY idx_worker_credentials_worker (organisation_id, worker_id, credential_type_id),
    KEY idx_worker_credentials_verifier (verified_by_member_id, organisation_id),

    CONSTRAINT fk_worker_credentials_worker
        FOREIGN KEY (worker_id, organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_worker_credentials_type
        FOREIGN KEY (credential_type_id, organisation_id)
        REFERENCES credential_types (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_worker_credentials_verifier
        FOREIGN KEY (verified_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_worker_credentials_dates
        CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
    CONSTRAINT ck_worker_credentials_verification
        CHECK (verification_status IN ('unverified', 'verified', 'rejected', 'revoked')),
    CONSTRAINT ck_worker_credentials_verified_at
        CHECK (
            (verification_status = 'verified' AND verified_at IS NOT NULL AND verified_by_member_id IS NOT NULL)
            OR verification_status <> 'verified'
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Effective-dated worker cost rates
-- -----------------------------------------------------------------------------

CREATE TABLE worker_cost_rates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    worker_id BIGINT UNSIGNED NOT NULL,
    worker_cost_rate_type_id SMALLINT UNSIGNED NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    rate_basis VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'hour',
    amount DECIMAL(19,4) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_worker_cost_rates_id_organisation (id, organisation_id),
    UNIQUE KEY uq_worker_cost_rates_start (
        organisation_id,
        worker_id,
        worker_cost_rate_type_id,
        currency_code,
        rate_basis,
        valid_from
    ),
    KEY idx_worker_cost_rates_effective (
        organisation_id,
        worker_id,
        worker_cost_rate_type_id,
        valid_from,
        valid_to
    ),

    CONSTRAINT fk_worker_cost_rates_worker
        FOREIGN KEY (worker_id, organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_worker_cost_rates_type
        FOREIGN KEY (worker_cost_rate_type_id)
        REFERENCES worker_cost_rate_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_worker_cost_rates_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_worker_cost_rates_basis
        CHECK (rate_basis IN ('hour', 'day')),
    CONSTRAINT ck_worker_cost_rates_amount
        CHECK (amount >= 0),
    CONSTRAINT ck_worker_cost_rates_dates
        CHECK (valid_to IS NULL OR valid_to >= valid_from)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Reusable work calendars and weekly patterns
-- -----------------------------------------------------------------------------

CREATE TABLE work_calendars (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'Europe/London',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_work_calendars_public_id (public_id),
    UNIQUE KEY uq_work_calendars_id_organisation (id, organisation_id),
    UNIQUE KEY uq_work_calendars_name (organisation_id, name),

    CONSTRAINT fk_work_calendars_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE work_calendar_weekdays (
    organisation_id BIGINT UNSIGNED NOT NULL,
    work_calendar_id BIGINT UNSIGNED NOT NULL,
    iso_weekday TINYINT UNSIGNED NOT NULL,
    local_start_time TIME NOT NULL,
    local_end_time TIME NOT NULL,
    unpaid_break_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,

    PRIMARY KEY (organisation_id, work_calendar_id, iso_weekday),

    CONSTRAINT fk_work_calendar_weekdays_calendar
        FOREIGN KEY (work_calendar_id, organisation_id)
        REFERENCES work_calendars (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT ck_work_calendar_weekdays_day
        CHECK (iso_weekday BETWEEN 1 AND 7),
    CONSTRAINT ck_work_calendar_weekdays_times
        CHECK (local_end_time > local_start_time)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE worker_calendar_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    worker_id BIGINT UNSIGNED NOT NULL,
    work_calendar_id BIGINT UNSIGNED NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_worker_calendar_assignments_id_organisation (id, organisation_id),
    UNIQUE KEY uq_worker_calendar_assignments_start (
        organisation_id,
        worker_id,
        valid_from
    ),
    KEY idx_worker_calendar_assignments_effective (
        organisation_id,
        worker_id,
        valid_from,
        valid_to
    ),

    CONSTRAINT fk_worker_calendar_assignments_worker
        FOREIGN KEY (worker_id, organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_worker_calendar_assignments_calendar
        FOREIGN KEY (work_calendar_id, organisation_id)
        REFERENCES work_calendars (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_worker_calendar_assignments_dates
        CHECK (valid_to IS NULL OR valid_to >= valid_from)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE worker_unavailability (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    worker_id BIGINT UNSIGNED NOT NULL,
    unavailability_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    starts_at DATETIME(6) NOT NULL,
    ends_at DATETIME(6) NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'approved',
    notes VARCHAR(1000) NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_worker_unavailability_public_id (public_id),
    UNIQUE KEY uq_worker_unavailability_id_organisation (id, organisation_id),
    KEY idx_worker_unavailability_worker_time (organisation_id, worker_id, starts_at, ends_at),

    CONSTRAINT fk_worker_unavailability_worker
        FOREIGN KEY (worker_id, organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_worker_unavailability_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_worker_unavailability_type
        CHECK (unavailability_type IN (
            'annual_leave', 'sickness', 'training', 'unavailable',
            'non_working_override', 'other'
        )),
    CONSTRAINT ck_worker_unavailability_status
        CHECK (status IN ('requested', 'approved', 'declined', 'cancelled')),
    CONSTRAINT ck_worker_unavailability_times
        CHECK (ends_at > starts_at)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Project resource assignments
-- -----------------------------------------------------------------------------

CREATE TABLE project_resource_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    worker_id BIGINT UNSIGNED NOT NULL,
    project_role_type_id BIGINT UNSIGNED NULL,
    assigned_by_member_id BIGINT UNSIGNED NOT NULL,
    starts_on DATE NULL,
    ends_on DATE NULL,
    planned_allocation_percent DECIMAL(5,2) NULL,
    assignment_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'planned',
    notes VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_resource_assignments_public_id (public_id),
    UNIQUE KEY uq_project_resource_assignments_id_organisation (id, organisation_id),
    KEY idx_project_resource_assignments_project (
        organisation_id,
        project_id,
        assignment_status,
        worker_id
    ),
    KEY idx_project_resource_assignments_worker (
        organisation_id,
        worker_id,
        starts_on,
        ends_on
    ),

    CONSTRAINT fk_project_resource_assignments_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_project_resource_assignments_worker
        FOREIGN KEY (worker_id, organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_project_resource_assignments_role
        FOREIGN KEY (project_role_type_id)
        REFERENCES project_role_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_project_resource_assignments_assigner
        FOREIGN KEY (assigned_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_project_resource_assignments_dates
        CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
    CONSTRAINT ck_project_resource_assignments_allocation
        CHECK (
            planned_allocation_percent IS NULL
            OR (planned_allocation_percent >= 0.00 AND planned_allocation_percent <= 100.00)
        ),
    CONSTRAINT ck_project_resource_assignments_status
        CHECK (assignment_status IN ('planned', 'active', 'completed', 'cancelled'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Scheduling
-- -----------------------------------------------------------------------------

CREATE TABLE schedule_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    schedule_event_type_id SMALLINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    address_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    starts_at DATETIME(6) NOT NULL,
    ends_at DATETIME(6) NOT NULL,
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'Europe/London',
    event_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'planned',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_schedule_events_public_id (public_id),
    UNIQUE KEY uq_schedule_events_id_organisation (id, organisation_id),
    KEY idx_schedule_events_time (organisation_id, starts_at, ends_at, event_status),
    KEY idx_schedule_events_project (project_id, organisation_id, starts_at),
    KEY idx_schedule_events_address (address_id, organisation_id),

    CONSTRAINT fk_schedule_events_type
        FOREIGN KEY (schedule_event_type_id)
        REFERENCES schedule_event_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_schedule_events_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_schedule_events_address
        FOREIGN KEY (address_id, organisation_id)
        REFERENCES addresses (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_schedule_events_creator
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_schedule_events_times
        CHECK (ends_at > starts_at),
    CONSTRAINT ck_schedule_events_status
        CHECK (event_status IN ('planned', 'confirmed', 'in_progress', 'completed', 'cancelled'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE schedule_event_workers (
    organisation_id BIGINT UNSIGNED NOT NULL,
    schedule_event_id BIGINT UNSIGNED NOT NULL,
    worker_id BIGINT UNSIGNED NOT NULL,
    project_resource_assignment_id BIGINT UNSIGNED NULL,
    assigned_by_member_id BIGINT UNSIGNED NOT NULL,
    assignment_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'assigned',
    responded_at DATETIME(6) NULL,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (organisation_id, schedule_event_id, worker_id),
    KEY idx_schedule_event_workers_worker (
        organisation_id,
        worker_id,
        assignment_status,
        schedule_event_id
    ),
    KEY idx_schedule_event_workers_resource (
        project_resource_assignment_id,
        organisation_id
    ),

    CONSTRAINT fk_schedule_event_workers_event
        FOREIGN KEY (schedule_event_id, organisation_id)
        REFERENCES schedule_events (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT fk_schedule_event_workers_worker
        FOREIGN KEY (worker_id, organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_schedule_event_workers_resource
        FOREIGN KEY (project_resource_assignment_id, organisation_id)
        REFERENCES project_resource_assignments (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_schedule_event_workers_assigner
        FOREIGN KEY (assigned_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_schedule_event_workers_status
        CHECK (assignment_status IN ('assigned', 'accepted', 'declined', 'completed', 'cancelled'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Attendance / actual time evidence
-- -----------------------------------------------------------------------------

CREATE TABLE attendance_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    worker_id BIGINT UNSIGNED NOT NULL,
    schedule_event_id BIGINT UNSIGNED NULL,
    actual_start_at DATETIME(6) NOT NULL,
    actual_end_at DATETIME(6) NULL,
    attendance_source VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'manual',
    attendance_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    recorded_by_member_id BIGINT UNSIGNED NULL,
    notes VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_attendance_records_public_id (public_id),
    UNIQUE KEY uq_attendance_records_id_organisation (id, organisation_id),
    KEY idx_attendance_records_worker (
        organisation_id,
        worker_id,
        actual_start_at,
        attendance_status
    ),
    KEY idx_attendance_records_schedule (schedule_event_id, organisation_id),

    CONSTRAINT fk_attendance_records_worker
        FOREIGN KEY (worker_id, organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_attendance_records_schedule
        FOREIGN KEY (schedule_event_id, organisation_id)
        REFERENCES schedule_events (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_attendance_records_recorder
        FOREIGN KEY (recorded_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_attendance_records_times
        CHECK (actual_end_at IS NULL OR actual_end_at >= actual_start_at),
    CONSTRAINT ck_attendance_records_source
        CHECK (attendance_source IN ('manual', 'clock', 'mobile', 'import', 'api', 'other')),
    CONSTRAINT ck_attendance_records_status
        CHECK (attendance_status IN ('open', 'completed', 'corrected', 'cancelled'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Tenant-defined time/activity classification
-- -----------------------------------------------------------------------------

CREATE TABLE time_activity_types (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    default_billable BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_time_activity_types_public_id (public_id),
    UNIQUE KEY uq_time_activity_types_id_organisation (id, organisation_id),
    UNIQUE KEY uq_time_activity_types_code (organisation_id, code),

    CONSTRAINT fk_time_activity_types_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Timesheets and approval lifecycle
-- -----------------------------------------------------------------------------

CREATE TABLE timesheets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    worker_id BIGINT UNSIGNED NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    timesheet_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    submitted_at DATETIME(6) NULL,
    submitted_by_member_id BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    approved_by_member_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_timesheets_public_id (public_id),
    UNIQUE KEY uq_timesheets_id_organisation (id, organisation_id),
    UNIQUE KEY uq_timesheets_worker_period (
        organisation_id,
        worker_id,
        period_start,
        period_end
    ),
    KEY idx_timesheets_status (organisation_id, timesheet_status, period_end),
    KEY idx_timesheets_submitter (submitted_by_member_id, organisation_id),
    KEY idx_timesheets_approver (approved_by_member_id, organisation_id),

    CONSTRAINT fk_timesheets_worker
        FOREIGN KEY (worker_id, organisation_id)
        REFERENCES workers (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_timesheets_submitter
        FOREIGN KEY (submitted_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_timesheets_approver
        FOREIGN KEY (approved_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_timesheets_period
        CHECK (period_end >= period_start),
    CONSTRAINT ck_timesheets_status
        CHECK (timesheet_status IN ('draft', 'submitted', 'approved', 'rejected', 'reopened', 'cancelled')),
    CONSTRAINT ck_timesheets_submission
        CHECK (
            (timesheet_status = 'draft' AND submitted_at IS NULL)
            OR timesheet_status IN ('submitted', 'approved', 'rejected', 'reopened', 'cancelled')
        ),
    CONSTRAINT ck_timesheets_approval
        CHECK (
            (timesheet_status = 'approved' AND approved_at IS NOT NULL AND approved_by_member_id IS NOT NULL)
            OR timesheet_status <> 'approved'
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE timesheet_entries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    timesheet_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    schedule_event_id BIGINT UNSIGNED NULL,
    attendance_record_id BIGINT UNSIGNED NULL,
    time_activity_type_id BIGINT UNSIGNED NULL,
    work_date DATE NOT NULL,
    started_at DATETIME(6) NULL,
    ended_at DATETIME(6) NULL,
    worked_minutes INT UNSIGNED NOT NULL,
    is_billable BOOLEAN NOT NULL DEFAULT TRUE,
    description VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_timesheet_entries_id_organisation (id, organisation_id),
    KEY idx_timesheet_entries_timesheet (organisation_id, timesheet_id, work_date, id),
    KEY idx_timesheet_entries_project (project_id, organisation_id, work_date),
    KEY idx_timesheet_entries_schedule (schedule_event_id, organisation_id),
    KEY idx_timesheet_entries_attendance (attendance_record_id, organisation_id),
    KEY idx_timesheet_entries_activity (time_activity_type_id, organisation_id),

    CONSTRAINT fk_timesheet_entries_timesheet
        FOREIGN KEY (timesheet_id, organisation_id)
        REFERENCES timesheets (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_timesheet_entries_project
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_timesheet_entries_schedule
        FOREIGN KEY (schedule_event_id, organisation_id)
        REFERENCES schedule_events (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_timesheet_entries_attendance
        FOREIGN KEY (attendance_record_id, organisation_id)
        REFERENCES attendance_records (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_timesheet_entries_activity
        FOREIGN KEY (time_activity_type_id, organisation_id)
        REFERENCES time_activity_types (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_timesheet_entries_minutes
        CHECK (worked_minutes > 0),
    CONSTRAINT ck_timesheet_entries_times
        CHECK (
            (started_at IS NULL AND ended_at IS NULL)
            OR (started_at IS NOT NULL AND ended_at IS NOT NULL AND ended_at >= started_at)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE timesheet_status_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    timesheet_id BIGINT UNSIGNED NOT NULL,
    from_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    to_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    acted_by_member_id BIGINT UNSIGNED NOT NULL,
    acted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    comment VARCHAR(1000) NULL,

    PRIMARY KEY (id),
    KEY idx_timesheet_status_events_timesheet (
        organisation_id,
        timesheet_id,
        acted_at,
        id
    ),

    CONSTRAINT fk_timesheet_status_events_timesheet
        FOREIGN KEY (timesheet_id, organisation_id)
        REFERENCES timesheets (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_timesheet_status_events_actor
        FOREIGN KEY (acted_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_timesheet_status_events_from
        CHECK (
            from_status IS NULL
            OR from_status IN ('draft', 'submitted', 'approved', 'rejected', 'reopened', 'cancelled')
        ),
    CONSTRAINT ck_timesheet_status_events_to
        CHECK (to_status IN ('draft', 'submitted', 'approved', 'rejected', 'reopened', 'cancelled'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Approved labour-cost snapshots
-- -----------------------------------------------------------------------------

CREATE TABLE timesheet_entry_cost_snapshots (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    timesheet_entry_id BIGINT UNSIGNED NOT NULL,
    source_worker_cost_rate_id BIGINT UNSIGNED NULL,
    worker_cost_rate_type_id SMALLINT UNSIGNED NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    rate_basis VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    rate_amount DECIMAL(19,4) NOT NULL,
    costed_minutes INT UNSIGNED NOT NULL,
    cost_amount DECIMAL(19,4) NOT NULL,
    snapshotted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_timesheet_entry_cost_snapshots_order (
        organisation_id,
        timesheet_entry_id,
        sort_order
    ),
    KEY idx_timesheet_entry_cost_snapshots_source (
        source_worker_cost_rate_id,
        organisation_id
    ),

    CONSTRAINT fk_timesheet_entry_cost_snapshots_entry
        FOREIGN KEY (timesheet_entry_id, organisation_id)
        REFERENCES timesheet_entries (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_timesheet_entry_cost_snapshots_source
        FOREIGN KEY (source_worker_cost_rate_id, organisation_id)
        REFERENCES worker_cost_rates (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_timesheet_entry_cost_snapshots_type
        FOREIGN KEY (worker_cost_rate_type_id)
        REFERENCES worker_cost_rate_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT ck_timesheet_entry_cost_snapshots_basis
        CHECK (rate_basis IN ('hour', 'day')),
    CONSTRAINT ck_timesheet_entry_cost_snapshots_rate
        CHECK (rate_amount >= 0),
    CONSTRAINT ck_timesheet_entry_cost_snapshots_minutes
        CHECK (costed_minutes > 0),
    CONSTRAINT ck_timesheet_entry_cost_snapshots_cost
        CHECK (cost_amount >= 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Initial controlled global reference values
-- -----------------------------------------------------------------------------

INSERT INTO workforce_engagement_types (code, name) VALUES
    ('employee', 'Employee'),
    ('director', 'Director'),
    ('apprentice', 'Apprentice'),
    ('subcontract_worker', 'Subcontract worker'),
    ('agency_worker', 'Agency worker'),
    ('consultant', 'Consultant'),
    ('temporary_worker', 'Temporary worker'),
    ('other', 'Other');

INSERT INTO worker_cost_rate_types (code, name) VALUES
    ('standard', 'Standard cost'),
    ('overtime', 'Overtime cost'),
    ('weekend', 'Weekend cost'),
    ('night', 'Night cost'),
    ('other', 'Other cost');

INSERT INTO schedule_event_types (code, name) VALUES
    ('appointment', 'Appointment'),
    ('site_visit', 'Site visit'),
    ('shift', 'Shift'),
    ('inspection', 'Inspection'),
    ('survey', 'Survey'),
    ('maintenance_visit', 'Maintenance visit'),
    ('meeting', 'Meeting'),
    ('work_session', 'Work session'),
    ('training', 'Training'),
    ('other', 'Other');

-- -----------------------------------------------------------------------------
-- Required application invariants not completely expressible as simple FKs
-- -----------------------------------------------------------------------------
--
-- 1. workers.person_party_id must reference a party_persons subtype, not an organisation party.
-- 2. A tenant must not create duplicate active worker identities for the same human through
--    conflicting member/person links.
-- 3. Engagement overlap rules must be defined and enforced according to organisation policy.
-- 4. worker_cost_rates for one worker/rate-type/currency/basis must not have overlapping
--    effective periods.
-- 5. worker_calendar_assignments must not create ambiguous overlapping active calendars
--    unless future design explicitly allows multiple concurrent calendars.
-- 6. project_resource_assignments project and worker must belong to the same owning tenant.
-- 7. A schedule_event_workers.project_resource_assignment_id, when present, must refer to
--    the same worker and to the event's project where the event is project-linked.
-- 8. Overlap/conflict detection for scheduling is a domain service concern; not every
--    overlapping event is invalid because some businesses intentionally double-book or
--    create informational events.
-- 9. attendance_records.schedule_event_id, when present, must be assigned to that worker
--    unless an authorised correction/exception workflow applies.
-- 10. timesheet_entries.work_date must fall within its parent timesheet period.
-- 11. timesheet entry project/schedule/attendance references must relate to the same worker
--     as the parent timesheet where those records are worker-specific.
-- 12. When started_at/ended_at are supplied, worked_minutes must be validated against the
--     organisation's rounding/break policy rather than blindly derived or overwritten.
-- 13. Submitted and approved timesheets are immutable through ordinary entry-edit APIs.
-- 14. Every lifecycle transition must append a timesheet_status_events row and audit event.
-- 15. Approval must transactionally create required timesheet_entry_cost_snapshots using
--     the effective worker cost rate(s) for the approved work.
-- 16. Approved cost snapshots never silently recalculate after worker_cost_rates change.
-- 17. Credential/competency current-validity and expiry states are derived from status and
--     dates; do not persist a second editable is_expired/is_valid balance.
-- 18. Workforce cost-rate visibility requires a dedicated privileged permission and must
--     not be implied merely by project membership.
