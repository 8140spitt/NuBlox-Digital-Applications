-- F05 Product, Service & Innovation Management — independent access-control permissions
-- migrate:up

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'product_service.view', 'View product, service and innovation management', 'View organisation product/service portfolios, needs, ideas, business cases and lifecycle evidence.', TRUE),
    (NULL, 'product_service.manage', 'Manage product, service and innovation management', 'Create and revise product/service portfolios, needs, ideas, business cases and lifecycle records.', TRUE),
    (NULL, 'product_service.approve', 'Approve product, service and innovation decisions', 'Approve governed product/service business cases, lifecycle gates and retirement decisions.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- migrate:down
SELECT 1;
