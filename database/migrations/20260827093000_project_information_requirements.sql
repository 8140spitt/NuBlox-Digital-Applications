-- NuBlox project information requirements and responsibility matrix
-- Extends the canonical project CDE without creating a parallel document register.
-- migrate:up transaction:false

CREATE TABLE project_information_requirements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    owning_organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    requirement_code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    requirement_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    information_container_type_id SMALLINT UNSIGNED NULL,
    required_purpose_code_id SMALLINT UNSIGNED NULL,
    required_suitability_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    required_by_on DATE NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    approved_by_member_id BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    withdrawn_by_member_id BIGINT UNSIGNED NULL,
    withdrawn_at DATETIME(6) NULL,
    withdrawal_reason TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_project_information_requirements_public (public_id),
    UNIQUE KEY uq_project_information_requirements_code (
        project_id,
        owning_organisation_id,
        requirement_code
    ),
    UNIQUE KEY uq_project_information_requirements_scope (
        id,
        project_id,
        owning_organisation_id
    ),
    KEY idx_project_information_requirements_status (
        project_id,
        owning_organisation_id,
        status,
        required_by_on
    ),

    CONSTRAINT fk_project_information_requirements_project
        FOREIGN KEY (project_id, owning_organisation_id)
        REFERENCES projects (id, owning_organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_project_information_requirements_container_type
        FOREIGN KEY (information_container_type_id)
        REFERENCES information_container_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_project_information_requirements_purpose
        FOREIGN KEY (required_purpose_code_id)
        REFERENCES information_purpose_codes (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_project_information_requirements_creator
        FOREIGN KEY (created_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_project_information_requirements_approver
        FOREIGN KEY (approved_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_project_information_requirements_withdrawer
        FOREIGN KEY (withdrawn_by_member_id, owning_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT ck_project_information_requirements_type
        CHECK (requirement_type IN ('OIR', 'AIR', 'PIR', 'EIR')),
    CONSTRAINT ck_project_information_requirements_status
        CHECK (status IN ('draft', 'approved', 'withdrawn')),
    CONSTRAINT ck_project_information_requirements_approval
        CHECK (
            (status = 'draft' AND approved_by_member_id IS NULL AND approved_at IS NULL)
            OR (
                status IN ('approved', 'withdrawn')
                AND approved_by_member_id IS NOT NULL
                AND approved_at IS NOT NULL
            )
        ),
    CONSTRAINT ck_project_information_requirements_withdrawal
        CHECK (
            (status <> 'withdrawn' AND withdrawn_by_member_id IS NULL AND withdrawn_at IS NULL AND withdrawal_reason IS NULL)
            OR (status = 'withdrawn' AND withdrawn_by_member_id IS NOT NULL AND withdrawn_at IS NOT NULL AND withdrawal_reason IS NOT NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_information_requirement_responsibilities (
    project_information_requirement_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    requirement_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    participant_organisation_id BIGINT UNSIGNED NOT NULL,
    project_role_type_id BIGINT UNSIGNED NOT NULL,
    responsibility_code VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    assigned_by_member_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (
        project_information_requirement_id,
        participant_organisation_id,
        project_role_type_id,
        responsibility_code
    ),
    KEY idx_project_information_requirement_responsibility_role (
        project_id,
        participant_organisation_id,
        project_role_type_id
    ),

    CONSTRAINT fk_project_information_requirement_responsibilities_requirement
        FOREIGN KEY (
            project_information_requirement_id,
            project_id,
            requirement_owner_organisation_id
        )
        REFERENCES project_information_requirements (
            id,
            project_id,
            owning_organisation_id
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT fk_project_information_requirement_responsibilities_project_role
        FOREIGN KEY (
            project_id,
            participant_organisation_id,
            project_role_type_id
        )
        REFERENCES project_organisation_roles (
            project_id,
            participant_organisation_id,
            project_role_type_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_project_information_requirement_responsibilities_assigner
        FOREIGN KEY (assigned_by_member_id, requirement_owner_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT ck_project_information_requirement_responsibility_code
        CHECK (responsibility_code IN ('responsible', 'accountable', 'consulted', 'informed'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE project_information_requirement_containers (
    project_information_requirement_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    requirement_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    information_container_id BIGINT UNSIGNED NOT NULL,
    container_owner_organisation_id BIGINT UNSIGNED NOT NULL,
    link_role VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'fulfilment',
    linked_by_member_id BIGINT UNSIGNED NOT NULL,
    linked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (
        project_information_requirement_id,
        information_container_id,
        container_owner_organisation_id
    ),
    KEY idx_project_information_requirement_containers_container (
        information_container_id,
        project_id,
        container_owner_organisation_id
    ),

    CONSTRAINT fk_project_information_requirement_containers_requirement
        FOREIGN KEY (
            project_information_requirement_id,
            project_id,
            requirement_owner_organisation_id
        )
        REFERENCES project_information_requirements (
            id,
            project_id,
            owning_organisation_id
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT fk_project_information_requirement_containers_container
        FOREIGN KEY (
            information_container_id,
            project_id,
            container_owner_organisation_id
        )
        REFERENCES information_containers (
            id,
            project_id,
            owning_organisation_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_project_information_requirement_containers_linker
        FOREIGN KEY (linked_by_member_id, requirement_owner_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT ck_project_information_requirement_containers_role
        CHECK (link_role IN ('fulfilment'))
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

INSERT INTO permissions (permission_key, name, description, is_active)
VALUES
    ('information.requirement.manage', 'Manage information requirements', 'Create and maintain draft project information requirements.', TRUE),
    ('information.requirement.approve', 'Approve information requirements', 'Approve and withdraw controlled project information requirements.', TRUE),
    ('information.responsibility.manage', 'Manage information responsibility matrix', 'Assign RACI responsibilities to controlled project roles.', TRUE),
    ('information.requirement.link', 'Link information requirement evidence', 'Link project CDE containers as requirement fulfilment evidence.', TRUE)
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
JOIN permissions AS permission
    ON permission.permission_key IN (
        'information.requirement.manage',
        'information.requirement.approve',
        'information.responsibility.manage',
        'information.requirement.link'
    )
WHERE role.name IN ('Owner', 'Administrator', 'Manager');

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
JOIN permissions AS permission
    ON permission.permission_key IN (
        'information.requirement.manage',
        'information.responsibility.manage',
        'information.requirement.link'
    )
WHERE role.name IN ('Member', 'Professional');

-- migrate:down transaction:false
DELETE role_permission
FROM role_permissions AS role_permission
JOIN permissions AS permission ON permission.id = role_permission.permission_id
WHERE permission.permission_key IN (
    'information.requirement.manage',
    'information.requirement.approve',
    'information.responsibility.manage',
    'information.requirement.link'
);

DELETE FROM permissions
WHERE permission_key IN (
    'information.requirement.manage',
    'information.requirement.approve',
    'information.responsibility.manage',
    'information.requirement.link'
);

DROP TABLE IF EXISTS project_information_requirement_containers;
DROP TABLE IF EXISTS project_information_requirement_responsibilities;
DROP TABLE IF EXISTS project_information_requirements;