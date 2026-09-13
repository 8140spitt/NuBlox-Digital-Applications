-- F01 governed parent deletion ownership semantics.
-- Deleting an F01 parent removes records owned by that parent through the digital thread.
-- Cross-functional canonical records are never deleted; nullable evidence references are detached.
-- Governed version snapshots and audit/outbox evidence remain outside these cascades.
-- migrate:up transaction:false

ALTER TABLE strategy_frameworks
    DROP FOREIGN KEY fk_strategy_framework_supersedes,
    ADD CONSTRAINT fk_strategy_framework_supersedes FOREIGN KEY (supersedes_strategy_framework_id) REFERENCES strategy_frameworks(id) ON DELETE CASCADE;

ALTER TABLE strategy_environment_factors
    DROP FOREIGN KEY fk_strategy_environment_factor_framework,
    ADD CONSTRAINT fk_strategy_environment_factor_framework FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id) ON DELETE CASCADE;
ALTER TABLE strategy_options
    DROP FOREIGN KEY fk_strategy_option_framework,
    ADD CONSTRAINT fk_strategy_option_framework FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id) ON DELETE CASCADE;
ALTER TABLE strategy_objectives
    DROP FOREIGN KEY fk_strategy_objective_framework,
    DROP FOREIGN KEY fk_strategy_objective_parent,
    ADD CONSTRAINT fk_strategy_objective_framework FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_objective_parent FOREIGN KEY (parent_strategy_objective_id) REFERENCES strategy_objectives(id) ON DELETE CASCADE;
ALTER TABLE strategy_evidence_items
    DROP FOREIGN KEY fk_strategy_evidence_framework,
    ADD CONSTRAINT fk_strategy_evidence_framework FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id) ON DELETE CASCADE;
ALTER TABLE strategy_assumptions
    DROP FOREIGN KEY fk_strategy_assumption_framework,
    ADD CONSTRAINT fk_strategy_assumption_framework FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id) ON DELETE CASCADE;
ALTER TABLE strategy_themes
    DROP FOREIGN KEY fk_strategy_theme_framework,
    ADD CONSTRAINT fk_strategy_theme_framework FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id) ON DELETE CASCADE;

