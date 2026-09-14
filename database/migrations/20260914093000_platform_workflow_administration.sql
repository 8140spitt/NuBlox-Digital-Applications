-- NuBlox platform workflow administration foundation.
-- Versioned workflow templates, roles, variables, nodes, participants, links and launch bindings.
-- migrate:up transaction:false

SET NAMES utf8mb4;
SET time_zone = '+00:00';

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'workflow.view', 'View workflow administration', 'View workflow templates, versions, graph definitions and launch bindings.', TRUE),
    (NULL, 'workflow.manage', 'Manage workflow administration', 'Create and amend draft workflow templates, roles, variables, nodes, participants, routing and launch bindings.', TRUE),
    (NULL, 'workflow.publish', 'Publish workflow templates', 'Publish governed workflow-template major versions and activate launch bindings.', TRUE),
    (NULL, 'workflow.monitor', 'Monitor workflow processes', 'View governed workflow executions, work-item state, deadlines and decisions.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

CREATE TABLE workflow_templates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    template_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    version_number INT UNSIGNED NOT NULL DEFAULT 1,
    minor_version_number INT UNSIGNED NOT NULL DEFAULT 1,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    supersedes_workflow_template_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    published_by_member_id BIGINT UNSIGNED NULL,
    published_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_workflow_template_public (organisation_id, public_id),
    UNIQUE KEY uq_workflow_template_version (organisation_id, template_key, version_number),
    KEY ix_workflow_template_status (organisation_id, lifecycle_status, updated_at),
    CONSTRAINT fk_workflow_template_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_workflow_template_supersedes
        FOREIGN KEY (supersedes_workflow_template_id) REFERENCES workflow_templates(id),
    CONSTRAINT fk_workflow_template_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_workflow_template_published_by
        FOREIGN KEY (published_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_workflow_template_status CHECK (lifecycle_status IN ('draft', 'published', 'superseded')),
    CONSTRAINT chk_workflow_template_version CHECK (
        (lifecycle_status = 'draft' AND minor_version_number >= 1)
        OR (lifecycle_status IN ('published', 'superseded') AND minor_version_number = 0)
    )
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE workflow_template_roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    workflow_template_id BIGINT UNSIGNED NOT NULL,
    role_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    label VARCHAR(120) NOT NULL,
    description TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_workflow_role_key (organisation_id, workflow_template_id, role_key),
    CONSTRAINT fk_workflow_role_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_workflow_role_template
        FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE workflow_template_variables (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    workflow_template_id BIGINT UNSIGNED NOT NULL,
    variable_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    variable_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    variable_scope VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'process',
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_read_only BOOLEAN NOT NULL DEFAULT FALSE,
    is_resettable BOOLEAN NOT NULL DEFAULT FALSE,
    default_value JSON NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_workflow_variable_key (organisation_id, workflow_template_id, variable_key),
    CONSTRAINT fk_workflow_variable_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_workflow_variable_template
        FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
    CONSTRAINT chk_workflow_variable_type CHECK (
        variable_type IN ('string', 'number', 'boolean', 'date', 'json', 'object_reference')
    ),
    CONSTRAINT chk_workflow_variable_scope CHECK (variable_scope IN ('process', 'node'))
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE workflow_template_nodes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    workflow_template_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    node_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    label VARCHAR(160) NOT NULL,
    node_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    responsible_role_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NULL,
    completion_rule_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
    completion_count INT UNSIGNED NULL,
    routing_events JSON NULL,
    deadline_minutes INT UNSIGNED NULL,
    deadline_relative_to VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    overdue_action VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    deadline_responsible_role_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NULL,
    deadline_notify_role_keys JSON NULL,
    requires_electronic_signature BOOLEAN NOT NULL DEFAULT FALSE,
    threshold_count INT UNSIGNED NULL,
    subprocess_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NULL,
    service_action_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NULL,
    integration_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NULL,
    timer_minutes INT UNSIGNED NULL,
    synchronize_event_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NULL,
    record_variable_changes BOOLEAN NOT NULL DEFAULT FALSE,
    record_votes BOOLEAN NOT NULL DEFAULT FALSE,
    record_reassignments BOOLEAN NOT NULL DEFAULT FALSE,
    abort_on_error BOOLEAN NOT NULL DEFAULT FALSE,
    abort_parent_on_error BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_workflow_node_public (organisation_id, public_id),
    UNIQUE KEY uq_workflow_node_key (organisation_id, workflow_template_id, node_key),
    KEY ix_workflow_node_order (organisation_id, workflow_template_id, display_order),
    CONSTRAINT fk_workflow_node_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_workflow_node_template
        FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
    CONSTRAINT chk_workflow_node_type CHECK (
        node_type IN (
            'start', 'activity', 'ad_hoc_activity', 'subprocess', 'block', 'and', 'or',
            'threshold', 'conditional', 'notification', 'timer', 'checkpoint', 'service',
            'synchronize', 'integration', 'end'
        )
    ),
    CONSTRAINT chk_workflow_completion_rule CHECK (
        completion_rule_type IS NULL OR completion_rule_type IN ('any', 'all', 'count')
    ),
    CONSTRAINT chk_workflow_deadline_relative CHECK (
        deadline_relative_to IS NULL OR deadline_relative_to IN ('node_start', 'process_start')
    ),
    CONSTRAINT chk_workflow_overdue_action CHECK (
        overdue_action IS NULL OR overdue_action IN ('notify', 'reassign', 'skip', 'complete', 'escalate', 'block')
    )
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE workflow_node_participants (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    workflow_template_id BIGINT UNSIGNED NOT NULL,
    workflow_node_id BIGINT UNSIGNED NOT NULL,
    participant_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    participant_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_workflow_participant (
        organisation_id,
        workflow_node_id,
        participant_type,
        participant_key
    ),
    CONSTRAINT fk_workflow_participant_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_workflow_participant_template
        FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_workflow_participant_node
        FOREIGN KEY (workflow_node_id) REFERENCES workflow_template_nodes(id) ON DELETE CASCADE,
    CONSTRAINT chk_workflow_participant_type CHECK (
        participant_type IN (
            'member', 'team', 'organisation_role', 'lifecycle_role', 'workflow_role', 'actor', 'variable'
        )
    )
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE workflow_template_links (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    workflow_template_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    from_node_id BIGINT UNSIGNED NOT NULL,
    to_node_id BIGINT UNSIGNED NOT NULL,
    event_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NULL,
    condition_json JSON NULL,
    is_loop BOOLEAN NOT NULL DEFAULT FALSE,
    terminate_open_predecessors BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_workflow_link_public (organisation_id, public_id),
    UNIQUE KEY uq_workflow_link_route (
        organisation_id,
        workflow_template_id,
        from_node_id,
        to_node_id,
        event_key
    ),
    KEY ix_workflow_link_order (organisation_id, workflow_template_id, display_order),
    CONSTRAINT fk_workflow_link_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_workflow_link_template
        FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_workflow_link_from_node
        FOREIGN KEY (from_node_id) REFERENCES workflow_template_nodes(id) ON DELETE CASCADE,
    CONSTRAINT fk_workflow_link_to_node
        FOREIGN KEY (to_node_id) REFERENCES workflow_template_nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE workflow_object_bindings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    source_domain VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_type VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    event_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    workflow_template_id BIGINT UNSIGNED NOT NULL,
    bound_by_member_id BIGINT UNSIGNED NOT NULL,
    bound_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_workflow_object_binding (organisation_id, source_domain, source_type, event_key),
    KEY ix_workflow_object_template (organisation_id, workflow_template_id),
    CONSTRAINT fk_workflow_object_binding_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_workflow_object_binding_template
        FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id),
    CONSTRAINT fk_workflow_object_binding_member
        FOREIGN KEY (bound_by_member_id) REFERENCES organisation_members(id)
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

-- Organisation administrators inherit workflow administration authority. Explicit
-- member denies still win at runtime through the central permission service.
INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role_permission.organisation_id, role_permission.organisation_role_id, workflow_permission.id
FROM role_permissions role_permission
JOIN permissions organisation_permission
  ON organisation_permission.id = role_permission.permission_id
 AND organisation_permission.permission_key = 'organisation.manage'
 AND organisation_permission.is_active = TRUE
JOIN permissions workflow_permission
  ON workflow_permission.permission_key IN ('workflow.view', 'workflow.manage', 'workflow.publish', 'workflow.monitor')
 AND workflow_permission.is_active = TRUE;

-- migrate:down transaction:false
DROP TABLE workflow_object_bindings;
DROP TABLE workflow_template_links;
DROP TABLE workflow_node_participants;
DROP TABLE workflow_template_nodes;
DROP TABLE workflow_template_variables;
DROP TABLE workflow_template_roles;
DROP TABLE workflow_templates;

-- Released permission catalogue rows are intentionally retained on rollback.
SELECT 1;
