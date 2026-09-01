export const MARKET_BRAIN_V7_LEDGER_KEY = 'alphapilot:market-brain-v7-ledger.v1';

export type MarketBrainV7Decision =
  | 'INCOMPLETE'
  | 'INSUFFICIENT_HOLDOUT_SAMPLE'
  | 'VALIDATED_CONTINUOUS_REGIME_QUALITY_CANDIDATE'
  | 'NO_VALIDATED_CONTINUOUS_REGIME_QUALITY_EDGE';

export type MarketBrainV7BlockRecord<T> = {
  block_id: string;
  role: 'DEVELOPMENT' | 'HOLDOUT';
  start_date: string;
  end_date: string;
  completed_at: string;
  result: T;
};

export type MarketBrainV7Ledger<T, E extends { decision: MarketBrainV7Decision }> = {
  schema_version: 1;
  experiment_id: 'MARKET_BRAIN_V7_CONTINUOUS_REGIME_QUALITY';
  protocol_revision: 'v7-frozen-2026-08-25';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  decision: MarketBrainV7Decision;
  block_order: string[];
  blocks: Record<string, MarketBrainV7BlockRecord<T>>;
  evaluation: E | null;
  last_error: string | null;
};

function available() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function newMarketBrainV7Ledger<T, E extends { decision: MarketBrainV7Decision }>(blockOrder: string[]): MarketBrainV7Ledger<T, E> {
  const now = new Date().toISOString();
  return {
    schema_version: 1,
    experiment_id: 'MARKET_BRAIN_V7_CONTINUOUS_REGIME_QUALITY',
    protocol_revision: 'v7-frozen-2026-08-25',
    created_at: now,
    updated_at: now,
    completed_at: null,
    decision: 'INCOMPLETE',
    block_order: [...blockOrder],
    blocks: {},
    evaluation: null,
    last_error: null,
  };
}

export function readMarketBrainV7Ledger<T, E extends { decision: MarketBrainV7Decision }>(
  blockOrder: string[],
  validBlock: (value: unknown) => value is T,
  validEvaluation: (value: unknown) => value is E,
): MarketBrainV7Ledger<T, E> {
  if (!available()) return newMarketBrainV7Ledger(blockOrder);
  try {
    const raw = window.localStorage.getItem(MARKET_BRAIN_V7_LEDGER_KEY);
    if (!raw) return newMarketBrainV7Ledger(blockOrder);
    const parsed = JSON.parse(raw) as Partial<MarketBrainV7Ledger<unknown, { decision:MarketBrainV7Decision }>>;
    if (
      parsed.schema_version !== 1
      || parsed.experiment_id !== 'MARKET_BRAIN_V7_CONTINUOUS_REGIME_QUALITY'
      || !parsed.blocks
    ) return newMarketBrainV7Ledger(blockOrder);

    const allowed = new Set(blockOrder);
    const blocks: Record<string, MarketBrainV7BlockRecord<T>> = {};
    for (const [id, record] of Object.entries(parsed.blocks)) {
      if (!allowed.has(id) || !record || !validBlock(record.result)) continue;
      blocks[id] = record as MarketBrainV7BlockRecord<T>;
    }
    const evaluation = validEvaluation(parsed.evaluation) ? parsed.evaluation : null;

    return {
      ...newMarketBrainV7Ledger<T, E>(blockOrder),
      ...parsed,
      block_order: [...blockOrder],
      blocks,
      evaluation,
      decision: evaluation?.decision ?? 'INCOMPLETE',
      completed_at: evaluation ? parsed.completed_at ?? null : null,
      last_error: parsed.last_error ?? null,
    } as MarketBrainV7Ledger<T, E>;
  } catch {
    return newMarketBrainV7Ledger(blockOrder);
  }
}

export function saveMarketBrainV7Ledger<T, E extends { decision: MarketBrainV7Decision }>(ledger: MarketBrainV7Ledger<T, E>) {
  if (!available()) return;
  try {
    window.localStorage.setItem(MARKET_BRAIN_V7_LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // Browser persistence failure must not change the research output.
  }
}

export function clearMarketBrainV7Ledger() {
  if (!available()) return;
  try {
    window.localStorage.removeItem(MARKET_BRAIN_V7_LEDGER_KEY);
  } catch {
    // ignore
  }
}

export function exportMarketBrainV7Ledger<T, E extends { decision: MarketBrainV7Decision }>(ledger: MarketBrainV7Ledger<T, E>) {
  if (typeof document === 'undefined') return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const blob = new Blob(
    [JSON.stringify({ exported_at:new Date().toISOString(), ledger }, null, 2)],
    { type:'application/json;charset=utf-8' },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `alphapilot-market-brain-v7-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
