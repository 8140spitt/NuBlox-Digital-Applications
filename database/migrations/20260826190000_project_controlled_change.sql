-- NuBlox controlled project change governance
-- Extends the canonical project_change_events register with versioned impact assessment,
-- explicit scope/programme/cost/contract links, immutable decision evidence and implementation evidence.
-- migrate:up transaction:false

ALTER TABLE project_change_events
    ADD UNIQUE KEY uq_project_change_events_scope_control (
        id,
        project_id,
        owning_organisation_id
    );

CREATE TABLE project_change_assessments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    project_change_event_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    version_status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',

    scope_impact_level VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'none',
    programme_impact_level VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'none',
    cost_impact_level VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'none',
    contract_impact_level VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'none',
    information_impact_level VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'none',

    scope_summary TEXT NULL,
    programme_summary TEXT NULL,
    cost_summary TEXT NULL,
    contract_summary TEXT NULL,
    information_summary TEXT NULL,

    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
    estimated_cost_delta DECIMAL(18,2) NULL,
    estimated_time_delta_days DECIMAL(10,2) NULL,

    prepared_by_member_id BIGINT UNSIGNED NOT NULL,
    prepared_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    submitted_by_member_id BIGINT UNSIGNED NULL,
    submitted_at DATETIME(6) NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_change_assessments_public_id (public_id),
    UNIQUE KEY uq_project_change_assessments_version (project_change_event_id, version_number),
    UNIQUE KEY uq_project_change_assessments_scope (id, project_id, organisation_id),
    KEY idx_project_change_assessments_event_status (
        project_change_event_id,
        version_status,
        version_number
    ),

    CONSTRAINT fk_project_change_assessments_project_owner
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_change_assessments_event_scope
        FOREIGN KEY (project_change_event_id, project_id, organisation_id)
        REFERENCES project_change_events (id, project_id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_project_change_assessments_prepared_by
        FOREIGN KEY (prepared_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_change_assessments_submitted_by
        FOREIGN KEY (submitted_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_project_change_assessments_version_number
        CHECK (version_number > 0),
    CONSTRAINT chk_project_change_assessments_version_status
        CHECK (version_status IN ('draft', 'submitted', 'superseded', 'withdrawn')),
    CONSTRAINT chk_project_change_assessments_scope_level
        CHECK (scope_impact_level IN ('none', 'potential', 'confirmed')),
    CONSTRAINT chk_project_change_assessments_programme_level
        CHECK (programme_impact_level IN ('none', 'potential', 'confirmed')),
    CONSTRAINT chk_project_change_assessments_cost_level
        CHECK (cost_impact_level IN ('none', 'potential', 'confirmed')),
    CONSTRAINT chk_project_change_assessments_contract_level
        CHECK (contract_impact_level IN ('none', 'potential', 'confirmed')),
    CONSTRAINT chk_project_change_assessments_information_level
        CHECK (information_impact_level IN ('none', 'potential', 'confirmed')),
    CONSTRAINT chk_project_change_assessments_currency
        CHECK (currency_code IS NULL OR CHAR_LENGTH(currency_code) = 3),
    CONSTRAINT chk_project_change_assessments_submission
        CHECK (
            (version_status = 'draft' AND submitted_by_member_id IS NULL AND submitted_at IS NULL)
            OR (
                version_status IN ('submitted', 'superseded', 'withdrawn')
                AND submitted_by_member_id IS NOT NULL
                AND submitted_at IS NOT NULL
            )
        )
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_change_wbs_impacts (
    assessment_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    wbs_node_id BIGINT UNSIGNED NOT NULL,
    impact_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'affected',
    impact_summary TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (assessment_id, wbs_node_id),
    KEY idx_project_change_wbs_impacts_wbs (wbs_node_id, project_id, organisation_id),

    CONSTRAINT fk_project_change_wbs_impacts_assessment
        FOREIGN KEY (assessment_id, project_id, organisation_id)
        REFERENCES project_change_assessments (id, project_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_project_change_wbs_impacts_wbs
        FOREIGN KEY (wbs_node_id, project_id, organisation_id)
        REFERENCES project_wbs_nodes (id, project_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_project_change_wbs_impacts_type
        CHECK (impact_type IN ('affected', 'modify', 'remove', 'resequence'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_change_activity_impacts (
    assessment_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    project_plan_activity_id BIGINT UNSIGNED NOT NULL,
    impact_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'affected',
    time_delta_days DECIMAL(10,2) NULL,
    impact_summary TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (assessment_id, project_plan_activity_id),
    KEY idx_project_change_activity_impacts_activity (
        project_plan_activity_id,
        project_id,
        organisation_id
    ),

    CONSTRAINT fk_project_change_activity_impacts_assessment
        FOREIGN KEY (assessment_id, project_id, organisation_id)
        REFERENCES project_change_assessments (id, project_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_project_change_activity_impacts_activity
        FOREIGN KEY (project_plan_activity_id, project_id, organisation_id)
        REFERENCES project_plan_activities (id, project_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_project_change_activity_impacts_type
        CHECK (impact_type IN ('affected', 'modify', 'delay', 'accelerate', 'remove'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_change_cost_impacts (
    assessment_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    project_cost_code_id BIGINT UNSIGNED NOT NULL,
    impact_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'uncertain',
    amount_delta DECIMAL(18,2) NULL,
    impact_summary TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (assessment_id, project_cost_code_id),
    KEY idx_project_change_cost_impacts_cost_code (
        project_cost_code_id,
        project_id,
        organisation_id
    ),

    CONSTRAINT fk_project_change_cost_impacts_assessment
        FOREIGN KEY (assessment_id, project_id, organisation_id)
        REFERENCES project_change_assessments (id, project_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_project_change_cost_impacts_cost_code
        FOREIGN KEY (project_cost_code_id, project_id, organisation_id)
        REFERENCES project_cost_codes (id, project_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_project_change_cost_impacts_type
        CHECK (impact_type IN ('increase', 'decrease', 'transfer', 'uncertain'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_change_contract_impacts (
    assessment_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    contract_id BIGINT UNSIGNED NOT NULL,
    impact_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'other',
    impact_summary TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (assessment_id, contract_id, impact_type),
    KEY idx_project_change_contract_impacts_contract (contract_id, organisation_id),

    CONSTRAINT fk_project_change_contract_impacts_assessment
        FOREIGN KEY (assessment_id, project_id, organisation_id)
        REFERENCES project_change_assessments (id, project_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_project_change_contract_impacts_contract
        FOREIGN KEY (contract_id, organisation_id)
        REFERENCES contracts (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_project_change_contract_impacts_type
        CHECK (impact_type IN ('scope', 'price', 'time', 'notice', 'amendment', 'other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_change_decisions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    project_change_event_id BIGINT UNSIGNED NOT NULL,
    assessment_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    decision_number INT UNSIGNED NOT NULL,
    decision VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    rationale TEXT NOT NULL,
    conditions TEXT NULL,
    decided_by_member_id BIGINT UNSIGNED NOT NULL,
    decided_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_change_decisions_public_id (public_id),
    UNIQUE KEY uq_project_change_decisions_number (project_change_event_id, decision_number),
    KEY idx_project_change_decisions_event (project_change_event_id, decided_at),

    CONSTRAINT fk_project_change_decisions_event_scope
        FOREIGN KEY (project_change_event_id, project_id, organisation_id)
        REFERENCES project_change_events (id, project_id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_change_decisions_assessment_scope
        FOREIGN KEY (assessment_id, project_id, organisation_id)
        REFERENCES project_change_assessments (id, project_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_change_decisions_decided_by
        FOREIGN KEY (decided_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_project_change_decisions_number
        CHECK (decision_number > 0),
    CONSTRAINT chk_project_change_decisions_value
        CHECK (decision IN ('accepted', 'accepted_with_conditions', 'rejected', 'deferred'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_change_implementations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    project_change_event_id BIGINT UNSIGNED NOT NULL,
    assessment_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    implementation_summary TEXT NOT NULL,
    implemented_by_member_id BIGINT UNSIGNED NOT NULL,
    implemented_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_change_implementations_public_id (public_id),
    UNIQUE KEY uq_project_change_implementations_event (project_change_event_id),

    CONSTRAINT fk_project_change_implementations_event_scope
        FOREIGN KEY (project_change_event_id, project_id, organisation_id)
        REFERENCES project_change_events (id, project_id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_change_implementations_assessment_scope
        FOREIGN KEY (assessment_id, project_id, organisation_id)
        REFERENCES project_change_assessments (id, project_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_change_implementations_implemented_by
        FOREIGN KEY (implemented_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (
        NULL,
        'project.change.view',
        'View project change control',
        'View governed project change events, impact assessments, decisions and implementation evidence within authorised project scope.',
        TRUE
    ),
    (
        NULL,
        'project.change.manage',
        'Raise and maintain project changes',
        'Raise project change events and maintain draft change-control information.',
        TRUE
    ),
    (
        NULL,
        'project.change.assess',
        'Assess project change impact',
        'Prepare and submit controlled scope, programme, cost, contract and information impact assessments.',
        TRUE
    ),
    (
        NULL,
        'project.change.approve',
        'Decide project changes',
        'Record authoritative accept, reject or defer decisions against submitted project change assessments.',
        TRUE
    ),
    (
        NULL,
        'project.change.implement',
        'Implement approved project changes',
        'Record implementation evidence for approved project changes after downstream controls have been updated.',
        TRUE
    ),
    (
        NULL,
        'project.change.close',
        'Close project changes',
        'Close implemented or rejected project changes with controlled evidence.',
        TRUE
    )
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

INSERT IGNORE INTO role_permissions (
    organisation_id,
    organisation_role_id,
    permission_id
)
SELECT
    role.organisation_id,
    role.id,
    permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission
    ON (
        (
            role.name IN ('Owner', 'Administrator', 'Manager')
            AND permission.permission_key IN (
                'project.change.view',
                'project.change.manage',
                'project.change.assess',
                'project.change.approve',
                'project.change.implement',
                'project.change.close'
            )
        )
        OR (
            role.name = 'Finance/Commercial'
            AND permission.permission_key IN ('project.change.view', 'project.change.assess')
        )
        OR (
            role.name = 'Member/Professional'
            AND permission.permission_key IN (
                'project.change.view',
                'project.change.manage',
                'project.change.assess',
                'project.change.implement'
            )
        )
        OR (
            role.name = 'Field Worker'
            AND permission.permission_key IN ('project.change.view', 'project.change.manage')
        )
        OR (
            role.name = 'Read Only'
            AND permission.permission_key = 'project.change.view'
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
DROP TABLE project_change_implementations;
DROP TABLE project_change_decisions;
DROP TABLE project_change_contract_impacts;
DROP TABLE project_change_cost_impacts;
DROP TABLE project_change_activity_impacts;
DROP TABLE project_change_wbs_impacts;
DROP TABLE project_change_assessments;
ALTER TABLE project_change_events DROP INDEX uq_project_change_events_scope_control;