ALTER TABLE strategy_environment_factor_evidence_links
    DROP FOREIGN KEY fk_strategy_factor_evidence_factor,
    DROP FOREIGN KEY fk_strategy_factor_evidence_evidence,
    ADD CONSTRAINT fk_strategy_factor_evidence_factor FOREIGN KEY (strategy_environment_factor_id) REFERENCES strategy_environment_factors(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_factor_evidence_evidence FOREIGN KEY (strategy_evidence_item_id) REFERENCES strategy_evidence_items(id) ON DELETE CASCADE;
ALTER TABLE strategy_option_factor_links
    DROP FOREIGN KEY fk_strategy_option_factor_option,
    DROP FOREIGN KEY fk_strategy_option_factor_factor,
    ADD CONSTRAINT fk_strategy_option_factor_option FOREIGN KEY (strategy_option_id) REFERENCES strategy_options(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_option_factor_factor FOREIGN KEY (strategy_environment_factor_id) REFERENCES strategy_environment_factors(id) ON DELETE CASCADE;
ALTER TABLE strategy_option_assumption_links
    DROP FOREIGN KEY fk_strategy_option_assumption_option,
    DROP FOREIGN KEY fk_strategy_option_assumption_assumption,
    ADD CONSTRAINT fk_strategy_option_assumption_option FOREIGN KEY (strategy_option_id) REFERENCES strategy_options(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_option_assumption_assumption FOREIGN KEY (strategy_assumption_id) REFERENCES strategy_assumptions(id) ON DELETE CASCADE;
ALTER TABLE strategy_objective_option_links
    DROP FOREIGN KEY fk_strategy_objective_option_objective,
    DROP FOREIGN KEY fk_strategy_objective_option_option,
    ADD CONSTRAINT fk_strategy_objective_option_objective FOREIGN KEY (strategy_objective_id) REFERENCES strategy_objectives(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_objective_option_option FOREIGN KEY (strategy_option_id) REFERENCES strategy_options(id) ON DELETE CASCADE;
ALTER TABLE strategy_objective_theme_links
    DROP FOREIGN KEY fk_strategy_objective_theme_objective,
    DROP FOREIGN KEY fk_strategy_objective_theme_theme,
    ADD CONSTRAINT fk_strategy_objective_theme_objective FOREIGN KEY (strategy_objective_id) REFERENCES strategy_objectives(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_objective_theme_theme FOREIGN KEY (strategy_theme_id) REFERENCES strategy_themes(id) ON DELETE CASCADE;

ALTER TABLE strategy_business_plans
    DROP FOREIGN KEY fk_strategy_business_plan_framework,
    DROP FOREIGN KEY fk_strategy_business_plan_supersedes,
    ADD CONSTRAINT fk_strategy_business_plan_framework FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_business_plan_supersedes FOREIGN KEY (supersedes_business_plan_id) REFERENCES strategy_business_plans(id) ON DELETE CASCADE;
ALTER TABLE strategy_business_plan_objective_links
    DROP FOREIGN KEY fk_strategy_plan_objective_plan,
    DROP FOREIGN KEY fk_strategy_plan_objective_objective,
    ADD CONSTRAINT fk_strategy_plan_objective_plan FOREIGN KEY (strategy_business_plan_id) REFERENCES strategy_business_plans(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_plan_objective_objective FOREIGN KEY (strategy_objective_id) REFERENCES strategy_objectives(id) ON DELETE CASCADE;
ALTER TABLE strategy_initiatives
    DROP FOREIGN KEY fk_strategy_initiative_plan,
    DROP FOREIGN KEY fk_strategy_initiative_objective,
    ADD CONSTRAINT fk_strategy_initiative_plan FOREIGN KEY (strategy_business_plan_id) REFERENCES strategy_business_plans(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_initiative_objective FOREIGN KEY (strategy_objective_id) REFERENCES strategy_objectives(id) ON DELETE CASCADE;
ALTER TABLE strategy_initiative_milestones
    DROP FOREIGN KEY fk_strategy_initiative_milestone_initiative,
    ADD CONSTRAINT fk_strategy_initiative_milestone_initiative FOREIGN KEY (strategy_initiative_id) REFERENCES strategy_initiatives(id) ON DELETE CASCADE;
ALTER TABLE strategy_initiative_dependencies
    DROP FOREIGN KEY fk_strategy_initiative_dependency_initiative,
    DROP FOREIGN KEY fk_strategy_initiative_dependency_depends_on,
    ADD CONSTRAINT fk_strategy_initiative_dependency_initiative FOREIGN KEY (initiative_id) REFERENCES strategy_initiatives(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_initiative_dependency_depends_on FOREIGN KEY (depends_on_initiative_id) REFERENCES strategy_initiatives(id) ON DELETE CASCADE;
ALTER TABLE strategy_operating_model_components
    DROP FOREIGN KEY fk_strategy_operating_model_component_plan,
    DROP FOREIGN KEY fk_strategy_operating_model_component_parent,
    ADD CONSTRAINT fk_strategy_operating_model_component_plan FOREIGN KEY (strategy_business_plan_id) REFERENCES strategy_business_plans(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_operating_model_component_parent FOREIGN KEY (parent_component_id) REFERENCES strategy_operating_model_components(id) ON DELETE CASCADE;
ALTER TABLE strategy_operating_model_accountabilities
    DROP FOREIGN KEY fk_strategy_operating_model_accountability_component,
    ADD CONSTRAINT fk_strategy_operating_model_accountability_component FOREIGN KEY (operating_model_component_id) REFERENCES strategy_operating_model_components(id) ON DELETE CASCADE;
ALTER TABLE strategy_initiative_operating_model_links
    DROP FOREIGN KEY fk_strategy_initiative_operating_model_initiative,
    DROP FOREIGN KEY fk_strategy_initiative_operating_model_component,
    ADD CONSTRAINT fk_strategy_initiative_operating_model_initiative FOREIGN KEY (initiative_id) REFERENCES strategy_initiatives(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_initiative_operating_model_component FOREIGN KEY (operating_model_component_id) REFERENCES strategy_operating_model_components(id) ON DELETE CASCADE;

ALTER TABLE strategy_initiative_resource_requirements
    DROP FOREIGN KEY fk_strategy_resource_requirement_initiative,
    ADD CONSTRAINT fk_strategy_resource_requirement_initiative FOREIGN KEY (strategy_initiative_id) REFERENCES strategy_initiatives(id) ON DELETE CASCADE;
ALTER TABLE strategy_initiative_handoffs
    DROP FOREIGN KEY fk_strategy_initiative_handoff_initiative,
    DROP FOREIGN KEY fk_strategy_initiative_handoff_requirement,
    ADD CONSTRAINT fk_strategy_initiative_handoff_initiative FOREIGN KEY (strategy_initiative_id) REFERENCES strategy_initiatives(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_initiative_handoff_requirement FOREIGN KEY (strategy_resource_requirement_id) REFERENCES strategy_initiative_resource_requirements(id) ON DELETE SET NULL;

ALTER TABLE strategy_kpis
    DROP FOREIGN KEY fk_strategy_kpi_framework,
    DROP FOREIGN KEY fk_strategy_kpi_objective,
    DROP FOREIGN KEY fk_strategy_kpi_supersedes,
    ADD CONSTRAINT fk_strategy_kpi_framework FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_kpi_objective FOREIGN KEY (strategy_objective_id) REFERENCES strategy_objectives(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_kpi_supersedes FOREIGN KEY (supersedes_strategy_kpi_id) REFERENCES strategy_kpis(id) ON DELETE CASCADE;
ALTER TABLE strategy_initiative_kpi_links
    DROP FOREIGN KEY fk_strategy_initiative_kpi_initiative,
    DROP FOREIGN KEY fk_strategy_initiative_kpi_kpi,
    ADD CONSTRAINT fk_strategy_initiative_kpi_initiative FOREIGN KEY (strategy_initiative_id) REFERENCES strategy_initiatives(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_initiative_kpi_kpi FOREIGN KEY (strategy_kpi_id) REFERENCES strategy_kpis(id) ON DELETE CASCADE;
ALTER TABLE strategy_kpi_observations
    DROP FOREIGN KEY fk_strategy_kpi_observation_kpi,
    ADD CONSTRAINT fk_strategy_kpi_observation_kpi FOREIGN KEY (strategy_kpi_id) REFERENCES strategy_kpis(id) ON DELETE CASCADE;
ALTER TABLE strategy_kpi_actions
    DROP FOREIGN KEY fk_strategy_kpi_action_kpi,
    DROP FOREIGN KEY fk_strategy_kpi_action_observation,
    ADD CONSTRAINT fk_strategy_kpi_action_kpi FOREIGN KEY (strategy_kpi_id) REFERENCES strategy_kpis(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_kpi_action_observation FOREIGN KEY (strategy_kpi_observation_id) REFERENCES strategy_kpi_observations(id) ON DELETE SET NULL;

ALTER TABLE strategy_reviews
    DROP FOREIGN KEY fk_strategy_review_framework,
    ADD CONSTRAINT fk_strategy_review_framework FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id) ON DELETE CASCADE;
ALTER TABLE strategy_review_kpis
    DROP FOREIGN KEY fk_strategy_review_kpi_review,
    DROP FOREIGN KEY fk_strategy_review_kpi_kpi,
    DROP FOREIGN KEY fk_strategy_review_kpi_observation,
    ADD CONSTRAINT fk_strategy_review_kpi_review FOREIGN KEY (strategy_review_id) REFERENCES strategy_reviews(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_review_kpi_kpi FOREIGN KEY (strategy_kpi_id) REFERENCES strategy_kpis(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_review_kpi_observation FOREIGN KEY (strategy_kpi_observation_id) REFERENCES strategy_kpi_observations(id) ON DELETE CASCADE;
ALTER TABLE strategy_review_decisions
    DROP FOREIGN KEY fk_strategy_review_decision_review,
    DROP FOREIGN KEY fk_strategy_review_decision_objective,
    DROP FOREIGN KEY fk_strategy_review_decision_initiative,
    DROP FOREIGN KEY fk_strategy_review_decision_kpi,
    ADD CONSTRAINT fk_strategy_review_decision_review FOREIGN KEY (strategy_review_id) REFERENCES strategy_reviews(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_review_decision_objective FOREIGN KEY (strategy_objective_id) REFERENCES strategy_objectives(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_strategy_review_decision_initiative FOREIGN KEY (strategy_initiative_id) REFERENCES strategy_initiatives(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_strategy_review_decision_kpi FOREIGN KEY (strategy_kpi_id) REFERENCES strategy_kpis(id) ON DELETE SET NULL;

ALTER TABLE strategy_scenarios
    DROP FOREIGN KEY fk_strategy_scenario_framework,
    DROP FOREIGN KEY fk_strategy_scenario_supersedes,
    ADD CONSTRAINT fk_strategy_scenario_framework FOREIGN KEY (strategy_framework_id) REFERENCES strategy_frameworks(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_scenario_supersedes FOREIGN KEY (supersedes_strategy_scenario_id) REFERENCES strategy_scenarios(id) ON DELETE CASCADE;
ALTER TABLE strategy_scenario_assumptions
    DROP FOREIGN KEY fk_strategy_scenario_assumption_scenario,
    ADD CONSTRAINT fk_strategy_scenario_assumption_scenario FOREIGN KEY (strategy_scenario_id) REFERENCES strategy_scenarios(id) ON DELETE CASCADE;
ALTER TABLE strategy_scenario_kpi_projections
    DROP FOREIGN KEY fk_strategy_scenario_projection_scenario,
    DROP FOREIGN KEY fk_strategy_scenario_projection_kpi,
    ADD CONSTRAINT fk_strategy_scenario_projection_scenario FOREIGN KEY (strategy_scenario_id) REFERENCES strategy_scenarios(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_strategy_scenario_projection_kpi FOREIGN KEY (strategy_kpi_id) REFERENCES strategy_kpis(id) ON DELETE CASCADE;

-- migrate:down transaction:false
-- Governed deletion ownership is forward-only. Non-production environments are rebuilt.
SELECT 1;
