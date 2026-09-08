import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export interface CryptoBtcOutcome {
  status?: string;
  classification?: string;
  realized_direction?: string;
  directional_hit?: boolean | null;
  entry_btc_price?: number;
  terminal_btc_price?: number;
  terminal_return_pct?: number;
  max_up_pct?: number;
  max_down_pct?: number;
  max_abs_move_pct?: number;
  large_move_after_click?: boolean;
  large_move_missed_during_abstention?: boolean;
  performance_eligible?: boolean;
}

export interface CryptoBtcShadowClick {
  request_id?: string;
  decision_at?: string;
  outcome_due_at?: string | null;
  market_direction?: string;
  shadow_status?: string;
  reason?: string;
  decision_btc_price?: number;
  delta_reference_spot_price?: number;
  option?: {
    symbol?: string;
    option_type?: string;
    strike_price?: number;
    entry_ask?: number;
    entry_bid?: number;
    entry_mark?: number;
    expiry_date?: string;
    snapshot_first_seen_at?: string;
    relative_spread_pct?: number;
    open_interest?: number;
    volume?: number;
    delta?: number;
  } | null;
  resolution?: {
    classification?: string;
    resolution_at?: string;
    outcome?: CryptoBtcOutcome | null;
  } | null;
}

export interface CryptoBtcDashboardStatus {
  mode: string;
  status: string;
  research_only?: boolean;
  read_only?: boolean;
  asset?: string;
  trade_instrument?: string;
  collection?: {
    venue?: string;
    candidate_only?: boolean;
    snapshot_count?: number;
    first_snapshot_at?: string | null;
    latest_snapshot_at?: string | null;
    latest?: {
      first_seen_at?: string;
      nearest_expiry?: string;
      reference_spot_price?: number;
      quote_count?: number;
    } | null;
    public_market_data_only?: boolean;
    api_key_required?: boolean;
  };
  prospective_proof?: {
    decision_count?: number;
    directional_decision_count?: number;
    abstention_decision_count?: number;
    pending_resolution_count?: number;
    next_outcome_due_at?: string | null;
    resolved_count?: number;
    directional_hit_count?: number;
    directional_miss_count?: number;
    directional_inconclusive_count?: number;
    abstention_resolved_count?: number;
    abstention_large_move_missed_count?: number;
    directional_accuracy?: number | null;
    evaluation_horizon_hours?: number;
  };
  live_shadow?: {
    click_count?: number;
    options_entry_count?: number;
    no_trade_count?: number;
    proof_input_unresolved_count?: number;
    latest?: CryptoBtcShadowClick | null;
    recent?: CryptoBtcShadowClick[];
  };
  safety?: {
    live_execution_enabled?: boolean;
    broker_order_placement_enabled?: boolean;
    futures_trade_generation_enabled?: boolean;
    capital_committed?: number;
  };
}

export interface CryptoBtcUnderlyingBacktestResult {
  status: string;
  window_start?: string;
  window_end_exclusive?: string;
  scheduled_clicks?: number;
  summary?: {
    decisions?: Record<string, number>;
    outcomes?: Record<string, number>;
    directional_setups?: number;
    resolved_setups?: number;
    target_hits?: number;
    stops?: number;
    setup_win_rate_pct?: number | null;
    total_r?: number | null;
    average_r?: number | null;
    options_profitability_evaluated?: boolean;
  };
}

export interface CryptoBtcLiveShadowActionResult {
  status: string;
  research_only: boolean;
  order_placed: boolean;
  live_execution: boolean;
  capital_committed_inr: number;
  result?: {
    decision_at?: string;
    market_direction?: string;
    shadow_status?: string;
    reason?: string;
    proof_bridge?: { decision_btc_price?: number };
    option_entry?: CryptoBtcShadowClick['option'];
  };
}

export async function getCryptoBtcDashboardStatus(): Promise<CryptoBtcDashboardStatus> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/dashboard/crypto/btc/status`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Crypto BTC dashboard API ${response.status}: ${await response.text().catch(() => response.statusText)}`);
  }
  return response.json() as Promise<CryptoBtcDashboardStatus>;
}

async function postCryptoAction<T>(path: string): Promise<T> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail || `Crypto action failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function runCryptoBtcUnderlyingBacktest(): Promise<CryptoBtcUnderlyingBacktestResult> {
  return postCryptoAction('/v1/dashboard/crypto/btc/actions/first-24h-underlying-backtest');
}

export function generateCryptoBtcLiveShadowSetup(): Promise<CryptoBtcLiveShadowActionResult> {
  return postCryptoAction('/v1/dashboard/crypto/btc/actions/live-shadow-click');
}
