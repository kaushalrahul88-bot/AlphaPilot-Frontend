import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export type StrategyPremiumReplayRequest = {
  symbols: string[];
  start_date: string;
  end_date: string;
  strategy?: 'VWAP_TREND'|'ORB_30'|'BREAKOUT_20';
  research_target_r?: number;
  premium_min_risk_reward?: number;
  max_trades?: number;
};

export type StrategyPremiumReplayResponse = {
  mode?: string;
  strategy?: string;
  start_date?: string;
  end_date?: string;
  summary?: {trades?:number;wins?:number;losses?:number;win_rate?:number;total_r?:number;average_r?:number;max_drawdown_r?:number;ambiguous?:number};
  trades?: Array<Record<string, unknown>>;
  errors?: Array<Record<string, unknown>>;
  research_errors?: Array<Record<string, unknown>>;
};

export async function runStrategyPremiumReplay(input: StrategyPremiumReplayRequest): Promise<StrategyPremiumReplayResponse> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/research/strategy-premium`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      strategy: input.strategy ?? 'VWAP_TREND',
      research_target_r: input.research_target_r ?? 1.0,
      premium_min_risk_reward: input.premium_min_risk_reward ?? 1.5,
      max_trades: input.max_trades ?? 30,
      symbols: input.symbols.map(x => x.trim().toUpperCase()).filter(Boolean),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AlphaPilot API ${response.status}: ${detail || response.statusText}`);
  }
  return response.json();
}
