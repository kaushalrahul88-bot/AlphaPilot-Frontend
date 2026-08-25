import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';
import type { RoutingMetrics } from '@/lib/strategyRegimeRoutingApi';

export type DiagnosticRow = {label:string;metrics:RoutingMetrics};

export type PullbackShortOptionH1Trade = {
  strategy:string;
  symbol:string;
  direction:'SHORT'|string;
  action:'BUY PE'|string;
  signal_at:string;
  entry_at?:string|null;
  underlying_outcome?:string|null;
  underlying_entry?:number|null;
  strike?:number|null;
  expiry_dte?:number|null;
  option_contract?:string|null;
  option_entry?:number|null;
  option_stop?:number|null;
  outcome?:string|null;
  r_multiple?:number|null;
  cost_adjusted_r?:number|null;
  mfe_r?:number|null;
  mae_r?:number|null;
};

export type PullbackShortOptionH1Response = {
  mode:string;
  protocol_revision:string;
  research_only:boolean;
  production_rules_changed:boolean;
  paper_trading_permission_changed:boolean;
  live_execution_enabled:boolean;
  holdout_scored_once:boolean;
  decision:'VALIDATED_PULLBACK_SHORT_OPTION_CANDIDATE'|'NO_VALIDATED_PULLBACK_SHORT_OPTION_EDGE'|'INSUFFICIENT_DATA_FOR_PULLBACK_SHORT_OPTION_H1'|string;
  failed_gates:string[];
  data_quality_status:'COMPLETE'|'INCOMPLETE'|string;
  economic_evaluation_status:'VALID_SAMPLE'|'NOT_EVALUABLE'|string;
  data_quality_gates:Record<string,boolean>;
  economic_gates:Record<string,boolean>;
  acceptance_gates:Record<string,boolean>;
  holdout_metrics:RoutingMetrics&{dates:string[]};
  source_diagnostics:{candidate_signals:number;attempted_option_replays:number;resolved_option_trades:number;option_replay_coverage_pct:number};
  book_diagnostics:DiagnosticRow[];
  market_brain_diagnostics:{
    role:string;
    context_lag_minutes:number;
    market_context_observations:number;
    context_match:{input_trades:number;matched_trades:number;match_rate_pct:number;unmatched_count:number};
    by_regime:DiagnosticRow[];
    errors:Array<{symbol:string;error:string}>;
  };
  request:{symbols:string[];holdout_start:string;holdout_end:string;max_signals:number};
  frozen_candidate:{
    setup_type:string;
    direction:string;
    option_action:string;
    promotion_basis:{development_end:string;all_block_trades:number;all_block_total_r:number;all_block_average_r:number;all_block_win_rate_approx:number;positive_blocks:number;independent_blocks:number};
    signal_rule:string;
    underlying_entry:string;
    option_contract:string;
    option_exit:string;
  };
  cost_model:{round_trip_cost_bps:number};
  book_knowledge:{revision:string;role:string;threshold_ownership:string};
  fixed_acceptance_rules:Record<string,string|number>;
  errors:Array<Record<string,unknown>>;
  limitations:string[];
  trades:PullbackShortOptionH1Trade[];
};

async function responseDetail(response:Response){
  try{const payload=await response.json();return payload?.detail?`: ${payload.detail}`:''}catch{return ''}
}

export async function runPullbackShortOptionH1():Promise<PullbackShortOptionH1Response>{
  const response=await fetch(`${ALPHAPILOT_API_BASE}/v1/research/pullback-short-option-h1`,{
    method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:'{}',
  });
  if(!response.ok)throw new Error(`AlphaPilot API ${response.status}${await responseDetail(response)}`);
  return response.json();
}
