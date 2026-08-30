import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export type CandidateBStats={trades:number;wins:number;losses:number;win_rate_pct:number;avg_r:number;total_r:number;profit_factor:number;max_drawdown_r:number;max_consecutive_losses:number;avg_mfe_r:number;avg_mae_r:number;t1:number;sl:number;eod:number};
export type CandidateBTrade={symbol:string;date:string;signal_at:string;entry_at?:string;option_type:string;contract?:string;entry:number;stop:number;target:number;exit:number;outcome:string;net_r:number;previous_sample_atr_pct?:number|null;atr_pct?:number|null;regime:string};
export type CandidateBValidatorResponse={mode?:string;research_only?:boolean;production_rules_changed?:boolean;candidate?:Record<string,unknown>;start_date?:string;end_date?:string;symbols?:string[];round_trip_cost_bps?:number;sample_every_bars?:number;summary:CandidateBStats;baseline:CandidateBStats;status:string;trades:CandidateBTrade[];by_symbol?:Array<Record<string,unknown>>;by_date?:Array<Record<string,unknown>>;errors?:Array<Record<string,unknown>>;validation_note?:string};

export async function runCandidateBValidator(input:{symbols:string[];start_date:string;end_date:string;round_trip_cost_bps?:number;sample_every_bars?:number;max_trades?:number;}):Promise<CandidateBValidatorResponse>{
 const response=await fetch(`${ALPHAPILOT_API_BASE}/v1/research/candidate-b-validator`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({...input,symbols:input.symbols.map(x=>x.trim().toUpperCase()).filter(Boolean),round_trip_cost_bps:input.round_trip_cost_bps??10,sample_every_bars:input.sample_every_bars??3,max_trades:input.max_trades??250})});
 if(!response.ok){const detail=await response.text().catch(()=>'');throw new Error(`AlphaPilot API ${response.status}: ${detail||response.statusText}`)}
 return response.json();
}
