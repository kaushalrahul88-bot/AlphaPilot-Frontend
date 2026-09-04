import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export interface OptionPositioningSummary {
  status?: string;
  direction?: string;
  directional_inference?: string;
  counts_for_direction?: boolean;
  sample_bucket_at?: string;
  age_minutes?: number;
  put_call_oi_ratio?: number | null;
  model_registration?: Record<string, unknown>;
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
  data?: { candles?: number; candle_source?: string; option_positioning?: OptionPositioningSummary; news?: Record<string, unknown>; global_context?: Record<string,string>; expensive_180_day_live_refetch_used?: boolean };
  market_session?: { status?: string; is_open?: boolean };
  execution?: { paper_signal_only?: boolean; live_execution_enabled?: boolean; broker_order_placement_enabled?: boolean; capital_committed?: number };
}

export async function generateCrudeMiniResult(): Promise<CrudeMiniResult> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/crude-oil-mini/current-mind/click`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!response.ok) throw new Error(`AlphaPilot API ${response.status}: ${await response.text().catch(() => response.statusText)}`);
  return response.json() as Promise<CrudeMiniResult>;
}
