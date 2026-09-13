-- F01.02/F01.03 Strategy & Enterprise Planning V2
-- Structured evidence, assumptions, implications, strategic-choice drivers, themes and objective lineage.
-- migrate:up transaction:false

ALTER TABLE strategy_environment_factors
    ADD COLUMN implication_text TEXT NULL AFTER analysis_text,
    ADD COLUMN confidence_score TINYINT UNSIGNED NULL AFTER impact_score,
    ADD CONSTRAINT chk_strategy_environment_confidence
        CHECK (confidence_score IS NULL OR confidence_score BETWEEN 1 AND 5);

ALTER TABLE strategy_objectives
    ADD COLUMN parent_strategy_objective_id BIGINT UNSIGNED NULL AFTER priority_rank,
    ADD KEY ix_strategy_objective_parent (parent_strategy_objective_id),
    ADD CONSTRAINT fk_strategy_objective_parent
        FOREIGN KEY (parent_strategy_objective_id) REFERENCES strategy_objectives(id);

CREATE TABLE strategy_evidence_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_framework_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    evidence_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    source_reference VARCHAR(512) NULL,
    source_uri VARCHAR(2048) NULL,
    publisher_name VARCHAR(255) NULL,
    published_on DATE NULL,
    observed_on DATE NULL,
    summary_text TEXT NOT NULL,
    reliability_score TINYINT UNSIGNED NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    owner_member_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_evidence_public (organisation_id, public_id),
    KEY ix_strategy_evidence_framework (strategy_framework_id, evidence_type, lifecycle_status),
    CONSTRAINT fk_strategy_evidence_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_evidence_framework
        FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id),
    CONSTRAINT fk_strategy_evidence_owner
        FOREIGN KEY (owner_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_evidence_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_evidence_type CHECK (
        evidence_type IN ('internal_data', 'external_report', 'market_intelligence', 'regulatory', 'expert_judgement', 'stakeholder', 'other')
    ),
    CONSTRAINT chk_strategy_evidence_reliability CHECK (
        reliability_score IS NULL OR reliability_score BETWEEN 1 AND 5
    ),
    CONSTRAINT chk_strategy_evidence_status CHECK (lifecycle_status IN ('active', 'retired'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_environment_factor_evidence_links (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_environment_factor_id BIGINT UNSIGNED NOT NULL,
    strategy_evidence_item_id BIGINT UNSIGNED NOT NULL,
    relationship_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    note_text TEXT NULL,
    linked_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_factor_evidence_link (
        strategy_environment_factor_id,
        strategy_evidence_item_id,
        relationship_type
    ),
    KEY ix_strategy_factor_evidence_evidence (strategy_evidence_item_id),
    CONSTRAINT fk_strategy_factor_evidence_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_factor_evidence_factor
        FOREIGN KEY (strategy_environment_factor_id) REFERENCES strategy_environment_factors(id),
    CONSTRAINT fk_strategy_factor_evidence_evidence
        FOREIGN KEY (strategy_evidence_item_id) REFERENCES strategy_evidence_items(id),
    CONSTRAINT fk_strategy_factor_evidence_linked_by
        FOREIGN KEY (linked_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_factor_evidence_relationship CHECK (
        relationship_type IN ('supports', 'contradicts', 'contextual')
    )
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_assumptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_framework_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    statement_text TEXT NOT NULL,
    rationale_text TEXT NULL,
    confidence_score TINYINT UNSIGNED NULL,
    review_by DATE NULL,
    validation_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'unvalidated',
    owner_member_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_assumption_public (organisation_id, public_id),
    KEY ix_strategy_assumption_framework (strategy_framework_id, validation_status, review_by),
    CONSTRAINT fk_strategy_assumption_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_assumption_framework
        FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id),
    CONSTRAINT fk_strategy_assumption_owner
        FOREIGN KEY (owner_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_assumption_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_assumption_confidence CHECK (
        confidence_score IS NULL OR confidence_score BETWEEN 1 AND 5
    ),
    CONSTRAINT chk_strategy_assumption_status CHECK (
        validation_status IN ('unvalidated', 'validated', 'challenged', 'invalidated', 'retired')
    )
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_option_factor_links (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_option_id BIGINT UNSIGNED NOT NULL,
    strategy_environment_factor_id BIGINT UNSIGNED NOT NULL,
    relationship_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    linked_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_option_factor_link (
        strategy_option_id,
        strategy_environment_factor_id,
        relationship_type
    ),
    KEY ix_strategy_option_factor_factor (strategy_environment_factor_id),
    CONSTRAINT fk_strategy_option_factor_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_option_factor_option
        FOREIGN KEY (strategy_option_id) REFERENCES strategy_options(id),
    CONSTRAINT fk_strategy_option_factor_factor
        FOREIGN KEY (strategy_environment_factor_id) REFERENCES strategy_environment_factors(id),
    CONSTRAINT fk_strategy_option_factor_linked_by
        FOREIGN KEY (linked_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_option_factor_relationship CHECK (
        relationship_type IN ('responds_to', 'leverages', 'mitigates', 'monitors')
    )
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_option_assumption_links (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_option_id BIGINT UNSIGNED NOT NULL,
    strategy_assumption_id BIGINT UNSIGNED NOT NULL,
    relationship_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    linked_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_option_assumption_link (
        strategy_option_id,
        strategy_assumption_id,
        relationship_type
    ),
    KEY ix_strategy_option_assumption_assumption (strategy_assumption_id),
    CONSTRAINT fk_strategy_option_assumption_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_option_assumption_option
        FOREIGN KEY (strategy_option_id) REFERENCES strategy_options(id),
    CONSTRAINT fk_strategy_option_assumption_assumption
        FOREIGN KEY (strategy_assumption_id) REFERENCES strategy_assumptions(id),
    CONSTRAINT fk_strategy_option_assumption_linked_by
        FOREIGN KEY (linked_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_option_assumption_relationship CHECK (
        relationship_type IN ('depends_on', 'tests', 'mitigates')
    )
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_themes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_framework_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    theme_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority_rank INT UNSIGNED NOT NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    owner_member_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_theme_public (organisation_id, public_id),
    UNIQUE KEY uq_strategy_theme_code (strategy_framework_id, theme_code),
    KEY ix_strategy_theme_framework (strategy_framework_id, lifecycle_status, priority_rank),
    CONSTRAINT fk_strategy_theme_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_theme_framework
        FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id),
    CONSTRAINT fk_strategy_theme_owner
        FOREIGN KEY (owner_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_strategy_theme_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_theme_priority CHECK (priority_rank >= 1),
    CONSTRAINT chk_strategy_theme_status CHECK (lifecycle_status IN ('active', 'retired'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_objective_option_links (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_objective_id BIGINT UNSIGNED NOT NULL,
    strategy_option_id BIGINT UNSIGNED NOT NULL,
    relationship_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'derived_from',
    linked_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_objective_option_link (
        strategy_objective_id,
        strategy_option_id,
        relationship_type
    ),
    KEY ix_strategy_objective_option_option (strategy_option_id),
    CONSTRAINT fk_strategy_objective_option_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_objective_option_objective
        FOREIGN KEY (strategy_objective_id) REFERENCES strategy_objectives(id),
    CONSTRAINT fk_strategy_objective_option_option
        FOREIGN KEY (strategy_option_id) REFERENCES strategy_options(id),
    CONSTRAINT fk_strategy_objective_option_linked_by
        FOREIGN KEY (linked_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_objective_option_relationship CHECK (
        relationship_type IN ('derived_from', 'supports')
    )
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE strategy_objective_theme_links (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    strategy_objective_id BIGINT UNSIGNED NOT NULL,
    strategy_theme_id BIGINT UNSIGNED NOT NULL,
    relationship_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'primary',
    linked_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strategy_objective_theme_link (
        strategy_objective_id,
        strategy_theme_id,
        relationship_type
    ),
    KEY ix_strategy_objective_theme_theme (strategy_theme_id),
    CONSTRAINT fk_strategy_objective_theme_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_strategy_objective_theme_objective
        FOREIGN KEY (strategy_objective_id) REFERENCES strategy_objectives(id),
    CONSTRAINT fk_strategy_objective_theme_theme
        FOREIGN KEY (strategy_theme_id) REFERENCES strategy_themes(id),
    CONSTRAINT fk_strategy_objective_theme_linked_by
        FOREIGN KEY (linked_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_strategy_objective_theme_relationship CHECK (
        relationship_type IN ('primary', 'secondary')
    )
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

-- migrate:down transaction:false
-- Strategic evidence and lineage are attributable enterprise records and are forward-only.
-- Non-production environments are rebuilt from the authoritative migration stream.
SELECT 1;
