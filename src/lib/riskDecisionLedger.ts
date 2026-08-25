import type { RiskDisciplineRequest, RiskDisciplineResult } from '@/lib/riskDisciplineApi';

export const RISK_DECISION_LEDGER_KEY = 'alphapilot:risk-decision-ledger.v1';
export const RISK_DECISION_LEDGER_EVENT = 'alphapilot:risk-decision-ledger-updated';
const MAX_RECORDS = 500;

export type RiskDecisionLedgerRecord = {
  schema_version: 1;
  id: string;
  captured_at: string;
  session_date_ist: string;
  protocol_revision: string;
  mode: RiskDisciplineRequest['mode'];
  symbol: string;
  option_type: 'CE' | 'PE';
  correlation_group: string;
  decision: RiskDisciplineResult['decision'];
  final_action: RiskDisciplineResult['final_action'];
  live_execution_enabled: false;
  controlled_live_preview_eligible: boolean;
  blockers: string[];
  position_sizing: RiskDisciplineResult['position_sizing'];
  risk_state: RiskDisciplineResult['risk_state'];
  budgets: RiskDisciplineResult['budgets'];
  operational_gates: RiskDisciplineRequest['operational_gates'];
  source_counts: {
    open_positions: number;
    closed_trades: number;
  };
};

export type RiskDecisionLedgerSummary = {
  total: number;
  paper_ready: number;
  blocked: number;
  controlled_live_previews: number;
  sessions: number;
  today_total: number;
  latest: RiskDecisionLedgerRecord | null;
  top_blocker: { code: string; count: number } | null;
};

function available() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function sessionDateIst(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find(row => row.type === type)?.value ?? '';
  return part('year') + '-' + part('month') + '-' + part('day');
}

function validRecord(value: unknown): value is RiskDecisionLedgerRecord {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<RiskDecisionLedgerRecord>;
  return row.schema_version === 1
    && typeof row.id === 'string'
    && typeof row.captured_at === 'string'
    && typeof row.session_date_ist === 'string'
    && typeof row.protocol_revision === 'string'
    && (row.mode === 'PAPER' || row.mode === 'CONTROLLED_LIVE_PREVIEW')
    && typeof row.symbol === 'string'
    && (row.option_type === 'CE' || row.option_type === 'PE')
    && (row.decision === 'ALLOW_PAPER' || row.decision === 'BLOCK')
    && (row.final_action === 'PAPER_TRADE_ONLY' || row.final_action === 'NO_TRADE')
    && row.live_execution_enabled === false
    && Array.isArray(row.blockers)
    && Boolean(row.position_sizing)
    && Boolean(row.risk_state)
    && Boolean(row.budgets)
    && Boolean(row.operational_gates)
    && Boolean(row.source_counts);
}

export function readRiskDecisionLedger(): RiskDecisionLedgerRecord[] {
  if (!available()) return [];
  try {
    const raw = window.localStorage.getItem(RISK_DECISION_LEDGER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(validRecord).slice(0, MAX_RECORDS) : [];
  } catch {
    return [];
  }
}

export function saveRiskDecisionLedger(records: RiskDecisionLedgerRecord[]) {
  if (!available()) return;
  try {
    window.localStorage.setItem(RISK_DECISION_LEDGER_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
    window.dispatchEvent(new CustomEvent(RISK_DECISION_LEDGER_EVENT));
  } catch {
    // A storage failure must never alter the deterministic risk decision.
  }
}

export function appendRiskDecisionRecord(request: RiskDisciplineRequest, result: RiskDisciplineResult) {
  const capturedAt = new Date().toISOString();
  const record: RiskDecisionLedgerRecord = {
    schema_version: 1,
    id: capturedAt + '-' + result.position_sizing.symbol + '-' + Math.random().toString(36).slice(2, 8),
    captured_at: capturedAt,
    session_date_ist: sessionDateIst(capturedAt),
    protocol_revision: result.protocol_revision,
    mode: result.mode,
    symbol: result.position_sizing.symbol,
    option_type: result.position_sizing.option_type,
    correlation_group: result.position_sizing.correlation_group,
    decision: result.decision,
    final_action: result.final_action,
    live_execution_enabled: false,
    controlled_live_preview_eligible: result.controlled_live_preview_eligible,
    blockers: [...result.blockers],
    position_sizing: { ...result.position_sizing },
    risk_state: { ...result.risk_state },
    budgets: { ...result.budgets },
    operational_gates: { ...request.operational_gates },
    source_counts: {
      open_positions: request.open_positions.length,
      closed_trades: request.closed_trades.length,
    },
  };
  saveRiskDecisionLedger([record, ...readRiskDecisionLedger()]);
  return record;
}

export function summarizeRiskDecisionLedger(records: RiskDecisionLedgerRecord[]): RiskDecisionLedgerSummary {
  const today = sessionDateIst(new Date());
  const blockerCounts = new Map<string, number>();
  for (const record of records) {
    for (const blocker of record.blockers) {
      blockerCounts.set(blocker, (blockerCounts.get(blocker) ?? 0) + 1);
    }
  }
  const topBlocker = [...blockerCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  return {
    total: records.length,
    paper_ready: records.filter(row => row.final_action === 'PAPER_TRADE_ONLY').length,
    blocked: records.filter(row => row.final_action === 'NO_TRADE').length,
    controlled_live_previews: records.filter(row => row.mode === 'CONTROLLED_LIVE_PREVIEW').length,
    sessions: new Set(records.map(row => row.session_date_ist)).size,
    today_total: records.filter(row => row.session_date_ist === today).length,
    latest: records[0] ?? null,
    top_blocker: topBlocker ? { code: topBlocker[0], count: topBlocker[1] } : null,
  };
}

export function exportRiskDecisionLedger(records: RiskDecisionLedgerRecord[]) {
  if (typeof document === 'undefined') return;
  const payload = {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    record_count: records.length,
    records,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'alphapilot-paper-risk-ledger-' + new Date().toISOString().slice(0, 10) + '.json';
  anchor.click();
  URL.revokeObjectURL(url);
}
