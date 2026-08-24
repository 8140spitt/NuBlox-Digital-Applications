-- NuBlox project-controls planning foundation
-- Adds WBS, project-plan activities/milestones, dependency logic and immutable schedule baseline snapshots.
-- This is intentionally separate from workforce schedule_events: WBS/schedule logic is a project-controls structure,
-- while schedule_events remains the operational workforce/resource scheduling surface.
-- migrate:up transaction:false

ALTER TABLE projects
    ADD UNIQUE KEY uq_projects_id_owner_plan (id, owning_organisation_id);

CREATE TABLE project_wbs_nodes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    parent_wbs_node_id BIGINT UNSIGNED NULL,
    wbs_code VARCHAR(80) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_wbs_nodes_public_id (public_id),
    UNIQUE KEY uq_project_wbs_nodes_project_code (project_id, wbs_code),
    UNIQUE KEY uq_project_wbs_nodes_scope (id, project_id, organisation_id),
    KEY idx_project_wbs_nodes_parent (parent_wbs_node_id, project_id, organisation_id),
    KEY idx_project_wbs_nodes_project_sort (project_id, sort_order, id),
    CONSTRAINT fk_project_wbs_nodes_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id),
    CONSTRAINT fk_project_wbs_nodes_project_owner
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id),
    CONSTRAINT fk_project_wbs_nodes_parent_scope
        FOREIGN KEY (parent_wbs_node_id, project_id, organisation_id)
        REFERENCES project_wbs_nodes (id, project_id, organisation_id),
    CONSTRAINT fk_project_wbs_nodes_created_by_member
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT chk_project_wbs_nodes_lifecycle_status
        CHECK (lifecycle_status IN ('active', 'archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_plan_activities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    wbs_node_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    activity_code VARCHAR(80) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    activity_kind VARCHAR(16) NOT NULL DEFAULT 'activity',
    status VARCHAR(32) NOT NULL DEFAULT 'planned',
    planned_start_on DATE NOT NULL,
    planned_finish_on DATE NOT NULL,
    planned_duration_days DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_plan_activities_public_id (public_id),
    UNIQUE KEY uq_project_plan_activities_project_code (project_id, activity_code),
    UNIQUE KEY uq_project_plan_activities_scope (id, project_id, organisation_id),
    KEY idx_project_plan_activities_wbs (wbs_node_id, project_id, organisation_id),
    KEY idx_project_plan_activities_dates (project_id, planned_start_on, planned_finish_on),
    CONSTRAINT fk_project_plan_activities_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id),
    CONSTRAINT fk_project_plan_activities_project_owner
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id),
    CONSTRAINT fk_project_plan_activities_wbs_scope
        FOREIGN KEY (wbs_node_id, project_id, organisation_id)
        REFERENCES project_wbs_nodes (id, project_id, organisation_id),
    CONSTRAINT fk_project_plan_activities_created_by_member
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT chk_project_plan_activities_kind
        CHECK (activity_kind IN ('activity', 'milestone')),
    CONSTRAINT chk_project_plan_activities_status
        CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT chk_project_plan_activities_dates
        CHECK (planned_finish_on >= planned_start_on),
    CONSTRAINT chk_project_plan_activities_duration_kind
        CHECK (
            (activity_kind = 'activity' AND planned_duration_days > 0)
            OR (
                activity_kind = 'milestone'
                AND planned_duration_days = 0
                AND planned_start_on = planned_finish_on
            )
        )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_plan_dependencies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    predecessor_activity_id BIGINT UNSIGNED NOT NULL,
    successor_activity_id BIGINT UNSIGNED NOT NULL,
    dependency_type VARCHAR(2) NOT NULL DEFAULT 'FS',
    lag_days DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    removed_by_member_id BIGINT UNSIGNED NULL,
    removed_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_plan_dependencies_public_id (public_id),
    UNIQUE KEY uq_project_plan_dependencies_scope (id, project_id, organisation_id),
    KEY idx_project_plan_dependencies_predecessor (
        predecessor_activity_id,
        project_id,
        organisation_id
    ),
    KEY idx_project_plan_dependencies_successor (
        successor_activity_id,
        project_id,
        organisation_id
    ),
    KEY idx_project_plan_dependencies_active (project_id, is_active),
    CONSTRAINT fk_project_plan_dependencies_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id),
    CONSTRAINT fk_project_plan_dependencies_project_owner
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id),
    CONSTRAINT fk_project_plan_dependencies_predecessor_scope
        FOREIGN KEY (predecessor_activity_id, project_id, organisation_id)
        REFERENCES project_plan_activities (id, project_id, organisation_id),
    CONSTRAINT fk_project_plan_dependencies_successor_scope
        FOREIGN KEY (successor_activity_id, project_id, organisation_id)
        REFERENCES project_plan_activities (id, project_id, organisation_id),
    CONSTRAINT fk_project_plan_dependencies_created_by_member
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT fk_project_plan_dependencies_removed_by_member
        FOREIGN KEY (removed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT chk_project_plan_dependencies_type
        CHECK (dependency_type IN ('FS', 'SS', 'FF', 'SF')),
    CONSTRAINT chk_project_plan_dependencies_distinct
        CHECK (predecessor_activity_id <> successor_activity_id),
    CONSTRAINT chk_project_plan_dependencies_active_state
        CHECK (
            (is_active = 1 AND removed_by_member_id IS NULL AND removed_at IS NULL)
            OR (is_active = 0 AND removed_by_member_id IS NOT NULL AND removed_at IS NOT NULL)
        )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_plan_baselines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    baseline_number INT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    captured_by_member_id BIGINT UNSIGNED NOT NULL,
    captured_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_plan_baselines_public_id (public_id),
    UNIQUE KEY uq_project_plan_baselines_project_number (project_id, baseline_number),
    UNIQUE KEY uq_project_plan_baselines_scope (id, project_id, organisation_id),
    KEY idx_project_plan_baselines_project_captured (project_id, captured_at),
    CONSTRAINT fk_project_plan_baselines_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id),
    CONSTRAINT fk_project_plan_baselines_project_owner
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id),
    CONSTRAINT fk_project_plan_baselines_captured_by_member
        FOREIGN KEY (captured_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT chk_project_plan_baselines_number
        CHECK (baseline_number > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_plan_baseline_activities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    baseline_id BIGINT UNSIGNED NOT NULL,
    source_activity_id BIGINT UNSIGNED NOT NULL,
    activity_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    wbs_code VARCHAR(80) NOT NULL,
    activity_code VARCHAR(80) NOT NULL,
    name VARCHAR(255) NOT NULL,
    activity_kind VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL,
    planned_start_on DATE NOT NULL,
    planned_finish_on DATE NOT NULL,
    planned_duration_days DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_plan_baseline_activity_source (baseline_id, source_activity_id),
    UNIQUE KEY uq_project_plan_baseline_activity_scope (
        baseline_id,
        source_activity_id,
        project_id,
        organisation_id
    ),
    KEY idx_project_plan_baseline_activities_project (project_id, baseline_id),
    CONSTRAINT fk_project_plan_baseline_activities_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id),
    CONSTRAINT fk_project_plan_baseline_activities_baseline_scope
        FOREIGN KEY (baseline_id, project_id, organisation_id)
        REFERENCES project_plan_baselines (id, project_id, organisation_id),
    CONSTRAINT fk_project_plan_baseline_activities_source_scope
        FOREIGN KEY (source_activity_id, project_id, organisation_id)
        REFERENCES project_plan_activities (id, project_id, organisation_id),
    CONSTRAINT chk_project_plan_baseline_activities_kind
        CHECK (activity_kind IN ('activity', 'milestone')),
    CONSTRAINT chk_project_plan_baseline_activities_status
        CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT chk_project_plan_baseline_activities_dates
        CHECK (planned_finish_on >= planned_start_on),
    CONSTRAINT chk_project_plan_baseline_activities_duration_kind
        CHECK (
            (activity_kind = 'activity' AND planned_duration_days > 0)
            OR (
                activity_kind = 'milestone'
                AND planned_duration_days = 0
                AND planned_start_on = planned_finish_on
            )
        )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_plan_baseline_dependencies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    baseline_id BIGINT UNSIGNED NOT NULL,
    source_dependency_id BIGINT UNSIGNED NOT NULL,
    predecessor_activity_id BIGINT UNSIGNED NOT NULL,
    successor_activity_id BIGINT UNSIGNED NOT NULL,
    predecessor_activity_code VARCHAR(80) NOT NULL,
    successor_activity_code VARCHAR(80) NOT NULL,
    dependency_type VARCHAR(2) NOT NULL,
    lag_days DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_plan_baseline_dependency_source (baseline_id, source_dependency_id),
    KEY idx_project_plan_baseline_dependencies_project (project_id, baseline_id),
    CONSTRAINT fk_project_plan_baseline_dependencies_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id),
    CONSTRAINT fk_project_plan_baseline_dependencies_baseline_scope
        FOREIGN KEY (baseline_id, project_id, organisation_id)
        REFERENCES project_plan_baselines (id, project_id, organisation_id),
    CONSTRAINT fk_project_plan_baseline_dependencies_source_scope
        FOREIGN KEY (source_dependency_id, project_id, organisation_id)
        REFERENCES project_plan_dependencies (id, project_id, organisation_id),
    CONSTRAINT fk_project_plan_baseline_dependencies_predecessor_snapshot
        FOREIGN KEY (baseline_id, predecessor_activity_id, project_id, organisation_id)
        REFERENCES project_plan_baseline_activities (
            baseline_id,
            source_activity_id,
            project_id,
            organisation_id
        ),
    CONSTRAINT fk_project_plan_baseline_dependencies_successor_snapshot
        FOREIGN KEY (baseline_id, successor_activity_id, project_id, organisation_id)
        REFERENCES project_plan_baseline_activities (
            baseline_id,
            source_activity_id,
            project_id,
            organisation_id
        ),
    CONSTRAINT chk_project_plan_baseline_dependencies_type
        CHECK (dependency_type IN ('FS', 'SS', 'FF', 'SF')),
    CONSTRAINT chk_project_plan_baseline_dependencies_distinct
        CHECK (predecessor_activity_id <> successor_activity_id)
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
        'project.plan.view',
        'View project plans',
        'View project WBS, activities, milestones, dependencies and schedule baselines within authorised project scope.',
        TRUE
    ),
    (
        NULL,
        'project.plan.manage',
        'Manage project plans',
        'Create and maintain the current WBS, activities, milestones and dependency network for organisation-owned projects.',
        TRUE
    ),
    (
        NULL,
        'project.plan.baseline.manage',
        'Capture project schedule baselines',
        'Capture immutable project-plan baseline snapshots for organisation-owned projects.',
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
                'project.plan.view',
                'project.plan.manage',
                'project.plan.baseline.manage'
            )
        )
        OR (
            role.name IN (
                'Finance/Commercial',
                'Member/Professional',
                'Field Worker',
                'Read Only'
            )
            AND permission.permission_key = 'project.plan.view'
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
DROP TABLE project_plan_baseline_dependencies;
DROP TABLE project_plan_baseline_activities;
DROP TABLE project_plan_baselines;
DROP TABLE project_plan_dependencies;
DROP TABLE project_plan_activities;
DROP TABLE project_wbs_nodes;
ALTER TABLE projects DROP INDEX uq_projects_id_owner_plan;
