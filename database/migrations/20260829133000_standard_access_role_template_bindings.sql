-- Stable NuBlox standard access-role identity and template provenance.
-- Access-role identity remains separate from functional roles, job profiles, careers and positions.

-- migrate:up transaction:false

CREATE TABLE organisation_role_template_bindings (
    organisation_role_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    role_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    template_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    template_version VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (organisation_role_id),
    UNIQUE KEY uq_org_role_template_bindings_org_role_key (organisation_id, role_key),
    KEY idx_org_role_template_bindings_template (template_key, template_version),

    CONSTRAINT fk_org_role_template_bindings_role
        FOREIGN KEY (organisation_role_id, organisation_id)
        REFERENCES organisation_roles (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_org_role_template_bindings_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

INSERT INTO organisation_role_template_bindings (
    organisation_role_id,
    organisation_id,
    role_key,
    template_key,
    template_version
)
SELECT
    role.id,
    role.organisation_id,
    CASE role.name
        WHEN 'Owner' THEN 'owner'
        WHEN 'Administrator' THEN 'administrator'
        WHEN 'Manager' THEN 'manager'
        WHEN 'Finance/Commercial' THEN 'finance-commercial'
        WHEN 'Member/Professional' THEN 'member-professional'
        WHEN 'Field Worker' THEN 'field-worker'
        WHEN 'Read Only' THEN 'read-only'
    END,
    'nublox.standard-access-role',
    NULL
FROM organisation_roles AS role
WHERE role.name IN (
    'Owner',
    'Administrator',
    'Manager',
    'Finance/Commercial',
    'Member/Professional',
    'Field Worker',
    'Read Only'
)
ON DUPLICATE KEY UPDATE
    template_key = VALUES(template_key);

-- migrate:down transaction:false
DROP TABLE organisation_role_template_bindings;
