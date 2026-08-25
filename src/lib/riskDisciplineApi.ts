import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export type RiskDisciplineMode = 'PAPER' | 'CONTROLLED_LIVE_PREVIEW';

export type RiskDisciplineRequest = {
  mode: RiskDisciplineMode;
  capital_rupees: number;
  proposed_trade: {
    symbol: string;
    option_type: 'CE' | 'PE';
    correlation_group: string;
    entry_price: number;
    stop_price: number;
    target_price: number;
    lot_size: number;
    estimated_cost_rupees: number;
  };
  operational_gates: {
    account_state_verified: boolean;
    executable_nse_session: boolean;
    fresh_intraday_candles: boolean;
    universe_scan_complete: boolean;
    fno_confirmation_complete: boolean;
    quality_checks_complete: boolean;
    liquidity_passed: boolean;
  };
  open_positions: {
    symbol: string;
    correlation_group: string;
    risk_rupees: number;
    current_value_rupees: number;
  }[];
  closed_trades: { pnl_rupees: number; closed_at: string }[];
  controlled_live_evidence: {
    paper_trades: number;
    clean_paper_sessions: number;
    expectancy_r: number;
    profit_factor: number;
    max_drawdown_r: number;
    manual_approval_recorded: boolean;
  };
  policy: {
    max_risk_per_trade_pct: number;
    max_daily_loss_pct: number;
    max_weekly_loss_pct: number;
    max_open_risk_pct: number;
  };
  evaluated_at: string;
};

export type RiskDisciplineResult = {
  schema_version: 1;
  protocol_revision: string;
  evaluated_at: string;
  mode: RiskDisciplineMode;
  decision: 'ALLOW_PAPER' | 'BLOCK';
  final_action: 'PAPER_TRADE_ONLY' | 'NO_TRADE';
  live_execution_enabled: false;
  controlled_live_preview_eligible: boolean;
  blockers: string[];
  position_sizing: {
    symbol: string;
    option_type: 'CE' | 'PE';
    correlation_group: string;
    lot_size: number;
    max_quantity: number;
    max_lots: number;
    evaluated_quantity: number;
    risk_per_unit_rupees: number;
    reward_per_unit_rupees: number;
    position_value_rupees: number;
    potential_loss_rupees: number;
    potential_profit_rupees: number;
    net_risk_reward: number;
  };
  risk_state: {
    daily_pnl_rupees: number;
    weekly_pnl_rupees: number;
    daily_loss_rupees: number;
    weekly_loss_rupees: number;
    consecutive_losses: number;
    max_drawdown_rupees: number;
    max_drawdown_pct: number;
    open_positions: number;
    open_risk_rupees: number;
    open_risk_pct: number;
    correlated_risk_rupees: number;
    gross_exposure_rupees: number;
    cooldown_until: string | null;
  };
  budgets: {
    per_trade_limit_rupees: number;
    available_trade_risk_rupees: number;
    daily_loss_limit_rupees: number;
    weekly_loss_limit_rupees: number;
    open_risk_limit_rupees: number;
    correlated_risk_limit_rupees: number;
    position_value_limit_rupees: number;
    gross_exposure_limit_rupees: number;
  };
  arming_checks: { code: string; passed: boolean; observed: number | boolean; required: string }[];
};

export async function evaluateRiskDiscipline(input: RiskDisciplineRequest): Promise<RiskDisciplineResult> {
  const response = await fetch(\`\${ALPHAPILOT_API_BASE}/v1/risk/discipline/evaluate\`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(\`Risk engine \${response.status}: \${detail || response.statusText}\`);
  }
  return response.json() as Promise<RiskDisciplineResult>;
}
