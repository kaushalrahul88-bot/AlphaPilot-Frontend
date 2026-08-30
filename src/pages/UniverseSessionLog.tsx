import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { FNO_SCAN_EVENT, MTF_SCAN_EVENT, type FnoScanResponse, type MtfScanItem, type MtfScanResponse } from '@/lib/alphaPilotApi';
import { actionOf, alphaStrength, executionQualification, optionRiskReward, rankScore } from '@/lib/executionGate';

const STORAGE_KEY = 'alphapilot.universeSessionLog.v1';
const MAX_SESSIONS = 30;
const UNIVERSE_SIZE = 44;
const FAILURE_FALLBACK_MS = 60000;
const LIVE_TIMEFRAMES = ['5m', '15m', '1h'];

type Candidate = { symbol:string; action:string; alpha_strength:number; option_rr:number; open_interest:number; volume:number; capital:number|null; rank_score:number };
type SessionEntry = { id:string; captured_at:string; symbols_evaluated:number; expected_confirmations?:number; execution_ready_count:number; winner:Candidate|null; top3:Candidate[]; blocked_count:number; session_status:string };
type ResultMap = Record<string, FnoScanResponse>;
type MtfEventDetail = { symbols?: string[]; response?: MtfScanResponse; captured_at?: string };

function loadSessions(): SessionEntry[] { if (typeof window === 'undefined') return []; try { const raw=window.localStorage.getItem(STORAGE_KEY); const parsed=raw?JSON.parse(raw):[]; return Array.isArray(parsed)?parsed:[]; } catch { return []; } }

function toCandidate(result:FnoScanResponse):Candidate {
  const option=result.recommended_option??{};
  const capital=Number(option.amount_required_1_lot);
  return {
    symbol:result.symbol,
    action:actionOf(result),
    alpha_strength:alphaStrength(result),
    option_rr:optionRiskReward(result),
    open_interest:Math.max(0,Number(option.open_interest??0)),
    volume:Math.max(0,Number(option.volume??0)),
    capital:Number.isFinite(capital)&&capital>0?capital:null,
    rank_score:rankScore(result),
  };
}

function timeframeDirection(frame:any):'LONG'|'SHORT'|null { const direction=String(frame?.direction??'').toUpperCase(); const signal=String(frame?.raw_signal??frame?.signal??'').toUpperCase(); if(direction==='LONG'||signal.includes('LONG'))return 'LONG'; if(direction==='SHORT'||signal.includes('SHORT'))return 'SHORT'; return null; }
function eligibleForFno(item:MtfScanItem){ if(item.status!=='SETUP')return false; const raw=String(item.direction??item.raw_signal??item.signal??'').toUpperCase(); const direction:'LONG'|'SHORT'=raw.includes('SHORT')?'SHORT':'LONG'; const frames=item.timeframes??{}; const tf15=frames['15m']??{}; const structure15=String(tf15.market_structure??'').toUpperCase(); const rsi=Number(tf15.rsi14); const contradictory=direction==='LONG'?structure15==='DOWNTREND':structure15==='UPTREND'; const exhausted=Number.isFinite(rsi)&&(direction==='LONG'?rsi>=80:rsi<=20); const aligned=LIVE_TIMEFRAMES.map(tf=>timeframeDirection(frames[tf]??{})).filter(v=>v===direction).length; return !contradictory&&!exhausted&&aligned>=2; }

function buildSession(results:ResultMap,expectedConfirmations:number):SessionEntry {
  const rows=Object.values(results);
  const qualified=rows.filter(result=>executionQualification(result).pass).map(toCandidate).sort((a,b)=>b.rank_score-a.rank_score);
  const statuses=rows.map(row=>String(row.market_session?.status??row.market_session?.phase??'UNKNOWN'));
  const sessionStatus=statuses.find(status=>status==='CONTINUOUS'||status==='OPEN')??statuses[0]??'UNKNOWN';
  return { id:`${Date.now()}-${rows.length}-${expectedConfirmations}`, captured_at:new Date().toISOString(), symbols_evaluated:rows.length, expected_confirmations:expectedConfirmations, execution_ready_count:qualified.length, winner:qualified[0]??null, top3:qualified.slice(0,3), blocked_count:rows.length-qualified.length, session_status:sessionStatus };
}

