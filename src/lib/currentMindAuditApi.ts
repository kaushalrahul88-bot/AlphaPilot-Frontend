import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export const CURRENT_MIND_TOKEN_KEY='alphapilot.currentMindInternalToken';

export type ReplayAction='BUY_CE'|'BUY_PE'|'WAIT'|'NO_TRADE'|string;
export interface ReplayOutcome{result?:'TARGET'|'STOP'|'NO_ENTRY'|'SESSION_END'|'INVALID_LEVELS'|string;realized_r?:number;mfe_r?:number;mae_r?:number;entry_at?:string|null;exit_at?:string|null;same_bar_ambiguous?:boolean;future_move_without_setup?:boolean;max_up_pct?:number;max_down_pct?:number;large_move_threshold_pct?:number;[key:string]:unknown}
export interface ReplayDecisionRow{click_timestamp:string;decision:{action?:ReplayAction;reason?:string;direction?:string;playbook?:string;evidence_quality?:string;entry_trigger?:string;invalidation?:string;target_or_exit_logic?:string;risk_reward_basis?:string;missing_context?:string[];contradictions?:string[];replay_levels?:{entry?:number;stop?:number;target?:number};risk_review?:{risk_points?:number;reward_points?:number;reward_risk?:number;status?:string;reason?:string};[key:string]:unknown};outcome?:ReplayOutcome;regime?:Record<string,unknown>;evidence?:{contradictory_lanes?:string[];independent_bullish_lanes?:string[];independent_bearish_lanes?:string[];[key:string]:unknown};[key:string]:unknown}
export interface CurrentMindReplay{mode:string;current_mind_frozen:boolean;reference_contract:string;candles:number;complete_sessions:number;complete_session_dates:string[];excluded_partial_sessions:string[];scheduled_clicks:number;evaluated_clicks:number;click_coverage_exact?:boolean;actions:Record<string,number>;trades:number;resolved_trades:number;targets:number;stops:number;no_entry:number;session_end:number;expectancy_r_resolved:number|null;missed_large_moves_after_abstention:number;data_context:Record<string,boolean>;guardrails?:string[];contract_metadata?:Record<string,unknown>;decisions:ReplayDecisionRow[];[key:string]:unknown}
export interface ReplayJob{status:'IDLE'|'RUNNING'|'COMPLETED'|'FAILED'|string;result?:CurrentMindReplay|null;error?:string|null;traceback?:string}
export interface DataIntegrityAudit{reference_contract:string;raw_candles:number;clean_candles:number;dropped_by_ohlcv_cleaning:number;duplicate_timestamp_count:number;off_5m_grid_count:number;non_monotonic_pairs:number;negative_volume_rows:number;negative_oi_rows:number;complete_sessions:number;exact_100pct_complete_sessions:number;partial_or_ineligible_sessions:string[];missing_bars_inside_primary_complete_sessions:number;outside_session_bars:number;checks:Record<string,boolean>;certification_scope:Record<string,string>;sessions?:Array<Record<string,unknown>>;[key:string]:unknown}
export interface ProviderParityAudit{provider:string;reference_contract:string;resolved_expiry:string;provider_rows:number;stored_rows:number;shared_rows:number;provider_only_timestamps:number;stored_only_timestamps:number;ohlc_mismatch_count:number;volume_mismatch_count:number;oi_mismatch_count_when_both_present:number;max_abs_ohlc_diff:Record<string,number>;provider_ohlc_digest:string;stored_ohlc_digest:string;checks:Record<string,boolean>;certification_scope:Record<string,string|boolean>;[key:string]:unknown}

function tokenHeader(token:string){return {'X-Collector-Token':token.trim()}}
async function internalRequest<T>(path:string,token:string,init?:RequestInit):Promise<T>{
 if(!token.trim())throw new Error('Enter the internal audit token first.');
 const response=await fetch(`${ALPHAPILOT_API_BASE}${path}`,{...init,headers:{Accept:'application/json','Content-Type':'application/json',...tokenHeader(token),...(init?.headers??{})}});
 if(!response.ok){const detail=await response.text().catch(()=>'');throw new Error(`AlphaPilot audit API ${response.status}: ${detail||response.statusText}`)}
 return response.json() as Promise<T>;
}
export function readCurrentMindToken(){if(typeof window==='undefined')return'';return window.sessionStorage.getItem(CURRENT_MIND_TOKEN_KEY)??''}
export function storeCurrentMindToken(value:string){if(typeof window==='undefined')return;value.trim()?window.sessionStorage.setItem(CURRENT_MIND_TOKEN_KEY,value.trim()):window.sessionStorage.removeItem(CURRENT_MIND_TOKEN_KEY)}
export function getCurrentMindReplayStatus(token:string){return internalRequest<ReplayJob>('/v1/internal/copper/current-mind-20-click-replay/status',token)}
export function startCurrentMindReplay(token:string){return internalRequest<{status:string}>('/v1/internal/copper/current-mind-20-click-replay/start',token,{method:'POST'})}
export function getCurrentMindReplay(token:string){return internalRequest<CurrentMindReplay>('/v1/internal/copper/current-mind-20-click-replay',token)}
export function getCurrentMindDataIntegrity(token:string){return internalRequest<DataIntegrityAudit>('/v1/internal/copper/current-mind-data-integrity',token)}
export function getCurrentMindProviderParity(token:string){return internalRequest<ProviderParityAudit>('/v1/internal/copper/current-mind-provider-parity',token)}
