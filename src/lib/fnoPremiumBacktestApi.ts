import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export type PremiumBacktestRequest = {
  symbols: string[];
  start_date: string;
  end_date: string;
  expiry?: string | null;
  min_risk_reward?: number;
  entry_before?: string | null;
  max_trades?: number;
};

export type PremiumBacktestTrade = {
  symbol?: string;
  timestamp?: string;
  action?: string;
  direction?: string;
  mtf_alpha?: number;
  expiry?: string;
  expiry_selection?: string;
  strike?: number;
  option_type?: 'CE'|'PE';
  option_contract?: string;
  option_entry?: number;
  option_stop?: number;
  option_target1?: number;
  option_target2?: number;
  outcome?: string;
  exit_price?: number | null;
  r_multiple?: number | null;
  mfe_r?: number | null;
  mae_r?: number | null;
  [key:string]: unknown;
};

export type PremiumBacktestResponse = {
  mode?: string;
  start_date?: string;
  end_date?: string;
  expiry?: string | null;
  expiry_mode?: 'FIXED'|'AUTO_NEAREST_LISTED'|string;
  expiries_used?: string[];
  summary?: {
    trades?: number;
    wins?: number;
    losses?: number;
    ambiguous?: number;
    win_rate?: number;
    total_r?: number;
    average_r?: number;
    max_drawdown_r?: number;
    [key:string]: unknown;
  };
  trades?: PremiumBacktestTrade[];
  errors?: Array<{symbol?:string;error?:string;stage?:string;[key:string]:unknown}>;
  limitations?: string[];
  [key:string]: unknown;
};

export async function runTruePremiumBacktest(input: PremiumBacktestRequest): Promise<PremiumBacktestResponse> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/fno/backtest/premium`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      expiry: input.expiry || null,
      symbols: input.symbols.map(x => x.trim().toUpperCase()).filter(Boolean),
      min_risk_reward: input.min_risk_reward ?? 1.5,
      entry_before: input.entry_before ?? null,
      max_trades: input.max_trades ?? 20,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AlphaPilot API ${response.status}: ${detail || response.statusText}`);
  }
  return response.json();
}
