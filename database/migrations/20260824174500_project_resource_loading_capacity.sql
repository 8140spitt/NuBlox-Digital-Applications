-- NuBlox project resource loading and capacity foundation
-- Adds activity-level planned effort against the canonical project workforce pool.
-- Capacity remains derived from workforce calendars, unavailability and project resource assignment limits.
-- migrate:up transaction:false

ALTER TABLE project_resource_assignments
    ADD UNIQUE KEY uq_project_resource_assignments_activity_scope (
        id,
        project_id,
        organisation_id,
        worker_id
    );

CREATE TABLE project_activity_resource_allocations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    project_plan_activity_id BIGINT UNSIGNED NOT NULL,
    project_resource_assignment_id BIGINT UNSIGNED NOT NULL,
    worker_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    planned_effort_minutes INT UNSIGNED NOT NULL,
    load_start_on DATE NOT NULL,
    load_finish_on DATE NOT NULL,
    allocation_status VARCHAR(16) NOT NULL DEFAULT 'active',
    notes TEXT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    removed_by_member_id BIGINT UNSIGNED NULL,
    removed_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_activity_resource_allocations_public_id (public_id),
    UNIQUE KEY uq_project_activity_resource_allocations_scope (id, project_id, organisation_id),
    KEY idx_project_activity_resource_allocations_activity (
        project_plan_activity_id,
        project_id,
        organisation_id,
        allocation_status
    ),
    KEY idx_project_activity_resource_allocations_worker (
        worker_id,
        project_id,
        load_start_on,
        load_finish_on,
        allocation_status
    ),
    KEY idx_project_activity_resource_allocations_assignment (
        project_resource_assignment_id,
        project_id,
        organisation_id,
        worker_id
    ),
    CONSTRAINT fk_project_activity_resource_allocations_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id),
    CONSTRAINT fk_project_activity_resource_allocations_project_owner
        FOREIGN KEY (project_id, organisation_id)
        REFERENCES projects (id, owning_organisation_id),
    CONSTRAINT fk_project_activity_resource_allocations_activity_scope
        FOREIGN KEY (project_plan_activity_id, project_id, organisation_id)
        REFERENCES project_plan_activities (id, project_id, organisation_id),
    CONSTRAINT fk_project_activity_resource_allocations_assignment_scope
        FOREIGN KEY (
            project_resource_assignment_id,
            project_id,
            organisation_id,
            worker_id
        ) REFERENCES project_resource_assignments (
            id,
            project_id,
            organisation_id,
            worker_id
        ),
    CONSTRAINT fk_project_activity_resource_allocations_created_by_member
        FOREIGN KEY (created_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT fk_project_activity_resource_allocations_removed_by_member
        FOREIGN KEY (removed_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id),
    CONSTRAINT chk_project_activity_resource_allocations_effort
        CHECK (planned_effort_minutes > 0),
    CONSTRAINT chk_project_activity_resource_allocations_dates
        CHECK (load_finish_on >= load_start_on),
    CONSTRAINT chk_project_activity_resource_allocations_state
        CHECK (
            (allocation_status = 'active' AND removed_by_member_id IS NULL AND removed_at IS NULL)
            OR (
                allocation_status = 'removed'
                AND removed_by_member_id IS NOT NULL
                AND removed_at IS NOT NULL
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
        'project.resource.view',
        'View project resource loading and capacity',
        'View project-assigned resources, activity effort loading, available project capacity and overload indicators within authorised project scope.',
        TRUE
    ),
    (
        NULL,
        'project.resource.manage',
        'Manage project resource loading',
        'Allocate planned effort from the canonical project workforce pool to project-plan activities and record additive corrections.',
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
                'project.resource.view',
                'project.resource.manage'
            )
        )
        OR (
            role.name IN ('Finance/Commercial', 'Member/Professional', 'Read Only')
            AND permission.permission_key = 'project.resource.view'
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
DROP TABLE project_activity_resource_allocations;
ALTER TABLE project_resource_assignments
    DROP INDEX uq_project_resource_assignments_activity_scope;
