import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export type ResearchSummary = {
  trades?: number;
  wins?: number;
  losses?: number;
  win_rate?: number;
  total_r?: number;
  average_r?: number;
  max_drawdown_r?: number;
  classification?: 'PASS'|'WATCH'|'FAIL'|string;
};

export type OptionNativeResearchRow = {
  rank?: number;
  strategy?: string;
  raw_summary?: ResearchSummary;
  cost_adjusted_summary?: ResearchSummary;
  by_action?: Record<string, ResearchSummary>;
  candidate_signals_total?: number;
  candidate_signals_selected?: number;
  trades?: Array<Record<string, unknown>>;
};

export type OptionNativeResearchResponse = {
  mode?: string;
  research_only?: boolean;
  production_rules_changed?: boolean;
  start_date?: string;
  end_date?: string;
  symbols?: string[];
  research_target_r?: number;
  premium_min_risk_reward?: number;
  round_trip_cost_bps?: number;
  leaderboard?: OptionNativeResearchRow[];
  errors?: Array<Record<string, unknown>>;
  limitations?: string[];
};

export async function runOptionNativeResearch(input: {
  symbols: string[];
  start_date: string;
  end_date: string;
  research_target_r?: number;
  premium_min_risk_reward?: number;
  max_trades_per_strategy?: number;
  round_trip_cost_bps?: number;
}): Promise<OptionNativeResearchResponse> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/research/option-native`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      symbols: input.symbols.map(x=>x.trim().toUpperCase()).filter(Boolean),
      research_target_r: input.research_target_r ?? 1.0,
      premium_min_risk_reward: input.premium_min_risk_reward ?? 1.5,
      max_trades_per_strategy: input.max_trades_per_strategy ?? 30,
      round_trip_cost_bps: input.round_trip_cost_bps ?? 10,
    }),
  });
  if(!response.ok){
    const detail = await response.text().catch(()=> '');
    throw new Error(`AlphaPilot API ${response.status}: ${detail || response.statusText}`);
  }
  return response.json();
}
