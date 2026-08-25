import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export type RoutingMetrics = {
  trades:number;
  wins:number;
  losses:number;
  win_rate:number;
  total_r:number;
  average_r:number;
  gross_profit_r:number;
  gross_loss_r:number;
  profit_factor:number|null;
  profit_factor_unbounded:boolean;
  max_drawdown_r:number;
  unique_symbols:number;
  symbols:string[];
  unique_dates:number;
  unique_months:number;
  by_month:Array<{month:string;trades:number;total_r:number;average_r:number}>;
};

export type RoutingCandidate = {
  route_id:string;
  strategy:string;
  market_regime:string;
  selected_on_development:boolean;
  development_metrics:RoutingMetrics;
  selection_gates:Record<string,boolean>;
};

export type StrategyRegimeRoutingResponse = {
  mode:string;
  protocol_revision:string;
  research_only:boolean;
  production_rules_changed:boolean;
  market_brain_permission_changed:boolean;
  paper_trading_permission_changed:boolean;
  live_execution_enabled:boolean;
  decision:'VALIDATED_STRATEGY_REGIME_ROUTER'|'NO_VALIDATED_STRATEGY_REGIME_ROUTER'|string;
  failed_gates:string[];
  cost_model:{round_trip_cost_bps:number};
  book_knowledge:{
    role:string;
    eligible_grades:string[];
    weak_grade_action:string;
    concepts:string[];
    threshold_ownership:string;
  };
  development:{
    all_matched_metrics:RoutingMetrics;
    book_eligible_metrics:RoutingMetrics;
    rejected_counts:Record<string,number>;
    route_candidates:RoutingCandidate[];
    selected_route_ids:string[];
  };
  holdout:{
    all_matched_metrics:RoutingMetrics;
    book_eligible_metrics:RoutingMetrics;
    routed_metrics:RoutingMetrics;
    rejected_counts:Record<string,number>;
    by_selected_route:Array<{route_id:string;metrics:RoutingMetrics}>;
  };
  acceptance_gates:Record<string,boolean>;
  fixed_acceptance_rules:Record<string,number>;
  source_diagnostics:{
    development:SplitDiagnostics;
    holdout:SplitDiagnostics;
  };
  request:Record<string,unknown>;
  limitations:string[];
};

type SplitDiagnostics = {
  period:{start_date:string;end_date:string};
  option_trade_count:number;
  market_context_observations:number;
  context_match:{
    input_trades:number;
    matched_trades:number;
    match_rate_pct:number;
    context_lag_minutes:number;
    max_context_age_minutes:number;
    unmatched_count:number;
  };
  option_errors:Array<Record<string,unknown>>;
  context_errors:Array<{symbol:string;error:string}>;
};

async function responseDetail(response:Response){
  try{
    const payload=await response.json();
    return payload?.detail?`: ${payload.detail}`:'';
  }catch{return ''}
}

export async function runStrategyRegimeRouting(input:{
  symbols:string[];
  development_start:string;
  development_end:string;
  holdout_start:string;
  holdout_end:string;
  research_target_r?:number;
  premium_min_risk_reward?:number;
  max_trades_per_strategy?:number;
  round_trip_cost_bps?:number;
}):Promise<StrategyRegimeRoutingResponse>{
  const response=await fetch(`${ALPHAPILOT_API_BASE}/v1/research/strategy-regime-routing-v1`,{
    method:'POST',
    headers:{Accept:'application/json','Content-Type':'application/json'},
    body:JSON.stringify({
      ...input,
      symbols:input.symbols.map(symbol=>symbol.trim().toUpperCase()).filter(Boolean),
      research_target_r:input.research_target_r??1.0,
      premium_min_risk_reward:input.premium_min_risk_reward??1.5,
      max_trades_per_strategy:input.max_trades_per_strategy??50,
      round_trip_cost_bps:input.round_trip_cost_bps??10,
    }),
  });
  if(!response.ok){
    throw new Error(`AlphaPilot API ${response.status}${await responseDetail(response)}`);
  }
  return response.json();
}
