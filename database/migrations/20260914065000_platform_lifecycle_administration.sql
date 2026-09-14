-- NuBlox platform lifecycle administration foundation.
-- Versioned lifecycle templates, phases, transitions, lifecycle roles, phase-scoped
-- access rules, organisation-role mappings and active object-type bindings.
-- migrate:up transaction:false

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'lifecycle.view', 'View lifecycle administration', 'View lifecycle templates, versions, bindings and phase rules.', TRUE),
    (NULL, 'lifecycle.manage', 'Manage lifecycle administration', 'Create and amend draft lifecycle templates, phases, transitions and lifecycle role mappings.', TRUE),
    (NULL, 'lifecycle.publish', 'Publish lifecycle templates', 'Publish governed lifecycle-template major versions and activate object-type bindings.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

CREATE TABLE lifecycle_templates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    template_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    version_number INT UNSIGNED NOT NULL DEFAULT 1,
    minor_version_number INT UNSIGNED NOT NULL DEFAULT 1,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    object_type VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    mode VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    initial_state VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    supersedes_lifecycle_template_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    published_by_member_id BIGINT UNSIGNED NULL,
    published_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_lifecycle_template_public (organisation_id, public_id),
    UNIQUE KEY uq_lifecycle_template_version (organisation_id, template_key, version_number),
    KEY ix_lifecycle_template_object (organisation_id, object_type, lifecycle_status),
    KEY ix_lifecycle_template_status (organisation_id, lifecycle_status, updated_at),
    CONSTRAINT fk_lifecycle_template_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_lifecycle_template_supersedes
        FOREIGN KEY (supersedes_lifecycle_template_id) REFERENCES lifecycle_templates(id),
    CONSTRAINT fk_lifecycle_template_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_lifecycle_template_published_by
        FOREIGN KEY (published_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_lifecycle_template_mode CHECK (mode IN ('basic', 'advanced')),
    CONSTRAINT chk_lifecycle_template_status CHECK (lifecycle_status IN ('draft', 'published', 'superseded')),
    CONSTRAINT chk_lifecycle_template_version CHECK (
        (lifecycle_status = 'draft' AND minor_version_number >= 1)
        OR (lifecycle_status IN ('published', 'superseded') AND minor_version_number = 0)
    )
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE lifecycle_template_phases (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    lifecycle_template_id BIGINT UNSIGNED NOT NULL,
    phase_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    label VARCHAR(120) NOT NULL,
    display_order INT UNSIGNED NOT NULL DEFAULT 0,
    is_editable BOOLEAN NOT NULL DEFAULT FALSE,
    is_deletable BOOLEAN NOT NULL DEFAULT FALSE,
    is_revisable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_lifecycle_phase_key (organisation_id, lifecycle_template_id, phase_key),
    KEY ix_lifecycle_phase_order (organisation_id, lifecycle_template_id, display_order),
    CONSTRAINT fk_lifecycle_phase_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_lifecycle_phase_template
        FOREIGN KEY (lifecycle_template_id) REFERENCES lifecycle_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE lifecycle_template_roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    lifecycle_template_id BIGINT UNSIGNED NOT NULL,
    role_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    label VARCHAR(120) NOT NULL,
    description TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_lifecycle_role_key (organisation_id, lifecycle_template_id, role_key),
    CONSTRAINT fk_lifecycle_role_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_lifecycle_role_template
        FOREIGN KEY (lifecycle_template_id) REFERENCES lifecycle_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE lifecycle_template_phase_access_rules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    lifecycle_template_id BIGINT UNSIGNED NOT NULL,
    phase_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    role_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    permission_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_lifecycle_phase_access (
        organisation_id,
        lifecycle_template_id,
        phase_key,
        role_key,
        permission_key
    ),
    KEY ix_lifecycle_phase_access_permission (
        organisation_id,
        lifecycle_template_id,
        phase_key,
        permission_key
    ),
    CONSTRAINT fk_lifecycle_phase_access_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_lifecycle_phase_access_template
        FOREIGN KEY (lifecycle_template_id) REFERENCES lifecycle_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE lifecycle_template_transitions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    lifecycle_template_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    from_state VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    to_state VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    label VARCHAR(160) NOT NULL,
    requires_note BOOLEAN NOT NULL DEFAULT FALSE,
    requires_target_reference BOOLEAN NOT NULL DEFAULT FALSE,
    tone VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'default',
    required_permission_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NULL,
    workflow_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_lifecycle_transition_public (organisation_id, public_id),
    UNIQUE KEY uq_lifecycle_transition_pair (
        organisation_id,
        lifecycle_template_id,
        from_state,
        to_state
    ),
    KEY ix_lifecycle_transition_source (organisation_id, lifecycle_template_id, from_state),
    CONSTRAINT fk_lifecycle_transition_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_lifecycle_transition_template
        FOREIGN KEY (lifecycle_template_id) REFERENCES lifecycle_templates(id) ON DELETE CASCADE,
    CONSTRAINT chk_lifecycle_transition_tone CHECK (tone IN ('default', 'danger'))
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE lifecycle_role_bindings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    lifecycle_template_id BIGINT UNSIGNED NOT NULL,
    lifecycle_role_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    organisation_role_id BIGINT UNSIGNED NOT NULL,
    bound_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_lifecycle_role_binding (
        organisation_id,
        lifecycle_template_id,
        lifecycle_role_key,
        organisation_role_id
    ),
    KEY ix_lifecycle_role_binding_role (organisation_id, organisation_role_id),
    CONSTRAINT fk_lifecycle_role_binding_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_lifecycle_role_binding_template
        FOREIGN KEY (lifecycle_template_id) REFERENCES lifecycle_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_lifecycle_role_binding_org_role
        FOREIGN KEY (organisation_role_id) REFERENCES organisation_roles(id),
    CONSTRAINT fk_lifecycle_role_binding_member
        FOREIGN KEY (bound_by_member_id) REFERENCES organisation_members(id)
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE lifecycle_object_bindings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    object_type VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    lifecycle_template_id BIGINT UNSIGNED NOT NULL,
    bound_by_member_id BIGINT UNSIGNED NOT NULL,
    bound_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_lifecycle_object_binding (organisation_id, object_type),
    KEY ix_lifecycle_object_template (organisation_id, lifecycle_template_id),
    CONSTRAINT fk_lifecycle_object_binding_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_lifecycle_object_binding_template
        FOREIGN KEY (lifecycle_template_id) REFERENCES lifecycle_templates(id),
    CONSTRAINT fk_lifecycle_object_binding_member
        FOREIGN KEY (bound_by_member_id) REFERENCES organisation_members(id)
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

-- Organisation administrators inherit lifecycle administration authority. Explicit
-- member denies still win at runtime through the central permission service.
INSERT IGNORE INTO role_permissions (organisation_id, organisation_role_id, permission_id)
SELECT role_permission.organisation_id, role_permission.organisation_role_id, lifecycle_permission.id
FROM role_permissions role_permission
JOIN permissions organisation_permission
  ON organisation_permission.id = role_permission.permission_id
 AND organisation_permission.permission_key = 'organisation.manage'
 AND organisation_permission.is_active = TRUE
JOIN permissions lifecycle_permission
  ON lifecycle_permission.permission_key IN ('lifecycle.view', 'lifecycle.manage', 'lifecycle.publish')
 AND lifecycle_permission.is_active = TRUE;

-- migrate:down transaction:false
DROP TABLE lifecycle_object_bindings;
DROP TABLE lifecycle_role_bindings;
DROP TABLE lifecycle_template_transitions;
DROP TABLE lifecycle_template_phase_access_rules;
DROP TABLE lifecycle_template_roles;
DROP TABLE lifecycle_template_phases;
DROP TABLE lifecycle_templates;

-- Released permission catalogue rows are intentionally retained on rollback.
SELECT 1;
