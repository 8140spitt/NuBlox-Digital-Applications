-- F01 Strategy & Enterprise Planning — V2 execution and review traceability
-- Connects strategic objectives to business plans, quantified resource needs,
-- downstream domain handoffs, KPI contribution and structured review decisions.
-- migrate:up transaction:false

CREATE TABLE strategy_business_plan_objective_links (
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_business_plan_id BIGINT UNSIGNED NOT NULL,
    strategy_objective_id BIGINT UNSIGNED NOT NULL,
    contribution_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'primary',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (strategy_business_plan_id, strategy_objective_id),
    KEY ix_strategy_plan_objective_org (organisation_id, contribution_type),
    KEY ix_strategy_plan_objective_objective (strategy_objective_id, contribution_type),
    CONSTRAINT fk_strategy_plan_objective_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_plan_objective_plan
        FOREIGN KEY (strategy_business_plan_id) REFERENCES strategy_business_plans(id),
    CONSTRAINT fk_strategy_plan_objective_objective
        FOREIGN KEY (strategy_objective_id) REFERENCES strategy_objectives(id),
    CONSTRAINT fk_strategy_plan_objective_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_plan_objective_contribution
        CHECK (contribution_type IN ('primary', 'supporting'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_initiative_resource_requirements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_initiative_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    requirement_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(20,4) NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
    quantity DECIMAL(20,4) NULL,
    unit_label VARCHAR(64) NULL,
    target_function_code VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    need_by DATE NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'identified',
    canonical_record_type VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
    canonical_public_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_resource_requirement_public (organisation_id, public_id),
    KEY ix_strategy_resource_requirement_initiative (strategy_initiative_id, lifecycle_status, need_by),
    KEY ix_strategy_resource_requirement_target (organisation_id, target_function_code, lifecycle_status),
    CONSTRAINT fk_strategy_resource_requirement_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_resource_requirement_initiative
        FOREIGN KEY (strategy_initiative_id) REFERENCES strategy_initiatives(id),
    CONSTRAINT fk_strategy_resource_requirement_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_resource_requirement_type
        CHECK (requirement_type IN ('funding', 'workforce', 'capacity', 'technology', 'asset', 'supplier', 'other')),
    CONSTRAINT chk_strategy_resource_requirement_status
        CHECK (lifecycle_status IN ('identified', 'requested', 'committed', 'satisfied', 'cancelled')),
    CONSTRAINT chk_strategy_resource_requirement_amount
        CHECK (amount IS NULL OR amount >= 0),
    CONSTRAINT chk_strategy_resource_requirement_quantity
        CHECK (quantity IS NULL OR quantity >= 0),
    CONSTRAINT chk_strategy_resource_requirement_currency
        CHECK (currency_code IS NULL OR currency_code REGEXP '^[A-Z]{3}$'),
    CONSTRAINT chk_strategy_resource_requirement_function
        CHECK (target_function_code REGEXP '^F[0-9]{2}$'),
    CONSTRAINT chk_strategy_resource_requirement_quantified
        CHECK (amount IS NOT NULL OR quantity IS NOT NULL),
    CONSTRAINT chk_strategy_resource_requirement_amount_currency
        CHECK (amount IS NULL OR currency_code IS NOT NULL),
    CONSTRAINT chk_strategy_resource_requirement_quantity_unit
        CHECK (quantity IS NULL OR unit_label IS NOT NULL),
    CONSTRAINT chk_strategy_resource_requirement_canonical_pair
        CHECK ((canonical_record_type IS NULL AND canonical_public_id IS NULL)
            OR (canonical_record_type IS NOT NULL AND canonical_public_id IS NOT NULL))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_initiative_handoffs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_initiative_id BIGINT UNSIGNED NOT NULL,
    strategy_resource_requirement_id BIGINT UNSIGNED NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    handoff_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    target_function_code VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_summary TEXT NOT NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'requested',
    target_record_type VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
    target_public_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
    response_note TEXT NULL,
    requested_by_member_id BIGINT UNSIGNED NOT NULL,
    requested_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    responded_by_member_id BIGINT UNSIGNED NULL,
    responded_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_initiative_handoff_public (organisation_id, public_id),
    KEY ix_strategy_initiative_handoff_initiative (strategy_initiative_id, lifecycle_status, requested_at),
    KEY ix_strategy_initiative_handoff_target (organisation_id, target_function_code, lifecycle_status),
    CONSTRAINT fk_strategy_initiative_handoff_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_initiative_handoff_initiative
        FOREIGN KEY (strategy_initiative_id) REFERENCES strategy_initiatives(id),
    CONSTRAINT fk_strategy_initiative_handoff_requirement
        FOREIGN KEY (strategy_resource_requirement_id) REFERENCES strategy_initiative_resource_requirements(id),
    CONSTRAINT fk_strategy_initiative_handoff_requested_by
        FOREIGN KEY (requested_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_initiative_handoff_responded_by
        FOREIGN KEY (responded_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_initiative_handoff_type
        CHECK (handoff_type IN ('funding', 'workforce', 'delivery', 'change', 'risk', 'procurement', 'technology', 'other')),
    CONSTRAINT chk_strategy_initiative_handoff_status
        CHECK (lifecycle_status IN ('requested', 'accepted', 'rejected', 'fulfilled', 'cancelled')),
    CONSTRAINT chk_strategy_initiative_handoff_function
        CHECK (target_function_code REGEXP '^F[0-9]{2}$'),
    CONSTRAINT chk_strategy_initiative_handoff_target_pair
        CHECK ((target_record_type IS NULL AND target_public_id IS NULL)
            OR (target_record_type IS NOT NULL AND target_public_id IS NOT NULL)),
    CONSTRAINT chk_strategy_initiative_handoff_response
        CHECK (lifecycle_status = 'requested'
            OR (responded_by_member_id IS NOT NULL AND responded_at IS NOT NULL)),
    CONSTRAINT chk_strategy_initiative_handoff_fulfilled
        CHECK (lifecycle_status <> 'fulfilled'
            OR (target_record_type IS NOT NULL AND target_public_id IS NOT NULL))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_initiative_kpi_links (
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_initiative_id BIGINT UNSIGNED NOT NULL,
    strategy_kpi_id BIGINT UNSIGNED NOT NULL,
    contribution_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'contributing',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (strategy_initiative_id, strategy_kpi_id),
    KEY ix_strategy_initiative_kpi_org (organisation_id, contribution_type),
    KEY ix_strategy_initiative_kpi_kpi (strategy_kpi_id, contribution_type),
    CONSTRAINT fk_strategy_initiative_kpi_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_initiative_kpi_initiative
        FOREIGN KEY (strategy_initiative_id) REFERENCES strategy_initiatives(id),
    CONSTRAINT fk_strategy_initiative_kpi_kpi
        FOREIGN KEY (strategy_kpi_id) REFERENCES strategy_kpis(id),
    CONSTRAINT fk_strategy_initiative_kpi_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_initiative_kpi_contribution
        CHECK (contribution_type IN ('primary', 'contributing', 'guardrail'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_review_decisions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_review_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    decision_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    decision_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    strategy_objective_id BIGINT UNSIGNED NULL,
    strategy_initiative_id BIGINT UNSIGNED NULL,
    strategy_kpi_id BIGINT UNSIGNED NULL,
    decision_text TEXT NOT NULL,
    rationale TEXT NOT NULL,
    owner_member_id BIGINT UNSIGNED NOT NULL,
    due_date DATE NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    completion_note TEXT NULL,
    completed_by_member_id BIGINT UNSIGNED NULL,
    completed_at DATETIME(6) NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_review_decision_public (organisation_id, public_id),
    UNIQUE KEY uq_strategy_review_decision_code (strategy_review_id, decision_code),
    KEY ix_strategy_review_decision_status (strategy_review_id, lifecycle_status, due_date),
    KEY ix_strategy_review_decision_objective (strategy_objective_id, lifecycle_status),
    KEY ix_strategy_review_decision_initiative (strategy_initiative_id, lifecycle_status),
    KEY ix_strategy_review_decision_kpi (strategy_kpi_id, lifecycle_status),
    CONSTRAINT fk_strategy_review_decision_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_review_decision_review
        FOREIGN KEY (strategy_review_id) REFERENCES strategy_reviews(id),
    CONSTRAINT fk_strategy_review_decision_objective
        FOREIGN KEY (strategy_objective_id) REFERENCES strategy_objectives(id),
    CONSTRAINT fk_strategy_review_decision_initiative
        FOREIGN KEY (strategy_initiative_id) REFERENCES strategy_initiatives(id),
    CONSTRAINT fk_strategy_review_decision_kpi
        FOREIGN KEY (strategy_kpi_id) REFERENCES strategy_kpis(id),
    CONSTRAINT fk_strategy_review_decision_owner
        FOREIGN KEY (owner_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_review_decision_completed_by
        FOREIGN KEY (completed_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_review_decision_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_review_decision_type
        CHECK (decision_type IN ('continue', 'accelerate', 'rephase', 'pause', 'stop', 'revise_strategy', 'revise_plan', 'corrective_action')),
    CONSTRAINT chk_strategy_review_decision_status
        CHECK (lifecycle_status IN ('open', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT chk_strategy_review_decision_completion
        CHECK (lifecycle_status <> 'completed'
            OR (completed_by_member_id IS NOT NULL AND completed_at IS NOT NULL AND completion_note IS NOT NULL))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

-- migrate:down transaction:false
-- F01 strategy execution and review records are forward-only enterprise evidence.
-- Non-production environments are rebuilt from the authoritative migration stream.
SELECT 1;
