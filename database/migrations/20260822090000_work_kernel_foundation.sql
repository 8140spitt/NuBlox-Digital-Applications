-- NuBlox canonical Work Kernel foundation
-- Cross-domain work items, assignments, decisions, lifecycle evidence and durable outbox.
-- migrate:up transaction:false

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE work_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    work_item_kind VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'action',
    source_domain VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_type VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NULL,
    source_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    priority VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'normal',
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    due_at DATETIME(6) NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    started_at DATETIME(6) NULL,
    completed_by_member_id BIGINT UNSIGNED NULL,
    completed_at DATETIME(6) NULL,
    cancelled_by_member_id BIGINT UNSIGNED NULL,
    cancelled_at DATETIME(6) NULL,
    completion_note TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_work_items_public_id (public_id),
    UNIQUE KEY uq_work_items_id_owner (id, owning_organisation_id),
    KEY idx_work_items_owner_status_due (owning_organisation_id, status, due_at),
    KEY idx_work_items_project_status (project_id, status, due_at),
    KEY idx_work_items_source (owning_organisation_id, source_domain, source_type, source_public_id),
    KEY idx_work_items_creator (created_by_member_id, owning_organisation_id),

    CONSTRAINT fk_work_items_owner
        FOREIGN KEY (owning_organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_items_project
        FOREIGN KEY (project_id)
        REFERENCES projects (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_items_creator
        FOREIGN KEY (created_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_items_completed_by
        FOREIGN KEY (completed_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_items_cancelled_by
        FOREIGN KEY (cancelled_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_work_items_kind
        CHECK (work_item_kind IN ('action', 'task', 'approval', 'review', 'decision', 'acknowledgement')),
    CONSTRAINT ck_work_items_priority
        CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'critical')),
    CONSTRAINT ck_work_items_status
        CHECK (status IN ('open', 'in_progress', 'blocked', 'completed', 'cancelled')),
    CONSTRAINT ck_work_items_source_pair
        CHECK (
            (source_type IS NULL AND source_public_id IS NULL)
            OR (source_type IS NOT NULL AND source_public_id IS NOT NULL)
        ),
    CONSTRAINT ck_work_items_started
        CHECK (started_at IS NULL OR status IN ('in_progress', 'blocked', 'completed', 'cancelled')),
    CONSTRAINT ck_work_items_completed
        CHECK (
            (status = 'completed' AND completed_at IS NOT NULL AND completed_by_member_id IS NOT NULL)
            OR (status <> 'completed' AND completed_at IS NULL AND completed_by_member_id IS NULL)
        ),
    CONSTRAINT ck_work_items_cancelled
        CHECK (
            (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_by_member_id IS NOT NULL)
            OR (status <> 'cancelled' AND cancelled_at IS NULL AND cancelled_by_member_id IS NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE work_item_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    work_item_id BIGINT UNSIGNED NOT NULL,
    work_item_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    assignment_scope VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    assigned_organisation_id BIGINT UNSIGNED NOT NULL,
    assigned_member_id BIGINT UNSIGNED NULL,
    assigned_team_id BIGINT UNSIGNED NULL,
    assigned_by_member_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    ended_by_member_id BIGINT UNSIGNED NULL,
    ended_at DATETIME(6) NULL,
    assignment_note VARCHAR(1000) NULL,

    PRIMARY KEY (id),
    KEY idx_work_item_assignments_work (work_item_id, work_item_owner_organisation_id, ended_at),
    KEY idx_work_item_assignments_member (assigned_organisation_id, assigned_member_id, ended_at),
    KEY idx_work_item_assignments_team (assigned_organisation_id, assigned_team_id, ended_at),

    CONSTRAINT fk_work_item_assignments_work
        FOREIGN KEY (work_item_id, work_item_owner_organisation_id)
        REFERENCES work_items (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_item_assignments_member
        FOREIGN KEY (assigned_member_id, assigned_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_item_assignments_team
        FOREIGN KEY (assigned_team_id, assigned_organisation_id)
        REFERENCES teams (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_item_assignments_assigner
        FOREIGN KEY (assigned_by_member_id, work_item_owner_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_item_assignments_ender
        FOREIGN KEY (ended_by_member_id, work_item_owner_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_work_item_assignments_scope
        CHECK (assignment_scope IN ('organisation', 'team', 'member')),
    CONSTRAINT ck_work_item_assignments_target
        CHECK (
            (assignment_scope = 'organisation' AND assigned_member_id IS NULL AND assigned_team_id IS NULL)
            OR (assignment_scope = 'member' AND assigned_member_id IS NOT NULL AND assigned_team_id IS NULL)
            OR (assignment_scope = 'team' AND assigned_member_id IS NULL AND assigned_team_id IS NOT NULL)
        ),
    CONSTRAINT ck_work_item_assignments_end
        CHECK (
            (ended_at IS NULL AND ended_by_member_id IS NULL)
            OR (ended_at IS NOT NULL AND ended_by_member_id IS NOT NULL AND ended_at >= assigned_at)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE work_item_decisions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    work_item_id BIGINT UNSIGNED NOT NULL,
    work_item_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    decision VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    decided_by_member_id BIGINT UNSIGNED NOT NULL,
    decided_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    decision_note TEXT NULL,

    PRIMARY KEY (id),
    KEY idx_work_item_decisions_work (work_item_id, work_item_owner_organisation_id, decided_at),

    CONSTRAINT fk_work_item_decisions_work
        FOREIGN KEY (work_item_id, work_item_owner_organisation_id)
        REFERENCES work_items (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_item_decisions_member
        FOREIGN KEY (decided_by_member_id, work_item_owner_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_work_item_decisions_decision
        CHECK (decision IN ('approved', 'rejected', 'returned', 'acknowledged'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE work_item_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    work_item_id BIGINT UNSIGNED NOT NULL,
    work_item_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    event_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    event_type VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    from_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    to_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    acting_organisation_id BIGINT UNSIGNED NULL,
    actor_member_id BIGINT UNSIGNED NULL,
    correlation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reason TEXT NULL,
    event_metadata JSON NULL,
    occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_work_item_events_public_id (event_public_id),
    KEY idx_work_item_events_work (work_item_id, work_item_owner_organisation_id, occurred_at),
    KEY idx_work_item_events_correlation (correlation_id),

    CONSTRAINT fk_work_item_events_work
        FOREIGN KEY (work_item_id, work_item_owner_organisation_id)
        REFERENCES work_items (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_work_item_events_actor
        FOREIGN KEY (actor_member_id, acting_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_work_item_events_actor_pair
        CHECK (
            (actor_member_id IS NULL AND acting_organisation_id IS NULL)
            OR (actor_member_id IS NOT NULL AND acting_organisation_id IS NOT NULL)
        ),
    CONSTRAINT ck_work_item_events_from_status
        CHECK (from_status IS NULL OR from_status IN ('open', 'in_progress', 'blocked', 'completed', 'cancelled')),
    CONSTRAINT ck_work_item_events_to_status
        CHECK (to_status IS NULL OR to_status IN ('open', 'in_progress', 'blocked', 'completed', 'cancelled'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE outbox_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    organisation_id BIGINT UNSIGNED NULL,
    topic VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    aggregate_type VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NULL,
    aggregate_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    payload JSON NOT NULL,
    correlation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    deduplication_key VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
    delivery_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    available_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    locked_at DATETIME(6) NULL,
    lock_token CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    published_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_outbox_events_public_id (event_public_id),
    UNIQUE KEY uq_outbox_events_deduplication (deduplication_key),
    KEY idx_outbox_events_delivery (delivery_status, available_at, id),
    KEY idx_outbox_events_correlation (correlation_id),
    KEY idx_outbox_events_aggregate (aggregate_type, aggregate_public_id, created_at),

    CONSTRAINT fk_outbox_events_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_outbox_events_aggregate_pair
        CHECK (
            (aggregate_type IS NULL AND aggregate_public_id IS NULL)
            OR (aggregate_type IS NOT NULL AND aggregate_public_id IS NOT NULL)
        ),
    CONSTRAINT ck_outbox_events_status
        CHECK (delivery_status IN ('pending', 'processing', 'published', 'failed')),
    CONSTRAINT ck_outbox_events_lock
        CHECK (
            (delivery_status = 'processing' AND locked_at IS NOT NULL AND lock_token IS NOT NULL)
            OR (delivery_status <> 'processing' AND locked_at IS NULL AND lock_token IS NULL)
        ),
    CONSTRAINT ck_outbox_events_published
        CHECK (
            (delivery_status = 'published' AND published_at IS NOT NULL)
            OR (delivery_status <> 'published' AND published_at IS NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'work.view', 'View work', 'View work items assigned or visible within effective organisation/project scope.', TRUE),
    (NULL, 'work.create', 'Create work', 'Create canonical work items linked to controlled business processes.', TRUE),
    (NULL, 'work.assign', 'Assign work', 'Assign or reassign canonical work items to organisations, teams or members.', TRUE),
    (NULL, 'work.progress', 'Progress work', 'Start, block or resume assigned work items.', TRUE),
    (NULL, 'work.complete', 'Complete work', 'Complete canonical work items with attributable completion evidence.', TRUE),
    (NULL, 'work.approve', 'Approve work', 'Record controlled decisions for approval/review work items.', TRUE),
    (NULL, 'work.manage', 'Manage work', 'Umbrella permission for canonical Work Kernel administration within effective scope.', TRUE)
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
                'work.view', 'work.create', 'work.assign', 'work.progress',
                'work.complete', 'work.approve', 'work.manage'
            )
        )
        OR (
            role.name = 'Member/Professional'
            AND permission.permission_key IN ('work.view', 'work.create', 'work.progress', 'work.complete')
        )
        OR (
            role.name = 'Field Worker'
            AND permission.permission_key IN ('work.view', 'work.progress', 'work.complete')
        )
        OR (
            role.name = 'Finance/Commercial'
            AND permission.permission_key IN ('work.view', 'work.create', 'work.progress', 'work.complete')
        )
        OR (
            role.name = 'Read Only'
            AND permission.permission_key = 'work.view'
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- Existing defect_actions, ncr_actions, safety_actions and work_order_tasks remain
-- authoritative in their domains until explicit migrations link them to work_items.
-- This foundation is additive and deliberately avoids a flag-day rewrite.

-- migrate:down transaction:false
-- Released work/audit/outbox evidence is forward-only. Non-production environments are rebuilt.
SELECT 1;
