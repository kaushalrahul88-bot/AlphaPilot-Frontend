import type { PaperTrade } from '@/lib/paperTradeLifecycleApi';

export const PAPER_TRADE_LIFECYCLE_KEY = 'alphapilot:paper-trade-lifecycle.v1';
export const PAPER_TRADE_LIFECYCLE_EVENT = 'alphapilot:paper-trade-lifecycle-updated';
const MAX_RECORDS = 200;

export type PaperTradeRiskInputs = {
  open_positions: {
    symbol: string;
    correlation_group: string;
    risk_rupees: number;
    current_value_rupees: number;
  }[];
  closed_trades: { pnl_rupees: number; closed_at: string }[];
};

export type PaperTradeEvidence = {
  paper_trades: number;
  clean_paper_sessions: number;
  expectancy_r: number;
  profit_factor: number;
  max_drawdown_r: number;
};

function available() {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
}

export function isPaperTrade(value: unknown): value is PaperTrade {
  if (!value || typeof value !== 'object') return false;
  const trade = value as Partial<PaperTrade>;
  return trade.schema_version === 1
    && typeof trade.trade_id === 'string'
    && (trade.status === 'OPEN' || trade.status === 'CLOSED')
    && trade.paper_only === true
    && trade.live_execution_enabled === false
    && trade.order_endpoint_called === false
    && typeof trade.symbol === 'string'
    && typeof trade.expiry === 'string'
    && typeof trade.strike === 'number'
    && Number.isFinite(trade.strike)
    && (trade.option_type === 'CE' || trade.option_type === 'PE')
    && typeof trade.quantity === 'number'
    && Number.isFinite(trade.quantity)
    && typeof trade.initial_risk_rupees === 'number'
    && Number.isFinite(trade.initial_risk_rupees)
    && typeof trade.opened_at === 'string'
    && typeof trade.last_observed_at === 'string';
}

export function readPaperTrades(): PaperTrade[] {
  if (!available()) return [];
  try {
    const raw = window.localStorage.getItem(PAPER_TRADE_LIFECYCLE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isPaperTrade).slice(0, MAX_RECORDS) : [];
  } catch {
    return [];
  }
}

export function savePaperTrades(trades: PaperTrade[]) {
  if (!available()) return;
  try {
    const ordered = [...trades]
      .sort((a, b) => b.last_observed_at.localeCompare(a.last_observed_at))
      .slice(0, MAX_RECORDS);
    window.localStorage.setItem(PAPER_TRADE_LIFECYCLE_KEY, JSON.stringify(ordered));
    window.dispatchEvent(new CustomEvent(PAPER_TRADE_LIFECYCLE_EVENT));
  } catch {
    // Lifecycle persistence must never change a deterministic risk or mark result.
  }
}

export function upsertPaperTrade(trade: PaperTrade) {
  const existing = readPaperTrades();
  savePaperTrades([trade, ...existing.filter(row => row.trade_id !== trade.trade_id)]);
}

export function paperTradeRiskInputs(trades: PaperTrade[]): PaperTradeRiskInputs {
  return {
    open_positions: trades.filter(row => row.status === 'OPEN').map(row => ({
      symbol: row.symbol + ' ' + String(row.strike) + row.option_type + ' ' + row.expiry,
      correlation_group: row.correlation_group,
      risk_rupees: row.initial_risk_rupees,
      current_value_rupees: row.last_price * row.quantity,
    })),
    closed_trades: trades
      .filter(row => row.status === 'CLOSED' && row.closed_at && row.realized_pnl_rupees !== null)
      .map(row => ({
        pnl_rupees: row.realized_pnl_rupees as number,
        closed_at: row.closed_at as string,
      })),
  };
}

export function paperTradeEvidence(trades: PaperTrade[], cleanPaperSessions = 0): PaperTradeEvidence {
  const closed = trades
    .filter(row => row.status === 'CLOSED' && row.realized_pnl_rupees !== null)
    .sort((a, b) => (a.closed_at ?? '').localeCompare(b.closed_at ?? ''));
  const rValues = closed.map(row => row.r_multiple ?? 0);
  const grossWins = rValues.filter(value => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLosses = Math.abs(rValues.filter(value => value < 0).reduce((sum, value) => sum + value, 0));
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of rValues) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }
  return {
    paper_trades: closed.length,
    clean_paper_sessions: Math.max(0, Math.floor(cleanPaperSessions)),
    expectancy_r: rValues.length ? Number((rValues.reduce((sum, value) => sum + value, 0) / rValues.length).toFixed(3)) : 0,
    profit_factor: grossLosses > 0 ? Number((grossWins / grossLosses).toFixed(3)) : grossWins > 0 ? 99 : 0,
    max_drawdown_r: Number(maxDrawdown.toFixed(3)),
  };
}

export function paperTradeSummary(trades: PaperTrade[]) {
  const closed = trades.filter(row => row.status === 'CLOSED');
  const realized = closed.reduce((sum, row) => sum + (row.realized_pnl_rupees ?? 0), 0);
  const wins = closed.filter(row => (row.realized_pnl_rupees ?? 0) > 0).length;
  return {
    open: trades.filter(row => row.status === 'OPEN').length,
    closed: closed.length,
    realized_pnl_rupees: realized,
    wins,
    losses: closed.filter(row => (row.realized_pnl_rupees ?? 0) < 0).length,
    win_rate: closed.length ? wins / closed.length * 100 : 0,
  };
}
