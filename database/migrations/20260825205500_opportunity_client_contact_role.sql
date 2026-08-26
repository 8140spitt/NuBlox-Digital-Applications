-- migrate:up

INSERT INTO opportunity_party_role_types (code, name, is_active)
VALUES ('client_contact', 'Client contact', 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    is_active = VALUES(is_active);

-- migrate:down

DELETE FROM opportunity_party_role_types
WHERE code = 'client_contact';
