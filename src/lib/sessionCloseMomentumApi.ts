import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export type SessionCloseVariant = 'OPENING_SIGN' | 'PRE_CLOSE_SIGN' | 'OPENING_PRE_CLOSE_AGREEMENT';

export type SessionCloseSummary = {
  variant: SessionCloseVariant;
  trades: number;
  longs: number;
  shorts: number;
  wins: number;
  losses: number;
  win_rate: number;
  average_r: number;
  total_r: number;
  profit_factor: number;
  ambiguous: number;
  state: 'PROMISING' | 'INSUFFICIENT_OR_WEAK';
};

export type SessionCloseMomentumResult = {
  mode: 'ALPHAPILOT_SESSION_CLOSE_MOMENTUM_V1';
  protocol_revision: string;
  research_only: true;
  production_rules_changed: false;
  paper_trading_permission_changed: false;
  live_execution_enabled: false;
  start_date: string;
  end_date: string;
  symbols: string[];
  sessions: number;
  observations: number;
  summaries: SessionCloseSummary[];
  trades_by_variant: Record<SessionCloseVariant, unknown[]>;
  errors: { symbol: string; error: string }[];
  fixed_protocol: {
    opening_window: string;
    pre_close_signal_cutoff: string;
    entry: string;
    scheduled_exit: string;
    stop_atr: number;
    target_r: number;
    round_trip_cost_bps: number;
    min_block_trades: number;
    average_r: number;
    win_rate: number;
    profit_factor: number;
    replication_blocks_required: number;
  };
  source: {
    paper: string;
    journal: string;
    doi: string;
    adaptation: string;
  };
  limitations: string[];
};

export async function runSessionCloseMomentum(startDate: string, endDate: string): Promise<SessionCloseMomentumResult> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/research/session-close-momentum-v1`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ start_date: startDate, end_date: endDate }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Session-Close Momentum API ${response.status}: ${detail || response.statusText}`);
  }
  return response.json() as Promise<SessionCloseMomentumResult>;
}
