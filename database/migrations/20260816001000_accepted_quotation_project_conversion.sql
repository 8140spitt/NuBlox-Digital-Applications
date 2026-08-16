-- NuBlox accepted quotation to project conversion activation
-- Data/reference-only forward migration over Package 003 conversion structures.
-- migrate:up transaction:false

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
        'commercial.quotation.convert',
        'Convert accepted quotations to projects',
        'Authorise conversion of an accepted issued quotation version into a NuBlox project. Runtime conversion also requires project.create.',
        TRUE
    )
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- No standard-role grant is added here. Owner and Administrator retain compatibility
-- through their existing commercial.manage umbrella and already hold project.create.
-- Finance/Commercial, Manager and custom roles require deliberate cross-domain
-- delegation: commercial.quotation.convert (or commercial.manage) AND project.create.

-- migrate:down transaction:false
-- Released permission catalogue is forward-only.
SELECT 1;
