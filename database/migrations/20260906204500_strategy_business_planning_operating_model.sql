-- F01 Strategy & Enterprise Planning — Tranche B
-- Business plans, strategic initiatives, execution funding links and target operating-model design.
-- migrate:up transaction:false

CREATE TABLE strategy_business_plans (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_framework_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    plan_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    narrative TEXT NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    planned_revenue_amount DECIMAL(20,4) NOT NULL DEFAULT 0,
    planned_opex_amount DECIMAL(20,4) NOT NULL DEFAULT 0,
    planned_capex_amount DECIMAL(20,4) NOT NULL DEFAULT 0,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    supersedes_business_plan_id BIGINT UNSIGNED NULL,
    owner_member_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    approved_by_member_id BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_business_plan_public (organisation_id, public_id),
    UNIQUE KEY uq_strategy_business_plan_version (organisation_id, plan_code, version_number),
    KEY ix_strategy_business_plan_framework (strategy_framework_id, lifecycle_status, period_start),
    CONSTRAINT fk_strategy_business_plan_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_business_plan_framework
        FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id),
    CONSTRAINT fk_strategy_business_plan_supersedes
        FOREIGN KEY (supersedes_business_plan_id) REFERENCES strategy_business_plans(id),
    CONSTRAINT fk_strategy_business_plan_owner
        FOREIGN KEY (owner_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_business_plan_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_business_plan_approved_by
        FOREIGN KEY (approved_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_business_plan_version CHECK (version_number >= 1),
    CONSTRAINT chk_strategy_business_plan_period CHECK (period_end >= period_start),
    CONSTRAINT chk_strategy_business_plan_status CHECK (lifecycle_status IN ('draft', 'approved', 'superseded')),
    CONSTRAINT chk_strategy_business_plan_currency CHECK (currency_code REGEXP '^[A-Z]{3}$'),
    CONSTRAINT chk_strategy_business_plan_revenue CHECK (planned_revenue_amount >= 0),
    CONSTRAINT chk_strategy_business_plan_opex CHECK (planned_opex_amount >= 0),
    CONSTRAINT chk_strategy_business_plan_capex CHECK (planned_capex_amount >= 0)
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_initiatives (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_business_plan_id BIGINT UNSIGNED NOT NULL,
    strategy_objective_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    initiative_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    outcome_text TEXT NOT NULL,
    benefit_statement TEXT NULL,
    resource_assumptions TEXT NULL,
    risk_summary TEXT NULL,
    priority_rank INT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    owner_member_id BIGINT UNSIGNED NULL,
    sponsor_member_id BIGINT UNSIGNED NULL,
    planned_investment_amount DECIMAL(20,4) NOT NULL DEFAULT 0,
    planned_fte DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    project_budget_id BIGINT UNSIGNED NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'proposed',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_initiative_public (organisation_id, public_id),
    UNIQUE KEY uq_strategy_initiative_code (strategy_business_plan_id, initiative_code),
    KEY ix_strategy_initiative_objective (strategy_objective_id, lifecycle_status, priority_rank),
    KEY ix_strategy_initiative_project (project_id, project_budget_id),
    CONSTRAINT fk_strategy_initiative_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_initiative_plan
        FOREIGN KEY (strategy_business_plan_id) REFERENCES strategy_business_plans(id),
    CONSTRAINT fk_strategy_initiative_objective
        FOREIGN KEY (strategy_objective_id) REFERENCES strategy_objectives(id),
    CONSTRAINT fk_strategy_initiative_owner
        FOREIGN KEY (owner_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_initiative_sponsor
        FOREIGN KEY (sponsor_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_initiative_project
        FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_strategy_initiative_budget
        FOREIGN KEY (project_budget_id) REFERENCES project_budgets(id),
    CONSTRAINT fk_strategy_initiative_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_initiative_priority CHECK (priority_rank >= 1),
    CONSTRAINT chk_strategy_initiative_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_strategy_initiative_investment CHECK (planned_investment_amount >= 0),
    CONSTRAINT chk_strategy_initiative_fte CHECK (planned_fte >= 0),
    CONSTRAINT chk_strategy_initiative_currency CHECK (currency_code REGEXP '^[A-Z]{3}$'),
    CONSTRAINT chk_strategy_initiative_status CHECK (lifecycle_status IN ('proposed', 'approved', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT chk_strategy_initiative_budget_project CHECK (project_budget_id IS NULL OR project_id IS NOT NULL)
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_initiative_milestones (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_initiative_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    milestone_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    target_date DATE NOT NULL,
    actual_date DATE NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'planned',
    owner_member_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_initiative_milestone_public (organisation_id, public_id),
    UNIQUE KEY uq_strategy_initiative_milestone_code (strategy_initiative_id, milestone_code),
    KEY ix_strategy_initiative_milestone_date (strategy_initiative_id, target_date, lifecycle_status),
    CONSTRAINT fk_strategy_initiative_milestone_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_initiative_milestone_initiative
        FOREIGN KEY (strategy_initiative_id) REFERENCES strategy_initiatives(id),
    CONSTRAINT fk_strategy_initiative_milestone_owner
        FOREIGN KEY (owner_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_initiative_milestone_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_initiative_milestone_status CHECK (lifecycle_status IN ('planned', 'achieved', 'missed', 'cancelled')),
    CONSTRAINT chk_strategy_initiative_milestone_achieved CHECK (lifecycle_status <> 'achieved' OR actual_date IS NOT NULL)
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_initiative_dependencies (
    organisation_id BIGINT UNSIGNED NOT NULL,
    initiative_id BIGINT UNSIGNED NOT NULL,
    depends_on_initiative_id BIGINT UNSIGNED NOT NULL,
    dependency_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'finish_to_start',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (initiative_id, depends_on_initiative_id),
    KEY ix_strategy_initiative_dependency_org (organisation_id, dependency_type),
    CONSTRAINT fk_strategy_initiative_dependency_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_initiative_dependency_initiative
        FOREIGN KEY (initiative_id) REFERENCES strategy_initiatives(id),
    CONSTRAINT fk_strategy_initiative_dependency_depends_on
        FOREIGN KEY (depends_on_initiative_id) REFERENCES strategy_initiatives(id),
    CONSTRAINT fk_strategy_initiative_dependency_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_initiative_dependency_distinct CHECK (initiative_id <> depends_on_initiative_id),
    CONSTRAINT chk_strategy_initiative_dependency_type CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish', 'governance', 'resource', 'external'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_operating_model_components (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_business_plan_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    component_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    parent_component_id BIGINT UNSIGNED NULL,
    component_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    current_state_text TEXT NULL,
    target_state_text TEXT NOT NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'proposed',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_operating_model_component_public (organisation_id, public_id),
    UNIQUE KEY uq_strategy_operating_model_component_code (strategy_business_plan_id, component_code),
    KEY ix_strategy_operating_model_component_type (strategy_business_plan_id, component_type, lifecycle_status),
    CONSTRAINT fk_strategy_operating_model_component_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_operating_model_component_plan
        FOREIGN KEY (strategy_business_plan_id) REFERENCES strategy_business_plans(id),
    CONSTRAINT fk_strategy_operating_model_component_parent
        FOREIGN KEY (parent_component_id) REFERENCES strategy_operating_model_components(id),
    CONSTRAINT fk_strategy_operating_model_component_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_operating_model_component_type CHECK (component_type IN ('business_capability', 'value_stream', 'organisation_design', 'process', 'governance', 'information', 'technology', 'partner_ecosystem', 'location')),
    CONSTRAINT chk_strategy_operating_model_component_status CHECK (lifecycle_status IN ('proposed', 'approved', 'retired'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_operating_model_accountabilities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    operating_model_component_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    accountability_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    position_label VARCHAR(255) NOT NULL,
    member_id BIGINT UNSIGNED NULL,
    notes TEXT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_operating_model_accountability_public (organisation_id, public_id),
    UNIQUE KEY uq_strategy_operating_model_accountability_role (operating_model_component_id, accountability_type, position_label),
    KEY ix_strategy_operating_model_accountability_member (organisation_id, member_id, accountability_type),
    CONSTRAINT fk_strategy_operating_model_accountability_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_operating_model_accountability_component
        FOREIGN KEY (operating_model_component_id) REFERENCES strategy_operating_model_components(id),
    CONSTRAINT fk_strategy_operating_model_accountability_member
        FOREIGN KEY (member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_operating_model_accountability_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_operating_model_accountability_type CHECK (accountability_type IN ('accountable', 'responsible', 'consulted', 'informed', 'assured'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_initiative_operating_model_links (
    organisation_id BIGINT UNSIGNED NOT NULL,
    initiative_id BIGINT UNSIGNED NOT NULL,
    operating_model_component_id BIGINT UNSIGNED NOT NULL,
    change_role VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (initiative_id, operating_model_component_id),
    KEY ix_strategy_initiative_operating_model_org (organisation_id, change_role),
    CONSTRAINT fk_strategy_initiative_operating_model_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_initiative_operating_model_initiative
        FOREIGN KEY (initiative_id) REFERENCES strategy_initiatives(id),
    CONSTRAINT fk_strategy_initiative_operating_model_component
        FOREIGN KEY (operating_model_component_id) REFERENCES strategy_operating_model_components(id),
    CONSTRAINT fk_strategy_initiative_operating_model_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_initiative_operating_model_role CHECK (change_role IN ('create', 'transform', 'enable', 'consume', 'retire'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

-- migrate:down transaction:false
-- Approved business plans and operating-model versions are attributable enterprise evidence.
-- Released records are forward-only; non-production environments are rebuilt.
SELECT 1;
