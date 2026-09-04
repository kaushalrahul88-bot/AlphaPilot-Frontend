import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export interface OptionPositioningSummary {
  status?: string;
  direction?: string;
  directional_inference?: string;
  counts_for_direction?: boolean;
  sample_bucket_at?: string;
  available_at?: string;
  age_minutes?: number;
  put_call_oi_ratio?: number | null;
  source_table?: string | null;
  first_seen_immutable?: boolean;
  provenance_id?: string | null;
  historical_backfill_used?: boolean;
  mutable_generic_fallback_used?: boolean;
  reason?: string;
  model_registration?: Record<string, unknown>;
}

export interface CrudeMiniOptionExpression {
  status?: string;
  model_id?: string;
  reason?: string;
  underlying?: string;
  action?: string;
  option_type?: string;
  trading_symbol?: string;
  expiry_date?: string;
  strike?: number;
  premium_reference?: number;
  premium_reference_basis?: string;
  lot_size?: number;
  lots?: number;
  quantity?: number;
  estimated_premium_outlay?: number;
  max_capital_rupees?: number;
  sample_bucket_at?: string;
  observed_at?: string;
  collected_at?: string;
  selection_policy?: string;
  point_in_time?: boolean;
  paper_signal_only?: boolean;
  live_execution_enabled?: boolean;
  broker_order_placement_enabled?: boolean;
  capital_committed?: number;
}

export interface CrudeMiniPremiumMemory {
  status?: string;
  model_id?: string;
  underlying_symbol?: string;
  as_of?: string;
  data_type?: string;
  snapshot_count?: number;
  contract_count?: number;
  response_segments?: number;
  trading_days?: number;
  max_segment_gap_minutes?: number;
  first_seen_immutable?: boolean;
  provenance_id?: string;
  storage_note?: string;
  historical_backfill_used?: boolean;
  risk_translation_effect?: string;
  current_mind_effect?: string;
  integrated_v2_effect?: string;
  promotion_eligible?: boolean;
  reason?: string;
}

export interface CrudeMiniEpisodeLedgerSummary {
  status?: string;
  baseline_id?: string;
  protocol_id?: string;
  episode_count?: number;
  action_counts?: Record<string, number>;
  outcome_rows?: number;
  episodes_with_outcomes?: number;
  primary_horizon_minutes?: number;
  primary_geometry?: Record<string, number>;
  primary_diagnosis?: Record<string, number>;
  research_stage?: string;
  current_episode_id?: string;
  current_episode_captured?: boolean;
  new_outcomes_resolved?: number;
  decision_effect?: string;
  promotion_eligible?: boolean;
}

export interface CrudeMiniProspectiveExperienceMemory {
  status?: string;
  model_id?: string;
  baseline_id?: string;
  protocol_id?: string;
  primary_horizon_minutes?: number;
  prior_resolved_cases?: number;
  minimum_ready_cases?: number;
  analogues_used?: number;
  next_stage?: string;
  historical_backfill_used?: boolean;
  current_mind_effect?: string;
  integrated_v2_effect?: string;
  option_expression_effect?: string;
  decision_effect?: string;
  promotion_eligible?: boolean;
  reason?: string;
}

export interface CrudeMiniResearchStatus {
  status: string;
  model_id?: string;
  baseline_id?: string;
  point_in_time_research?: boolean;
  product?: string;
  trade_instrument?: string;
  reason?: string;
  research_protocol?: {
    baseline_id?: string;
    protocol_id?: string;
    status?: string;
    outcome_horizons_minutes?: number[];
    primary_outcome_horizon_minutes?: number;
    paper_signal_only?: boolean;
    live_execution_enabled?: boolean;
    broker_order_placement_enabled?: boolean;
  };
  episode_ledger?: CrudeMiniEpisodeLedgerSummary;
  validation?: {
    primary_resolved_cases?: number;
    primary_non_resolved_cases?: number;
    primary_missed_clean_moves?: number;
    primary_horizon_minutes?: number;
    minimum_ready_cases?: number;
    progress_pct?: number;
    stage?: string;
    descriptive_validation_ready?: boolean;
    improvement_unlocked?: boolean;
    holdout_test_unlocked?: boolean;
    prospective_test_unlocked?: boolean;
    promotion_eligible?: boolean;
  };
  pipeline?: {
    freeze_v1?: string;
    capture?: string;
    observe_outcome?: string;
    diagnose?: string;
    build_memory?: string;
    validate?: string;
    improve?: string;
    holdout_test?: string;
    prospective_test?: string;
    promote?: string;
  };
  historical_backfill_used?: boolean;
  decision_effect?: string;
  promotion_eligible?: boolean;
  execution?: {
    paper_signal_only?: boolean;
    live_execution_enabled?: boolean;
    broker_order_placement_enabled?: boolean;
    capital_committed?: number;
  };
}

export interface CrudeMiniResult {
  status: string;
  click_at: string;
  point_in_time: boolean;
  product?: string;
  trade_instrument?: string;
  reference_contract?: string;
  latest_completed_bar_available_at?: string;
  reason?: string;
  research_protocol?: CrudeMiniResearchStatus['research_protocol'];
  current_mind?: { action?: string; direction?: string | null; reason?: string; evidence_quality?: string; thesis?: string };
  integrated_v2_shadow?: { direction?: string; confidence?: string; thesis_state?: string; supporting_families?: string[]; opposing_families?: string[]; decision_effect?: string };
  data?: {
    candles?: number;
    candle_source?: string;
    option_positioning?: OptionPositioningSummary;
    option_premium_memory?: CrudeMiniPremiumMemory;
    episode_ledger?: CrudeMiniEpisodeLedgerSummary;
    prospective_experience_memory?: CrudeMiniProspectiveExperienceMemory;
    news?: Record<string, unknown>;
    global_context?: Record<string, string>;
    expensive_180_day_live_refetch_used?: boolean;
  };
  market_session?: { status?: string; is_open?: boolean };
  execution?: {
    paper_signal_only?: boolean;
    live_execution_enabled?: boolean;
    broker_order_placement_enabled?: boolean;
    capital_committed?: number;
    option_expression?: CrudeMiniOptionExpression | null;
  };
}

export async function getCrudeMiniResearchStatus(): Promise<CrudeMiniResearchStatus> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/crude-oil-mini/research/status`, {
    method: 'GET', headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`AlphaPilot research API ${response.status}: ${await response.text().catch(() => response.statusText)}`);
  return response.json() as Promise<CrudeMiniResearchStatus>;
}

export async function generateCrudeMiniResult(): Promise<CrudeMiniResult> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/crude-oil-mini/current-mind/click`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!response.ok) throw new Error(`AlphaPilot API ${response.status}: ${await response.text().catch(() => response.statusText)}`);
  return response.json() as Promise<CrudeMiniResult>;
}
