import { ALPHAPILOT_API_BASE, API_ERROR_EVENT } from '@/lib/alphaPilotApi';
import type { RiskDisciplineRequest, RiskDisciplineResult } from '@/lib/riskDisciplineApi';

export type ExactOptionContract = {
  symbol: string;
  expiry: string;
  strike: number;
  option_type: 'CE' | 'PE';
  lot_size: number;
};

export type PaperTrade = {
  schema_version: 1;
  protocol_revision: string;
  trade_id: string;
  status: 'OPEN' | 'CLOSED';
  paper_only: true;
  live_execution_enabled: false;
  order_endpoint_called: false;
  symbol: string;
  expiry: string;
  strike: number;
  option_type: 'CE' | 'PE';
  lot_size: number;
  quantity: number;
  lots: number;
  correlation_group: string;
  entry_price: number;
  stop_price: number;
  target_price: number;
  estimated_cost_rupees: number;
  initial_risk_rupees: number;
  opened_at: string;
  last_observed_at: string;
  last_price: number;
  min_premium: number;
  max_premium: number;
  mark_sequence: number;
  unrealized_pnl_rupees: number;
  realized_pnl_rupees: number | null;
  exit_price: number | null;
  closed_at: string | null;
  exit_reason: 'STOP' | 'TARGET' | 'MANUAL' | null;
  r_multiple: number | null;
  risk_decision_id: string;
  last_source_id: string;
};

export type PaperTradeOpenResult = {
  schema_version: 1;
  protocol_revision: string;
  status: 'OPENED_PAPER' | 'OPEN_BLOCKED';
  paper_trade: PaperTrade | null;
  risk_decision: RiskDisciplineResult;
  blockers: string[];
  live_execution_enabled: false;
  order_endpoint_called: false;
};

export type PaperTradeMarkResult = {
  schema_version: 1;
  protocol_revision: string;
  status: 'CLOSED_PAPER' | 'MARKED_OPEN' | 'IGNORED_OUT_OF_ORDER' | 'IGNORED_DUPLICATE';
  paper_trade: PaperTrade;
  verified_closed_trade: {
    trade_id: string;
    pnl_rupees: number;
    closed_at: string;
    verified_source: string;
  } | null;
  open_position_risk: {
    symbol: string;
    correlation_group: string;
    risk_rupees: number;
    current_value_rupees: number;
  } | null;
  live_execution_enabled: false;
  order_endpoint_called: false;
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(ALPHAPILOT_API_BASE + path, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const message = 'Paper lifecycle ' + response.status + ': ' + (detail || response.statusText);
    if ((response.status === 429 || response.status >= 500) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(API_ERROR_EVENT, { detail: { path, message, captured_at: new Date().toISOString() } }));
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function openPaperTrade(riskRequest: RiskDisciplineRequest, contract: ExactOptionContract) {
  return postJson<PaperTradeOpenResult>('/v1/paper-trades/open', {
    risk_request: riskRequest,
    contract,
  });
}

export function markPaperTrade(paperTrade: PaperTrade, manualExit = false) {
  return postJson<PaperTradeMarkResult>('/v1/paper-trades/mark', {
    paper_trade: paperTrade,
    manual_exit: manualExit,
  });
}
