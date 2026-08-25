-- NuBlox project progress measurement and earned-value foundation
-- Adds controlled progress periods, activity measurements and immutable performance-measurement baselines.
-- PV/EV are project-controls projections; AC remains sourced from canonical project financial-control facts.
-- migrate:up transaction:false

CREATE TABLE project_earned_value_baselines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    baseline_number INT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    source_plan_baseline_id BIGINT UNSIGNED NOT NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    control_budget_snapshot DECIMAL(20,4) NOT NULL,
    lifecycle_status VARCHAR(24) NOT NULL DEFAULT 'draft',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    approved_by_member_id BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_ev_baselines_public_id (public_id),
    UNIQUE KEY uq_project_ev_baselines_number (project_id, baseline_number),
    UNIQUE KEY uq_project_ev_baselines_scope (id, project_id, organisation_id),
    UNIQUE KEY uq_project_ev_baselines_plan_scope (
        id,
        source_plan_baseline_id,
        project_id,
        organisation_id
    ),
    KEY idx_project_ev_baselines_project_status (project_id, lifecycle_status, baseline_number),
    CONSTRAINT fk_project_ev_baselines_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id),
    CONSTRAINT fk_project_ev_baselines_project_owner
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id),
    CONSTRAINT fk_project_ev_baselines_plan_scope
        FOREIGN KEY (source_plan_baseline_id, project_id, organisation_id)
        REFERENCES project_plan_baselines (id, project_id, organisation_id),
    CONSTRAINT fk_project_ev_baselines_created_by_member
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT fk_project_ev_baselines_approved_by_member
        FOREIGN KEY (approved_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT chk_project_ev_baselines_number CHECK (baseline_number > 0),
    CONSTRAINT chk_project_ev_baselines_budget CHECK (control_budget_snapshot >= 0),
    CONSTRAINT chk_project_ev_baselines_status
        CHECK (lifecycle_status IN ('draft', 'approved', 'superseded')),
    CONSTRAINT chk_project_ev_baselines_approval_state
        CHECK (
            (lifecycle_status = 'draft' AND approved_by_member_id IS NULL AND approved_at IS NULL)
            OR (
                lifecycle_status IN ('approved', 'superseded')
                AND approved_by_member_id IS NOT NULL
                AND approved_at IS NOT NULL
            )
        )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_earned_value_baseline_allocations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    earned_value_baseline_id BIGINT UNSIGNED NOT NULL,
    source_plan_baseline_id BIGINT UNSIGNED NOT NULL,
    source_activity_id BIGINT UNSIGNED NOT NULL,
    budget_at_completion_amount DECIMAL(20,4) NOT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_ev_allocations_activity (earned_value_baseline_id, source_activity_id),
    KEY idx_project_ev_allocations_project (project_id, earned_value_baseline_id),
    CONSTRAINT fk_project_ev_allocations_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id),
    CONSTRAINT fk_project_ev_allocations_baseline_scope
        FOREIGN KEY (
            earned_value_baseline_id,
            source_plan_baseline_id,
            project_id,
            organisation_id
        ) REFERENCES project_earned_value_baselines (
            id,
            source_plan_baseline_id,
            project_id,
            organisation_id
        ),
    CONSTRAINT fk_project_ev_allocations_plan_activity_scope
        FOREIGN KEY (
            source_plan_baseline_id,
            source_activity_id,
            project_id,
            organisation_id
        ) REFERENCES project_plan_baseline_activities (
            baseline_id,
            source_activity_id,
            project_id,
            organisation_id
        ),
    CONSTRAINT fk_project_ev_allocations_created_by_member
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT chk_project_ev_allocations_amount CHECK (budget_at_completion_amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_progress_periods (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    period_number INT UNSIGNED NOT NULL,
    label VARCHAR(255) NOT NULL,
    data_date DATE NOT NULL,
    lifecycle_status VARCHAR(24) NOT NULL DEFAULT 'open',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    submitted_by_member_id BIGINT UNSIGNED NULL,
    submitted_at DATETIME(6) NULL,
    approved_by_member_id BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_progress_periods_public_id (public_id),
    UNIQUE KEY uq_project_progress_periods_number (project_id, period_number),
    UNIQUE KEY uq_project_progress_periods_data_date (project_id, data_date),
    UNIQUE KEY uq_project_progress_periods_scope (id, project_id, organisation_id),
    KEY idx_project_progress_periods_status (project_id, lifecycle_status, data_date),
    CONSTRAINT fk_project_progress_periods_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id),
    CONSTRAINT fk_project_progress_periods_project_owner
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id),
    CONSTRAINT fk_project_progress_periods_created_by_member
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT fk_project_progress_periods_submitted_by_member
        FOREIGN KEY (submitted_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT fk_project_progress_periods_approved_by_member
        FOREIGN KEY (approved_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT chk_project_progress_periods_number CHECK (period_number > 0),
    CONSTRAINT chk_project_progress_periods_status
        CHECK (lifecycle_status IN ('open', 'submitted', 'approved')),
    CONSTRAINT chk_project_progress_periods_state
        CHECK (
            (
                lifecycle_status = 'open'
                AND submitted_by_member_id IS NULL
                AND submitted_at IS NULL
                AND approved_by_member_id IS NULL
                AND approved_at IS NULL
            )
            OR (
                lifecycle_status = 'submitted'
                AND submitted_by_member_id IS NOT NULL
                AND submitted_at IS NOT NULL
                AND approved_by_member_id IS NULL
                AND approved_at IS NULL
            )
            OR (
                lifecycle_status = 'approved'
                AND submitted_by_member_id IS NOT NULL
                AND submitted_at IS NOT NULL
                AND approved_by_member_id IS NOT NULL
                AND approved_at IS NOT NULL
            )
        )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_activity_progress_measurements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    progress_period_id BIGINT UNSIGNED NOT NULL,
    activity_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    measurement_method VARCHAR(24) NOT NULL DEFAULT 'manual_percent',
    percent_complete DECIMAL(5,2) NOT NULL,
    actual_start_on DATE NULL,
    actual_finish_on DATE NULL,
    remaining_duration_days DECIMAL(10,2) NULL,
    quantity_complete DECIMAL(18,6) NULL,
    quantity_total DECIMAL(18,6) NULL,
    quantity_unit VARCHAR(32) NULL,
    commentary TEXT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_by_member_id BIGINT UNSIGNED NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_activity_progress_public_id (public_id),
    UNIQUE KEY uq_project_activity_progress_period_activity (progress_period_id, activity_id),
    KEY idx_project_activity_progress_project (project_id, progress_period_id, activity_id),
    CONSTRAINT fk_project_activity_progress_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id),
    CONSTRAINT fk_project_activity_progress_period_scope
        FOREIGN KEY (progress_period_id, project_id, organisation_id)
        REFERENCES project_progress_periods (id, project_id, organisation_id),
    CONSTRAINT fk_project_activity_progress_activity_scope
        FOREIGN KEY (activity_id, project_id, organisation_id)
        REFERENCES project_plan_activities (id, project_id, organisation_id),
    CONSTRAINT fk_project_activity_progress_created_by_member
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT fk_project_activity_progress_updated_by_member
        FOREIGN KEY (updated_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT chk_project_activity_progress_method
        CHECK (
            measurement_method IN (
                'manual_percent',
                'milestone_0_100',
                'milestone_50_50',
                'quantity'
            )
        ),
    CONSTRAINT chk_project_activity_progress_percent
        CHECK (percent_complete >= 0 AND percent_complete <= 100),
    CONSTRAINT chk_project_activity_progress_remaining
        CHECK (remaining_duration_days IS NULL OR remaining_duration_days >= 0),
    CONSTRAINT chk_project_activity_progress_dates
        CHECK (
            actual_finish_on IS NULL
            OR (actual_start_on IS NOT NULL AND actual_finish_on >= actual_start_on)
        ),
    CONSTRAINT chk_project_activity_progress_complete_state
        CHECK (
            percent_complete < 100
            OR (actual_finish_on IS NOT NULL AND (remaining_duration_days IS NULL OR remaining_duration_days = 0))
        ),
    CONSTRAINT chk_project_activity_progress_method_values
        CHECK (
            (measurement_method = 'manual_percent')
            OR (measurement_method = 'milestone_0_100' AND percent_complete IN (0, 100))
            OR (measurement_method = 'milestone_50_50' AND percent_complete IN (0, 50, 100))
            OR (
                measurement_method = 'quantity'
                AND quantity_complete IS NOT NULL
                AND quantity_total IS NOT NULL
                AND quantity_total > 0
                AND quantity_complete >= 0
                AND quantity_complete <= quantity_total
                AND quantity_unit IS NOT NULL
            )
        ),
    CONSTRAINT chk_project_activity_progress_quantity_state
        CHECK (
            measurement_method = 'quantity'
            OR (
                quantity_complete IS NULL
                AND quantity_total IS NULL
                AND quantity_unit IS NULL
            )
        )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
        'project.progress.view',
        'View project progress',
        'View controlled project progress periods, approved measurements and earned-value performance within authorised project scope.',
        TRUE
    ),
    (
        NULL,
        'project.progress.manage',
        'Manage project progress',
        'Create progress periods, record activity progress and submit project progress for approval.',
        TRUE
    ),
    (
        NULL,
        'project.progress.approve',
        'Approve project progress',
        'Approve submitted project progress periods and lock their measurements as official project-control facts.',
        TRUE
    ),
    (
        NULL,
        'project.progress.baseline.manage',
        'Manage earned-value baselines',
        'Create and approve performance-measurement baselines that allocate a frozen control-budget snapshot to immutable schedule-baseline activities.',
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
                'project.progress.view',
                'project.progress.manage',
                'project.progress.approve',
                'project.progress.baseline.manage'
            )
        )
        OR (
            role.name IN ('Member/Professional', 'Field Worker')
            AND permission.permission_key IN (
                'project.progress.view',
                'project.progress.manage'
            )
        )
        OR (
            role.name IN ('Finance/Commercial', 'Read Only')
            AND permission.permission_key = 'project.progress.view'
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
DROP TABLE project_activity_progress_measurements;
DROP TABLE project_progress_periods;
DROP TABLE project_earned_value_baseline_allocations;
DROP TABLE project_earned_value_baselines;
