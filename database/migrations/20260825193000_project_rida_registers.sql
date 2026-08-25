-- NuBlox governed project risk, issue, decision and action registers
-- Risks, issues and decisions are canonical project-controls records.
-- Follow-up actions remain canonical Work Kernel work_items linked through source metadata.
-- migrate:up transaction:false

CREATE TABLE project_control_register_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    item_number INT UNSIGNED NOT NULL,
    item_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    priority VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'normal',
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    owner_member_id BIGINT UNSIGNED NULL,
    due_on DATE NULL,

    risk_direction VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
    probability_score TINYINT UNSIGNED NULL,
    impact_score TINYINT UNSIGNED NULL,
    response_strategy VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
    response_plan TEXT NULL,
    residual_probability_score TINYINT UNSIGNED NULL,
    residual_impact_score TINYINT UNSIGNED NULL,

    severity VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
    impact_summary TEXT NULL,
    resolution_plan TEXT NULL,

    decision_required_on DATE NULL,
    decision_outcome TEXT NULL,
    decision_rationale TEXT NULL,
    decided_by_member_id BIGINT UNSIGNED NULL,
    decided_at DATETIME(6) NULL,

    raised_by_member_id BIGINT UNSIGNED NOT NULL,
    raised_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_by_member_id BIGINT UNSIGNED NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    closed_by_member_id BIGINT UNSIGNED NULL,
    closed_at DATETIME(6) NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_control_register_public_id (public_id),
    UNIQUE KEY uq_project_control_register_number (project_id, item_type, item_number),
    UNIQUE KEY uq_project_control_register_scope (id, project_id, organisation_id),
    KEY idx_project_control_register_project_type_status (project_id, item_type, lifecycle_status, priority),
    KEY idx_project_control_register_owner_due (organisation_id, owner_member_id, due_on),
    KEY idx_project_control_register_raised (raised_by_member_id, organisation_id),

    CONSTRAINT fk_project_control_register_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_control_register_project_owner
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_control_register_owner_member
        FOREIGN KEY (owner_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_control_register_raised_by_member
        FOREIGN KEY (raised_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_control_register_updated_by_member
        FOREIGN KEY (updated_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_control_register_decided_by_member
        FOREIGN KEY (decided_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_control_register_closed_by_member
        FOREIGN KEY (closed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_project_control_register_number
        CHECK (item_number > 0),
    CONSTRAINT chk_project_control_register_type
        CHECK (item_type IN ('risk', 'issue', 'decision')),
    CONSTRAINT chk_project_control_register_priority
        CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    CONSTRAINT chk_project_control_register_risk_direction
        CHECK (risk_direction IS NULL OR risk_direction IN ('threat', 'opportunity')),
    CONSTRAINT chk_project_control_register_probability
        CHECK (probability_score IS NULL OR probability_score BETWEEN 1 AND 5),
    CONSTRAINT chk_project_control_register_impact
        CHECK (impact_score IS NULL OR impact_score BETWEEN 1 AND 5),
    CONSTRAINT chk_project_control_register_residual_probability
        CHECK (residual_probability_score IS NULL OR residual_probability_score BETWEEN 1 AND 5),
    CONSTRAINT chk_project_control_register_residual_impact
        CHECK (residual_impact_score IS NULL OR residual_impact_score BETWEEN 1 AND 5),
    CONSTRAINT chk_project_control_register_response_strategy
        CHECK (
            response_strategy IS NULL
            OR response_strategy IN ('avoid', 'reduce', 'transfer', 'accept', 'exploit', 'enhance', 'share')
        ),
    CONSTRAINT chk_project_control_register_issue_severity
        CHECK (severity IS NULL OR severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT chk_project_control_register_type_fields
        CHECK (
            (
                item_type = 'risk'
                AND risk_direction IS NOT NULL
                AND probability_score IS NOT NULL
                AND impact_score IS NOT NULL
                AND severity IS NULL
                AND impact_summary IS NULL
                AND resolution_plan IS NULL
                AND decision_required_on IS NULL
            )
            OR (
                item_type = 'issue'
                AND risk_direction IS NULL
                AND probability_score IS NULL
                AND impact_score IS NULL
                AND response_strategy IS NULL
                AND response_plan IS NULL
                AND residual_probability_score IS NULL
                AND residual_impact_score IS NULL
                AND severity IS NOT NULL
                AND decision_required_on IS NULL
            )
            OR (
                item_type = 'decision'
                AND risk_direction IS NULL
                AND probability_score IS NULL
                AND impact_score IS NULL
                AND response_strategy IS NULL
                AND response_plan IS NULL
                AND residual_probability_score IS NULL
                AND residual_impact_score IS NULL
                AND severity IS NULL
                AND impact_summary IS NULL
                AND resolution_plan IS NULL
            )
        ),
    CONSTRAINT chk_project_control_register_lifecycle
        CHECK (
            (item_type = 'risk' AND lifecycle_status IN ('open', 'monitoring', 'realised', 'closed'))
            OR (item_type = 'issue' AND lifecycle_status IN ('open', 'investigating', 'resolved', 'closed'))
            OR (item_type = 'decision' AND lifecycle_status IN ('proposed', 'pending', 'decided', 'superseded'))
        ),
    CONSTRAINT chk_project_control_register_decision_state
        CHECK (
            (
                item_type <> 'decision'
                AND decision_outcome IS NULL
                AND decision_rationale IS NULL
                AND decided_by_member_id IS NULL
                AND decided_at IS NULL
            )
            OR (
                item_type = 'decision'
                AND lifecycle_status IN ('proposed', 'pending')
                AND decision_outcome IS NULL
                AND decided_by_member_id IS NULL
                AND decided_at IS NULL
            )
            OR (
                item_type = 'decision'
                AND lifecycle_status IN ('decided', 'superseded')
                AND decision_outcome IS NOT NULL
                AND decided_by_member_id IS NOT NULL
                AND decided_at IS NOT NULL
            )
        ),
    CONSTRAINT chk_project_control_register_closed_state
        CHECK (
            (
                item_type IN ('risk', 'issue')
                AND lifecycle_status = 'closed'
                AND closed_by_member_id IS NOT NULL
                AND closed_at IS NOT NULL
            )
            OR (
                item_type IN ('risk', 'issue')
                AND lifecycle_status <> 'closed'
                AND closed_by_member_id IS NULL
                AND closed_at IS NULL
            )
            OR (
                item_type = 'decision'
                AND closed_by_member_id IS NULL
                AND closed_at IS NULL
            )
        )
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
        'project.rida.view',
        'View project RIDA registers',
        'View governed project risks, issues, decisions and their linked Work Kernel actions within authorised project scope.',
        TRUE
    ),
    (
        NULL,
        'project.rida.manage',
        'Manage project RIDA registers',
        'Raise and maintain project risks, issues and decision proposals, and create linked follow-up actions.',
        TRUE
    ),
    (
        NULL,
        'project.rida.decide',
        'Record project decisions',
        'Record authoritative project decision outcomes and rationale within authorised project scope.',
        TRUE
    ),
    (
        NULL,
        'project.rida.close',
        'Close project risks and issues',
        'Close governed project risks and issues when their treatment or resolution is complete.',
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
                'project.rida.view',
                'project.rida.manage',
                'project.rida.decide',
                'project.rida.close'
            )
        )
        OR (
            role.name IN ('Member/Professional', 'Field Worker')
            AND permission.permission_key IN ('project.rida.view', 'project.rida.manage')
        )
        OR (
            role.name IN ('Finance/Commercial', 'Read Only')
            AND permission.permission_key = 'project.rida.view'
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- Actions are deliberately not duplicated here. Project-control actions use the canonical
-- work_items table with source_domain='project_controls', source_type='project_rida_item'
-- and source_public_id referencing the register item's immutable public_id.

-- migrate:down transaction:false
DROP TABLE project_control_register_items;
