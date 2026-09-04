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

export interface CrudeMiniResult {
  status: string;
  click_at: string;
  point_in_time: boolean;
  product?: string;
  trade_instrument?: string;
  reference_contract?: string;
  latest_completed_bar_available_at?: string;
  reason?: string;
  current_mind?: { action?: string; direction?: string | null; reason?: string; evidence_quality?: string; thesis?: string };
  integrated_v2_shadow?: { direction?: string; confidence?: string; thesis_state?: string; supporting_families?: string[]; opposing_families?: string[]; decision_effect?: string };
  data?: {
    candles?: number;
    candle_source?: string;
    option_positioning?: OptionPositioningSummary;
    option_premium_memory?: CrudeMiniPremiumMemory;
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

export async function generateCrudeMiniResult(): Promise<CrudeMiniResult> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/crude-oil-mini/current-mind/click`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!response.ok) throw new Error(`AlphaPilot API ${response.status}: ${await response.text().catch(() => response.statusText)}`);
  return response.json() as Promise<CrudeMiniResult>;
}
