-- NuBlox project financial control and forecast cash-flow foundation
-- Activates existing commercial reporting/forecast records and adds time-phased forecast cash movement.
-- Current budget, commitment and actual values remain derived from canonical source domains.
-- migrate:up transaction:false

ALTER TABLE commercial_forecasts
    ADD UNIQUE KEY uq_commercial_forecasts_id_project_org (
        id,
        project_id,
        organisation_id
    );

CREATE TABLE commercial_forecast_cash_flow_lines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    commercial_forecast_id BIGINT UNSIGNED NOT NULL,
    project_cost_code_id BIGINT UNSIGNED NULL,
    line_number INT UNSIGNED NOT NULL,
    flow_date DATE NOT NULL,
    direction VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    cash_flow_category VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    commentary VARCHAR(2000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_commercial_forecast_cash_flow_lines_id_org (id, organisation_id),
    UNIQUE KEY uq_commercial_forecast_cash_flow_lines_number (
        organisation_id,
        commercial_forecast_id,
        line_number
    ),
    KEY idx_commercial_forecast_cash_flow_lines_date (
        organisation_id,
        project_id,
        flow_date,
        direction
    ),
    KEY idx_commercial_forecast_cash_flow_lines_cost_code (
        project_cost_code_id,
        project_id,
        organisation_id
    ),

    CONSTRAINT fk_commercial_forecast_cash_flow_lines_forecast
        FOREIGN KEY (commercial_forecast_id, project_id, organisation_id)
        REFERENCES commercial_forecasts (id, project_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_commercial_forecast_cash_flow_lines_cost_code
        FOREIGN KEY (project_cost_code_id, project_id, organisation_id)
        REFERENCES project_cost_codes (id, project_id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_commercial_forecast_cash_flow_lines_number
        CHECK (line_number > 0),
    CONSTRAINT ck_commercial_forecast_cash_flow_lines_direction
        CHECK (direction IN ('inflow', 'outflow')),
    CONSTRAINT ck_commercial_forecast_cash_flow_lines_category
        CHECK (cash_flow_category IN (
            'revenue', 'labour', 'material', 'plant', 'subcontract',
            'professional_fee', 'overhead', 'preliminaries', 'retention',
            'tax', 'contingency', 'other'
        )),
    CONSTRAINT ck_commercial_forecast_cash_flow_lines_amount
        CHECK (amount > 0)
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
        'commercial.forecast.view',
        'View project financial forecasts',
        'View governed project budget, commitment, actual, forecast-at-completion and cash-flow positions within authorised project scope.',
        TRUE
    ),
    (
        NULL,
        'commercial.forecast.manage',
        'Prepare project financial forecasts',
        'Create reporting periods and draft project financial forecasts, including forecast-to-complete judgements.',
        TRUE
    ),
    (
        NULL,
        'commercial.forecast.approve',
        'Approve project financial forecasts',
        'Approve and lock project financial forecast snapshots and control reporting-period lifecycle transitions.',
        TRUE
    ),
    (
        NULL,
        'commercial.cash_flow.manage',
        'Manage project forecast cash flow',
        'Time-phase forecast project inflows and outflows against draft project financial forecasts.',
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
                'commercial.forecast.view',
                'commercial.forecast.manage',
                'commercial.forecast.approve',
                'commercial.cash_flow.manage'
            )
        )
        OR (
            role.name = 'Finance/Commercial'
            AND permission.permission_key IN (
                'commercial.forecast.view',
                'commercial.forecast.manage',
                'commercial.cash_flow.manage'
            )
        )
        OR (
            role.name = 'Read Only'
            AND permission.permission_key = 'commercial.forecast.view'
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
DROP TABLE commercial_forecast_cash_flow_lines;
ALTER TABLE commercial_forecasts
    DROP INDEX uq_commercial_forecasts_id_project_org;
