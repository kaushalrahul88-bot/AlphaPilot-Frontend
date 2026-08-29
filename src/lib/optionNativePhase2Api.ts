import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export type Phase2Summary = {
  rank?: number; model?: string; trades?: number; wins?: number; losses?: number; win_rate?: number;
  average_r?: number; total_r?: number; profit_factor?: number|null; max_drawdown_r?: number;
  avg_mfe_r?: number|null; avg_mae_r?: number|null; classification?: string;
  by_regime?: Record<string, Phase2Summary>;
};

export type OptionNativePhase2Response = {
  mode?: string; research_only?: boolean; production_rules_changed?: boolean;
  start_date?: string; end_date?: string; premium_min_risk_reward?: number; round_trip_cost_bps?: number;
  leaderboard?: Phase2Summary[];
  trades_by_model?: Record<string, Array<Record<string, unknown>>>;
  errors?: Array<Record<string, unknown>>;
  limitations?: string[];
};

export async function runOptionNativePhase2(input:{symbols:string[];start_date:string;end_date:string;premium_min_risk_reward?:number;max_trades_per_model?:number;round_trip_cost_bps?:number;}):Promise<OptionNativePhase2Response>{
  const response=await fetch(`${ALPHAPILOT_API_BASE}/v1/research/option-native/phase2`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({...input,symbols:input.symbols.map(x=>x.trim().toUpperCase()).filter(Boolean),premium_min_risk_reward:input.premium_min_risk_reward??1.5,max_trades_per_model:input.max_trades_per_model??30,round_trip_cost_bps:input.round_trip_cost_bps??10})});
  if(!response.ok){const detail=await response.text().catch(()=>'');throw new Error(`AlphaPilot API ${response.status}: ${detail||response.statusText}`)}
  return response.json();
}
