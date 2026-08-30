export const MARKET_BRAIN_V5_LEDGER_KEY = 'alphapilot:market-brain-v5-ledger.v1';

export type MarketBrainV5Decision =
  | 'INCOMPLETE'
  | 'REPLICATED_ARCHETYPE_CONTEXT_CANDIDATE'
  | 'NO_REPLICATED_ARCHETYPE_CONTEXT_EFFECT';

export type MarketBrainV5BlockRecord<T> = {
  block_id: string;
  start_date: string;
  end_date: string;
  completed_at: string;
  result: T;
};

export type MarketBrainV5Ledger<T> = {
  schema_version: 1;
  experiment_id: 'MARKET_BRAIN_V5_ARCHETYPE_CONTEXT';
  protocol_revision: 'v5-frozen-2026-08-25';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  decision: MarketBrainV5Decision;
  required_replication_blocks: 3;
  block_order: string[];
  blocks: Record<string, MarketBrainV5BlockRecord<T>>;
  last_error: string | null;
};

function available() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function newMarketBrainV5Ledger<T>(blockOrder: string[]): MarketBrainV5Ledger<T> {
  const now = new Date().toISOString();
  return {
    schema_version: 1,
    experiment_id: 'MARKET_BRAIN_V5_ARCHETYPE_CONTEXT',
    protocol_revision: 'v5-frozen-2026-08-25',
    created_at: now,
    updated_at: now,
    completed_at: null,
    decision: 'INCOMPLETE',
    required_replication_blocks: 3,
    block_order: [...blockOrder],
    blocks: {},
    last_error: null,
  };
}

export function readMarketBrainV5Ledger<T>(
  blockOrder: string[],
  validResult: (value: unknown) => value is T,
): MarketBrainV5Ledger<T> {
  if (!available()) return newMarketBrainV5Ledger(blockOrder);
  try {
    const raw = window.localStorage.getItem(MARKET_BRAIN_V5_LEDGER_KEY);
    if (!raw) return newMarketBrainV5Ledger(blockOrder);
    const parsed = JSON.parse(raw) as Partial<MarketBrainV5Ledger<unknown>>;
    if (
      parsed.schema_version !== 1
      || parsed.experiment_id !== 'MARKET_BRAIN_V5_ARCHETYPE_CONTEXT'
      || !parsed.blocks
    ) return newMarketBrainV5Ledger(blockOrder);

    const allowed = new Set(blockOrder);
    const blocks: Record<string, MarketBrainV5BlockRecord<T>> = {};
    for (const [id, record] of Object.entries(parsed.blocks)) {
      if (!allowed.has(id) || !record || !validResult(record.result)) continue;
      blocks[id] = record as MarketBrainV5BlockRecord<T>;
    }

    return {
      ...newMarketBrainV5Ledger<T>(blockOrder),
      ...parsed,
      block_order: [...blockOrder],
      blocks,
      decision: parsed.decision ?? 'INCOMPLETE',
      completed_at: parsed.completed_at ?? null,
      last_error: parsed.last_error ?? null,
    } as MarketBrainV5Ledger<T>;
  } catch {
    return newMarketBrainV5Ledger(blockOrder);
  }
}

export function saveMarketBrainV5Ledger<T>(ledger: MarketBrainV5Ledger<T>) {
  if (!available()) return;
  try {
    window.localStorage.setItem(MARKET_BRAIN_V5_LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // A failed browser save must not change the research result itself.
  }
}

export function clearMarketBrainV5Ledger() {
  if (!available()) return;
  try {
    window.localStorage.removeItem(MARKET_BRAIN_V5_LEDGER_KEY);
  } catch {
    // ignore
  }
}

export function exportMarketBrainV5Ledger<T>(ledger: MarketBrainV5Ledger<T>) {
  if (typeof document === 'undefined') return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const blob = new Blob(
    [JSON.stringify({ exported_at: new Date().toISOString(), ledger }, null, 2)],
    { type: 'application/json;charset=utf-8' },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `alphapilot-market-brain-v5-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
