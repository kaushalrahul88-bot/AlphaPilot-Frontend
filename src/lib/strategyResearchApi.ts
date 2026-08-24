import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export type StrategyResearchRequest = {
  symbols: string[];
  start_date: string;
  end_date: string;
  target_r?: number;
};

export type StrategyLeaderboardRow = {
  strategy: string;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_r: number;
  average_r: number;
  max_drawdown_r: number;
  ambiguous?: number;
};

export type StrategyResearchTrade = {
  strategy: string;
  symbol: string;
  signal_at: string;
  entry_at?: string;
  direction: 'LONG'|'SHORT'|string;
  action?: string;
  entry?: number;
  stop?: number;
  target?: number;
  outcome?: string;
  r_multiple?: number | null;
  mfe_r?: number;
  mae_r?: number;
  features?: Record<string, unknown>;
};

export type StrategyResearchResponse = {
  mode?: string;
  start_date?: string;
  end_date?: string;
  target_r?: number;
  leaderboard?: StrategyLeaderboardRow[];
  strategies?: Record<string, StrategyResearchTrade[]>;
  strategy_definitions?: Record<string, string>;
  errors?: Array<{symbol?: string; error?: string}>;
  limitations?: string[];
};

export async function runStrategyResearch(input: StrategyResearchRequest): Promise<StrategyResearchResponse> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/research/strategies`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbols: input.symbols.map(x => x.trim().toUpperCase()).filter(Boolean),
      start_date: input.start_date,
      end_date: input.end_date,
      target_r: input.target_r ?? 1.0,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AlphaPilot API ${response.status}: ${detail || response.statusText}`);
  }
  return response.json();
}
