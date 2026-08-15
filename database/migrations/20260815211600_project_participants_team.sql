-- NuBlox project participant/team administration lifecycle and controlled project roles
-- Reuses Package 001 project_organisations, project_members and role-assignment junctions.
-- migrate:up transaction:false

ALTER TABLE project_organisations
    DROP CHECK ck_project_organisations_status,
    ADD CONSTRAINT ck_project_organisations_status
        CHECK (status IN ('invited', 'active', 'suspended', 'left', 'removed', 'declined'));

INSERT INTO project_role_types (
    role_key,
    name,
    description,
    is_active
)
VALUES
    ('client', 'Client', 'Client or employer-side project participant.', TRUE),
    ('project_administrator', 'Project administrator', 'Project administration and coordination role.', TRUE),
    ('project_manager', 'Project manager', 'Project management and delivery coordination role.', TRUE),
    ('designer', 'Designer', 'Design-team project role.', TRUE),
    ('engineer', 'Engineer', 'Engineering project role.', TRUE),
    ('quantity_surveyor', 'Quantity surveyor / commercial', 'Quantity surveying or commercial project role.', TRUE),
    ('main_contractor', 'Main contractor', 'Main contractor project participant.', TRUE),
    ('subcontractor', 'Subcontractor', 'Subcontractor project participant.', TRUE),
    ('supplier', 'Supplier', 'Supplier project participant.', TRUE),
    ('inspector', 'Inspector', 'Inspection, assurance or certification project role.', TRUE),
    ('facilities_operations', 'Facilities / operations', 'Facilities, operations or asset-management project role.', TRUE),
    ('read_only_participant', 'Read-only participant', 'Contextual project role for a participant that is primarily observational.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- migrate:down transaction:false
-- Participation lifecycle values and controlled role catalogue are forward-only.
-- Non-production environments are rebuilt rather than removing released project history.
SELECT 1;
