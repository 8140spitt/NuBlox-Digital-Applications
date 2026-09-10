import type { ColumnType } from 'kysely';

export type Decimal = ColumnType<string, string | number, string | number>;
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U> ? ColumnType<S, I | undefined, U> : ColumnType<T, T | undefined, T>;

export interface CorporateDevelopmentOpportunities {
  created_at: Generated<Date>;
  created_by_member_id: string;
  deal_type: string;
  id: Generated<string>;
  identified_on: Date;
  lifecycle_status: Generated<string>;
  opportunity_code: string;
  organisation_id: string;
  owner_member_id: string;
  performance_evidence_public_id: string | null;
  pipeline_stage: Generated<string>;
  priority: Generated<string>;
  public_id: string;
  source_reference: string | null;
  strategic_rationale: string;
  strategic_thesis: string;
  strategy_kpi_public_id: string | null;
  strategy_objective_public_id: string | null;
  target_decision_date: Date | null;
  target_name: string;
  target_source_domain: string | null;
  target_source_public_id: string | null;
  target_source_record_type: string | null;
  title: string;
  updated_at: Generated<Date>;
}

export interface CorporateDevelopmentOpportunityStageHistory {
  from_stage: string | null;
  id: Generated<string>;
  opportunity_id: string;
  organisation_id: string;
  public_id: string;
  to_stage: string;
  transitioned_at: Generated<Date>;
  transitioned_by_member_id: string;
  transition_reason: string;
}

export interface CorporateDevelopmentValuations {
  approved_at: Date | null;
  approved_by_member_id: string | null;
  created_at: Generated<Date>;
  created_by_member_id: string;
  currency_code: string;
  enterprise_value_base: Decimal | null;
  enterprise_value_high: Decimal | null;
  enterprise_value_low: Decimal | null;
  equity_value_base: Decimal | null;
  equity_value_high: Decimal | null;
  equity_value_low: Decimal | null;
  id: Generated<string>;
  lifecycle_status: Generated<string>;
  opportunity_id: string;
  organisation_id: string;
  primary_method: string;
  public_id: string;
  recommendation: string;
  supersedes_valuation_id: string | null;
  title: string;
  updated_at: Generated<Date>;
  valuation_code: string;
  valuation_date: Date;
  version_number: Generated<number>;
}

export interface CorporateDevelopmentValuationScenarios {
  consideration_value: Decimal | null;
  created_at: Generated<Date>;
  created_by_member_id: string;
  enterprise_value: Decimal | null;
  equity_value: Decimal | null;
  id: Generated<string>;
  narrative: string;
  organisation_id: string;
  probability_percent: Decimal | null;
  public_id: string;
  scenario_code: string;
  scenario_type: string;
  synergy_value: Decimal | null;
  title: string;
  updated_at: Generated<Date>;
  valuation_id: string;
}

export interface CorporateDevelopmentValuationAssumptions {
  assumption_code: string;
  assumption_type: string;
  confidence_percent: Decimal | null;
  created_at: Generated<Date>;
  created_by_member_id: string;
  id: Generated<string>;
  numeric_value: Decimal | null;
  organisation_id: string;
  public_id: string;
  rationale: string;
  source_domain: string | null;
  source_public_id: string | null;
  source_record_type: string | null;
  source_reference: string | null;
  text_value: string | null;
  title: string;
  unit_label: string | null;
  updated_at: Generated<Date>;
  valuation_scenario_id: string;
}

export interface DB {
  corporate_development_opportunities: CorporateDevelopmentOpportunities;
  corporate_development_opportunity_stage_history: CorporateDevelopmentOpportunityStageHistory;
  corporate_development_valuation_assumptions: CorporateDevelopmentValuationAssumptions;
  corporate_development_valuation_scenarios: CorporateDevelopmentValuationScenarios;
  corporate_development_valuations: CorporateDevelopmentValuations;
}
