export const MARKET_BRAIN_V6_LEDGER_KEY = 'alphapilot:market-brain-v6-ledger.v1';

export type MarketBrainV6Decision =
  | 'INCOMPLETE'
  | 'REPLICATED_DYNAMIC_CONTEXT_CANDIDATE'
  | 'NO_REPLICATED_DYNAMIC_CONTEXT_EFFECT';

export type MarketBrainV6BlockRecord<T> = {
  block_id: string;
  start_date: string;
  end_date: string;
  completed_at: string;
  result: T;
};

export type MarketBrainV6Ledger<T> = {
  schema_version: 1;
  experiment_id: 'MARKET_BRAIN_V6_DYNAMIC_CONTEXT';
  protocol_revision: 'v6-frozen-2026-08-25';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  decision: MarketBrainV6Decision;
  required_replication_blocks: 3;
  block_order: string[];
  blocks: Record<string, MarketBrainV6BlockRecord<T>>;
  last_error: string | null;
};

function available() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function newMarketBrainV6Ledger<T>(blockOrder: string[]): MarketBrainV6Ledger<T> {
  const now = new Date().toISOString();
  return {
    schema_version: 1,
    experiment_id: 'MARKET_BRAIN_V6_DYNAMIC_CONTEXT',
    protocol_revision: 'v6-frozen-2026-08-25',
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

export function readMarketBrainV6Ledger<T>(
  blockOrder: string[],
  validResult: (value: unknown) => value is T,
): MarketBrainV6Ledger<T> {
  if (!available()) return newMarketBrainV6Ledger(blockOrder);
  try {
    const raw = window.localStorage.getItem(MARKET_BRAIN_V6_LEDGER_KEY);
    if (!raw) return newMarketBrainV6Ledger(blockOrder);
    const parsed = JSON.parse(raw) as Partial<MarketBrainV6Ledger<unknown>>;
    if (
      parsed.schema_version !== 1
      || parsed.experiment_id !== 'MARKET_BRAIN_V6_DYNAMIC_CONTEXT'
      || !parsed.blocks
    ) return newMarketBrainV6Ledger(blockOrder);

    const allowed = new Set(blockOrder);
    const blocks: Record<string, MarketBrainV6BlockRecord<T>> = {};
    for (const [id, record] of Object.entries(parsed.blocks)) {
      if (!allowed.has(id) || !record || !validResult(record.result)) continue;
      blocks[id] = record as MarketBrainV6BlockRecord<T>;
    }

    return {
      ...newMarketBrainV6Ledger<T>(blockOrder),
      ...parsed,
      block_order: [...blockOrder],
      blocks,
      decision: parsed.decision ?? 'INCOMPLETE',
      completed_at: parsed.completed_at ?? null,
      last_error: parsed.last_error ?? null,
    } as MarketBrainV6Ledger<T>;
  } catch {
    return newMarketBrainV6Ledger(blockOrder);
  }
}

export function saveMarketBrainV6Ledger<T>(ledger: MarketBrainV6Ledger<T>) {
  if (!available()) return;
  try {
    window.localStorage.setItem(MARKET_BRAIN_V6_LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // A failed browser save must not change the research result itself.
  }
}

export function clearMarketBrainV6Ledger() {
  if (!available()) return;
  try {
    window.localStorage.removeItem(MARKET_BRAIN_V6_LEDGER_KEY);
  } catch {
    // ignore
  }
}

export function exportMarketBrainV6Ledger<T>(ledger: MarketBrainV6Ledger<T>) {
  if (typeof document === 'undefined') return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const blob = new Blob(
    [JSON.stringify({ exported_at:new Date().toISOString(), ledger }, null, 2)],
    { type:'application/json;charset=utf-8' },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `alphapilot-market-brain-v6-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
