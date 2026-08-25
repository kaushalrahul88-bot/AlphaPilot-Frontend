import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export type EdgeBucket={bucket:string;observations:number;hit_0_5r_pct:number;hit_1_0r_pct:number;hit_1_5r_pct:number;avg_mfe_r:number;avg_mae_r:number};
export type EdgeDiscoveryResponse={mode?:string;research_only?:boolean;production_rules_changed?:boolean;start_date?:string;end_date?:string;symbols?:string[];round_trip_cost_bps?:number;sample_every_bars?:number;baseline?:Record<string,number>;feature_reports?:Record<string,EdgeBucket[]>;observations?:Array<Record<string,unknown>>;errors?:Array<Record<string,unknown>>;limitations?:string[]};

export async function runEdgeDiscovery(input:{symbols:string[];start_date:string;end_date:string;max_observations?:number;round_trip_cost_bps?:number;sample_every_bars?:number;}):Promise<EdgeDiscoveryResponse>{
 const response=await fetch(`${ALPHAPILOT_API_BASE}/v1/research/edge-discovery`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({...input,symbols:input.symbols.map(x=>x.trim().toUpperCase()).filter(Boolean),max_observations:input.max_observations??600,round_trip_cost_bps:input.round_trip_cost_bps??10,sample_every_bars:input.sample_every_bars??3})});
 if(!response.ok){const detail=await response.text().catch(()=>'');throw new Error(`AlphaPilot API ${response.status}: ${detail||response.statusText}`)}
 return response.json();
}