export function UniverseSessionLog(){
  const [sessions,setSessions]=useState<SessionEntry[]>(()=>loadSessions());
  const [open,setOpen]=useState(false);
  const resultsRef=useRef<ResultMap>({});
  const scannedSymbolsRef=useRef<Set<string>>(new Set());
  const expectedSymbolsRef=useRef<Set<string>>(new Set());
  const mtfCompleteRef=useRef(false),activeRef=useRef(false);
  const timerRef=useRef<number|null>(null);

  useEffect(()=>{
    const resetWorking=()=>{resultsRef.current={};scannedSymbolsRef.current=new Set();expectedSymbolsRef.current=new Set();mtfCompleteRef.current=false;activeRef.current=false;if(timerRef.current!=null){window.clearTimeout(timerRef.current);timerRef.current=null;}};
    const saveCurrent=()=>{if(!activeRef.current||!mtfCompleteRef.current)return;const expected=expectedSymbolsRef.current.size;const entry=buildSession(resultsRef.current,expected);setSessions(previous=>{const next=[entry,...previous].slice(0,MAX_SESSIONS);window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));return next;});resetWorking();};
    const scheduleFailureFallback=()=>{if(timerRef.current!=null)window.clearTimeout(timerRef.current);timerRef.current=window.setTimeout(saveCurrent,FAILURE_FALLBACK_MS);};
    const onMtfScan=(event:Event)=>{const detail=(event as CustomEvent<MtfEventDetail>).detail??{};const symbols=Array.isArray(detail.symbols)?detail.symbols:[];const response=detail.response;if(!activeRef.current){resetWorking();activeRef.current=true;}symbols.forEach(symbol=>scannedSymbolsRef.current.add(String(symbol).toUpperCase()));const rows=[...(response?.setups??[]),...(response?.others??[])];rows.filter(eligibleForFno).forEach(row=>expectedSymbolsRef.current.add(String(row.symbol).toUpperCase()));if(scannedSymbolsRef.current.size>=UNIVERSE_SIZE){mtfCompleteRef.current=true;if(expectedSymbolsRef.current.size===0)saveCurrent();}};
    const onScan=(event:Event)=>{if(!activeRef.current||!mtfCompleteRef.current)return;const result=(event as CustomEvent<FnoScanResponse>).detail;if(!result?.symbol)return;const symbol=String(result.symbol).toUpperCase();if(!expectedSymbolsRef.current.has(symbol))return;resultsRef.current={...resultsRef.current,[symbol]:result};if(Object.keys(resultsRef.current).length>=expectedSymbolsRef.current.size)saveCurrent();else scheduleFailureFallback();};
    window.addEventListener(MTF_SCAN_EVENT,onMtfScan);window.addEventListener(FNO_SCAN_EVENT,onScan);return()=>{window.removeEventListener(MTF_SCAN_EVENT,onMtfScan);window.removeEventListener(FNO_SCAN_EVENT,onScan);if(timerRef.current!=null)window.clearTimeout(timerRef.current);};
  },[]);

  const latest=useMemo(()=>sessions.slice(0,8),[sessions]);
  const clear=()=>{window.localStorage.removeItem(STORAGE_KEY);setSessions([]);};

  return <Card><CardHeader title="Universe Scan Session Log" subtitle="Tracks all 44 MTF symbols, derives expected F&O confirmations, and saves each completed universe session using the shared execution gate." action={<div className="flex items-center gap-2">{sessions.length?<Button size="sm" variant="ghost" onClick={clear}>Clear sessions</Button>:null}<Button size="sm" variant="ghost" onClick={()=>setOpen(value=>!value)}>{open?<ChevronUp size={14} className="inline mr-1"/>:<ChevronDown size={14} className="inline mr-1"/>}{open?'Collapse':'Expand'}</Button></div>}/>{open&&<CardBody className="space-y-3">{!sessions.length?<p className="text-sm text-slate-500">No completed universe session saved yet. A record is created when the full 44-symbol MTF pass and its expected F&O confirmations finish.</p>:<><div className="text-xs text-slate-500">{sessions.length} session{sessions.length===1?'':'s'} saved · browser-local storage</div><div className="space-y-2">{latest.map(session=><div key={session.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><div className="flex items-center gap-2 flex-wrap"><b>{formatTime(session.captured_at)}</b><Badge variant={session.execution_ready_count>0?'green':'blue'}>{session.execution_ready_count>0?`${session.execution_ready_count} QUALIFIED`:'NO QUALIFIED TRADE'}</Badge><Badge variant={session.session_status==='CONTINUOUS'||session.session_status==='OPEN'?'green':'red'}>{session.session_status}</Badge></div><p className="text-xs text-slate-500 mt-1">{session.symbols_evaluated}/{session.expected_confirmations??session.symbols_evaluated} expected F&O confirmations received · {session.blocked_count} blocked</p></div><div className="text-right"><p className="text-[10px] text-slate-500">Winner</p><p className="text-sm font-bold">{session.winner?`${session.winner.symbol} ${session.winner.action}`:'NO TRADE'}</p></div></div>{session.top3.length>0&&<div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">{session.top3.map((candidate,index)=><div key={`${session.id}-${candidate.symbol}`} className="rounded-md bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-xs"><p className="font-semibold">#{index+1} {candidate.symbol} · {candidate.action}</p><p className="text-slate-500 mt-1">Rank {candidate.rank_score.toFixed(1)} · Alpha {candidate.alpha_strength.toFixed(1)} · R:R {candidate.option_rr.toFixed(2)}:1</p><p className="text-slate-500">OI {candidate.open_interest.toLocaleString('en-IN')} · Vol {candidate.volume.toLocaleString('en-IN')} · {candidate.capital==null?'Capital —':`₹${candidate.capital.toLocaleString('en-IN',{maximumFractionDigits:0})}`}</p></div>)}</div>}</div>)}</div></>}</CardBody>}</Card>;
}

function formatTime(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return value;return date.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour12:true});}
