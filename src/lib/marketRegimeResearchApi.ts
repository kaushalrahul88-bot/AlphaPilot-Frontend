import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export type RegimeCell={model?:string;regime?:string;permission?:string;trades?:number;wins?:number;win_rate?:number;average_r?:number;total_r?:number;profit_factor?:number|null};
export type MarketRegimeResponse={mode?:string;research_only?:boolean;production_rules_changed?:boolean;definitions_frozen?:boolean;strategy_regime_matrix?:RegimeCell[];strategy_permission_matrix?:RegimeCell[];phase2_leaderboard?:Array<Record<string,unknown>>;trades_by_model?:Record<string,Array<Record<string,unknown>>>;errors?:Array<Record<string,unknown>>;limitations?:string[]};

const RETRY_DELAYS_MS=[0,2000,5000];
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export async function runMarketRegimeResearch(input:{symbols:string[];start_date:string;end_date:string;premium_min_risk_reward?:number;max_trades_per_model?:number;round_trip_cost_bps?:number;}):Promise<MarketRegimeResponse>{
 const body=JSON.stringify({...input,symbols:input.symbols.map(x=>x.trim().toUpperCase()).filter(Boolean),premium_min_risk_reward:input.premium_min_risk_reward??1.5,max_trades_per_model:input.max_trades_per_model??30,round_trip_cost_bps:input.round_trip_cost_bps??10});
 let lastError:unknown;
 for(let attempt=0;attempt<RETRY_DELAYS_MS.length;attempt++){
  if(RETRY_DELAYS_MS[attempt]>0)await sleep(RETRY_DELAYS_MS[attempt]);
  try{
   const response=await fetch(`${ALPHAPILOT_API_BASE}/v1/research/market-regime`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body});
   if(response.ok)return response.json();
   const detail=await response.text().catch(()=>'');
   const error=new Error(`AlphaPilot API ${response.status}: ${detail||response.statusText}`);
   if(response.status===429||(response.status>=400&&response.status<500))throw Object.assign(error,{noRetry:true});
   lastError=error;
  }catch(error:any){
   if(error?.noRetry)throw error;
   lastError=error;
  }
 }
 const message=lastError instanceof Error?lastError.message:'Failed to fetch';
 if(/failed to fetch|networkerror|load failed/i.test(message))throw new Error('Unable to reach AlphaPilot API while Market Brain was running. The request was retried automatically; please run it once more if Render was restarting or temporarily dropped the connection.');
 throw new Error(`${message} (retried ${RETRY_DELAYS_MS.length-1} times)`);
}
