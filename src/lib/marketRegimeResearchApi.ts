import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export type RegimeCell={model?:string;regime?:string;permission?:string;trades?:number;wins?:number;win_rate?:number;average_r?:number;total_r?:number;profit_factor?:number|null};
export type MarketRegimeResponse={mode?:string;research_only?:boolean;production_rules_changed?:boolean;definitions_frozen?:boolean;strategy_regime_matrix?:RegimeCell[];strategy_permission_matrix?:RegimeCell[];phase2_leaderboard?:Array<Record<string,unknown>>;trades_by_model?:Record<string,Array<Record<string,unknown>>>;errors?:Array<Record<string,unknown>>;limitations?:string[]};

export async function runMarketRegimeResearch(input:{symbols:string[];start_date:string;end_date:string;premium_min_risk_reward?:number;max_trades_per_model?:number;round_trip_cost_bps?:number;}):Promise<MarketRegimeResponse>{
 const response=await fetch(`${ALPHAPILOT_API_BASE}/v1/research/market-regime`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({...input,symbols:input.symbols.map(x=>x.trim().toUpperCase()).filter(Boolean),premium_min_risk_reward:input.premium_min_risk_reward??1.5,max_trades_per_model:input.max_trades_per_model??30,round_trip_cost_bps:input.round_trip_cost_bps??10})});
 if(!response.ok){const detail=await response.text().catch(()=>'');throw new Error(`AlphaPilot API ${response.status}: ${detail||response.statusText}`)}
 return response.json();
}
