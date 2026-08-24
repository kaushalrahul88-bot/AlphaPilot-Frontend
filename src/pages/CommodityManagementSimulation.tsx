import { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { getCommodityCandles, type CommoditySymbol } from '@/lib/commodityApi';

const STORAGE_KEY = 'alphapilot.commodityOutcomes.v1';

type Outcome = 'OPEN' | 'T1 HIT' | 'T2 HIT' | 'SL HIT' | 'AMBIGUOUS';
type Row = {
  id:string; symbol:string; contract?:string; contract_expiry?:string|null; dte_at_entry?:number|null; action:'BUY'|'SELL'; captured_at:string;
  execution_entry?:number; entry:number; stop:number; target1:number; outcome:Outcome; resolved_at?:string|null;
};
type SimResult = { id:string; r:number|null; excluded:boolean };
type ScenarioResult = {
  name:string; samples:number; excluded:number; netR:number; avgR:number; wins:number; losses:number; breakeven:number;
  pairedSamples:number; pairedAvgDeltaR:number; improved:number; worsened:number; unchanged:number;
};
type SegmentSummary = { label:string; sample:number; scenarios:ScenarioResult[] };
type ScenarioMaps = Record<string, SimResult[]>;
type EvidenceGate = { label:'NO CONCLUSION'|'EARLY CANDIDATE'|'REVIEW CANDIDATE'; variant:'default'|'blue'|'green'; reason:string };

function loadRows(): Row[] {
  if (typeof window === 'undefined') return [];
  try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
function candleTime(v:unknown){ if(v==null)return NaN; if(typeof v==='number'||/^\d+$/.test(String(v))){let x=Number(v);if(x>1e12)x/=1000;return x*1000;} return new Date(String(v)).getTime(); }
function entryOf(r:Row){ return Number(r.execution_entry ?? r.entry); }
function riskOf(r:Row){ return Math.abs(entryOf(r)-Number(r.stop)); }
function favPrice(r:Row, multiple:number){ const e=entryOf(r),risk=riskOf(r); return r.action==='BUY'?e+risk*multiple:e-risk*multiple; }
function touches(c:any[],price:number,action:'BUY'|'SELL',kind:'FAV'|'ADV'){ const h=Number(c?.[2]),l=Number(c?.[3]); if(!Number.isFinite(h)||!Number.isFinite(l))return false; if(kind==='FAV')return action==='BUY'?h>=price:l<=price; return action==='BUY'?l<=price:h>=price; }
function closeR(r:Row,c:any[]){ const e=entryOf(r),risk=riskOf(r),close=Number(c?.[4]); if(!Number.isFinite(close)||risk<=0)return null; return r.action==='BUY'?(close-e)/risk:(e-close)/risk; }
function windowCandles(r:Row,candles:any[]){ const s=new Date(r.captured_at).getTime(),e=new Date(r.resolved_at||'').getTime(); return candles.filter(c=>{const t=candleTime(c?.[0]);return Number.isFinite(t)&&t>=s&&t<=e;}); }
function baseline(r:Row):SimResult { const risk=riskOf(r); if(risk<=0)return{id:r.id,r:null,excluded:true}; if(r.outcome==='SL HIT')return{id:r.id,r:-1,excluded:false}; if(r.outcome==='T1 HIT'||r.outcome==='T2 HIT'){const reward=Math.abs(Number(r.target1)-entryOf(r));return{id:r.id,r:reward/risk,excluded:false};} return{id:r.id,r:null,excluded:true}; }
function fullHalfR(r:Row,candles:any[]):SimResult { const cs=windowCandles(r,candles),target=favPrice(r,.5),stop=Number(r.stop); for(const c of cs){const fav=touches(c,target,r.action,'FAV'),adv=touches(c,stop,r.action,'ADV'); if(fav&&adv)return{id:r.id,r:null,excluded:true}; if(fav)return{id:r.id,r:.5,excluded:false}; if(adv)return{id:r.id,r:-1,excluded:false};} return baseline(r); }
function partialHalfR(r:Row,candles:any[]):SimResult { const cs=windowCandles(r,candles); let partial=false; for(const c of cs){const cr=closeR(r,c); if(cr!=null&&cr>=.5){partial=true;break;}} const b=baseline(r); if(b.excluded||b.r==null)return b; return partial?{id:r.id,r:.25+.5*b.r,excluded:false}:b; }
function breakevenAfter(r:Row,candles:any[],threshold:number):SimResult { const cs=windowCandles(r,candles),entry=entryOf(r),t1=Number(r.target1),stop=Number(r.stop); let armed=false; for(let i=0;i<cs.length;i++){const c=cs[i]; if(!armed){const cr=closeR(r,c); if(cr!=null&&cr>=threshold){armed=true; continue;} const hitT1=touches(c,t1,r.action,'FAV'),hitSl=touches(c,stop,r.action,'ADV'); if(hitT1&&hitSl)return{id:r.id,r:null,excluded:true}; if(hitT1)return baseline(r); if(hitSl)return{id:r.id,r:-1,excluded:false}; }
    else { const hitT1=touches(c,t1,r.action,'FAV'),hitBe=touches(c,entry,r.action,'ADV'); if(hitT1&&hitBe)return{id:r.id,r:null,excluded:true}; if(hitT1)return baseline(r); if(hitBe)return{id:r.id,r:0,excluded:false}; }
  } return baseline(r); }
function summarize(name:string,results:SimResult[],baselineResults:SimResult[]):ScenarioResult {
  const usable=results.filter(x=>!x.excluded&&x.r!=null);
  const values=usable.map(x=>Number(x.r));
  const netR=values.reduce((s,x)=>s+x,0);
  const baselineById=new Map(baselineResults.filter(x=>!x.excluded&&x.r!=null).map(x=>[x.id,Number(x.r)]));
  const paired=usable.map(x=>({scenario:Number(x.r),baseline:baselineById.get(x.id)})).filter((x):x is {scenario:number;baseline:number}=>Number.isFinite(x.baseline));
  const deltas=paired.map(x=>x.scenario-x.baseline);
  const eps=1e-9;
  return {
    name,samples:values.length,excluded:results.length-values.length,netR,avgR:values.length?netR/values.length:0,
    wins:values.filter(x=>x>0).length,losses:values.filter(x=>x<0).length,breakeven:values.filter(x=>x===0).length,
    pairedSamples:paired.length,pairedAvgDeltaR:deltas.length?deltas.reduce((s,x)=>s+x,0)/deltas.length:0,
    improved:deltas.filter(x=>x>eps).length,worsened:deltas.filter(x=>x<-eps).length,unchanged:deltas.filter(x=>Math.abs(x)<=eps).length,
  };
}
function quality(n:number){return n>=20?{label:'USABLE SAMPLE',variant:'green' as const}:n>=5?{label:'EARLY SIGNAL',variant:'blue' as const}:{label:'INSUFFICIENT SAMPLE',variant:'default' as const};}
function evidenceGate(s:ScenarioResult):EvidenceGate{
  if(s.pairedSamples>=20&&s.pairedAvgDeltaR>=0.10&&s.improved>s.worsened){return{label:'REVIEW CANDIDATE',variant:'green',reason:`${s.pairedSamples} paired trades, +${s.pairedAvgDeltaR.toFixed(2)}R average improvement, with more improved than worsened trades.`};}
  if(s.pairedSamples>=5&&s.pairedAvgDeltaR>=0.05&&s.improved>s.worsened){return{label:'EARLY CANDIDATE',variant:'blue',reason:`Early positive evidence on ${s.pairedSamples} paired trades (+${s.pairedAvgDeltaR.toFixed(2)}R vs frozen plan). More evidence is required.`};}
  if(s.pairedSamples<5)return{label:'NO CONCLUSION',variant:'default',reason:`Only ${s.pairedSamples} paired trade${s.pairedSamples===1?'':'s'}; at least 5 are required even for an early candidate.`};
  if(s.pairedAvgDeltaR<=0)return{label:'NO CONCLUSION',variant:'default',reason:`Matched average change is ${s.pairedAvgDeltaR.toFixed(2)}R, so the rule has not improved the frozen plan.`};
  return{label:'NO CONCLUSION',variant:'default',reason:`Positive change is not yet strong or consistent enough: ${s.pairedAvgDeltaR>=0?'+':''}${s.pairedAvgDeltaR.toFixed(2)}R, ${s.improved} improved vs ${s.worsened} worsened.`};
}
function selectByIds(results:SimResult[], ids:Set<string>){ return results.filter(x=>ids.has(x.id)); }
function buildScenarioSummary(maps:ScenarioMaps, ids?:Set<string>){
  const base=ids?selectByIds(maps.baseline,ids):maps.baseline;
  const choose=(key:string)=>ids?selectByIds(maps[key],ids):maps[key];
  return [
    summarize('Frozen Plan',base,base),
    summarize('Full Exit at +0.50R',choose('fullHalf'),base),
    summarize('50% at +0.50R, Rest Frozen',choose('partialHalf'),base),
    summarize('BE after 5m Close ≥ +0.50R',choose('beHalf'),base),
    summarize('BE after 5m Close ≥ +1.00R',choose('beOne'),base),
  ];
}
function istHour(value:string){const d=new Date(value);if(Number.isNaN(d.getTime()))return null;const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',hour:'2-digit',hourCycle:'h23'}).formatToParts(d);const h=Number(parts.find(p=>p.type==='hour')?.value);return Number.isFinite(h)?h:null;}
function daysToExpiry(expiry:unknown,at:string){if(expiry==null||expiry==='')return null;const d=new Date(`${String(expiry).slice(0,10)}T23:59:59+05:30`);const t=new Date(at);if(Number.isNaN(d.getTime())||Number.isNaN(t.getTime()))return null;return Math.max(0,Math.ceil((d.getTime()-t.getTime())/86_400_000));}
function dteOf(r:Row){const stored=Number(r.dte_at_entry);return Number.isFinite(stored)?stored:daysToExpiry(r.contract_expiry,r.captured_at);}

export function CommodityManagementSimulation(){
  const[rows,setRows]=useState<Row[]>(()=>loadRows()); const[loading,setLoading]=useState(false); const[scenarios,setScenarios]=useState<ScenarioResult[]>([]); const[segments,setSegments]=useState<SegmentSummary[]>([]); const[sessionSegments,setSessionSegments]=useState<SegmentSummary[]>([]); const[dteSegments,setDteSegments]=useState<SegmentSummary[]>([]); const[skipped,setSkipped]=useState({contractMismatch:0,history:0});
  useEffect(()=>{const f=()=>setRows(loadRows());window.addEventListener('storage',f);const id=window.setInterval(f,30_000);return()=>{window.removeEventListener('storage',f);window.clearInterval(id)}},[]);
  const resolved=useMemo(()=>rows.filter(r=>r.resolved_at&&(r.outcome==='T1 HIT'||r.outcome==='T2 HIT'||r.outcome==='SL HIT')),[rows]);
  const run=async()=>{setLoading(true);try{const symbols=Array.from(new Set(resolved.map(r=>r.symbol).filter(s=>s==='CRUDEOIL'||s==='NATURALGAS'))) as CommoditySymbol[];const feeds=new Map<string,any>();await Promise.all(symbols.map(async s=>{try{feeds.set(s,await getCommodityCandles(s,'5m'))}catch{feeds.set(s,null)}}));let mismatch=0,history=0;const maps:ScenarioMaps={baseline:[],fullHalf:[],partialHalf:[],beHalf:[],beOne:[]};const includedRows:Row[]=[];for(const r of resolved){const feed=feeds.get(r.symbol);if(!feed){history++;continue;}const returned=String(feed?.contract?.trading_symbol??feed?.contract?.groww_symbol??'');if(r.contract&&returned&&r.contract!==returned){mismatch++;continue;}const cs=Array.isArray(feed?.candles)?feed.candles:[];if(!windowCandles(r,cs).length){history++;continue;}includedRows.push(r);maps.baseline.push(baseline(r));maps.fullHalf.push(fullHalfR(r,cs));maps.partialHalf.push(partialHalfR(r,cs));maps.beHalf.push(breakevenAfter(r,cs,.5));maps.beOne.push(breakevenAfter(r,cs,1));}
    setSkipped({contractMismatch:mismatch,history});setScenarios(buildScenarioSummary(maps));
    const defs:[string,(r:Row)=>boolean][]=[
      ['CRUDEOIL',r=>r.symbol==='CRUDEOIL'],['NATURALGAS',r=>r.symbol==='NATURALGAS'],['BUY',r=>r.action==='BUY'],['SELL',r=>r.action==='SELL'],
      ['CRUDEOIL · BUY',r=>r.symbol==='CRUDEOIL'&&r.action==='BUY'],['CRUDEOIL · SELL',r=>r.symbol==='CRUDEOIL'&&r.action==='SELL'],
      ['NATURALGAS · BUY',r=>r.symbol==='NATURALGAS'&&r.action==='BUY'],['NATURALGAS · SELL',r=>r.symbol==='NATURALGAS'&&r.action==='SELL'],
    ];
    const sessionDefs:[string,(r:Row)=>boolean][]=[
      ['09:00–12:59 IST',r=>{const h=istHour(r.captured_at);return h!=null&&h>=9&&h<13}],
      ['13:00–17:59 IST',r=>{const h=istHour(r.captured_at);return h!=null&&h>=13&&h<18}],
      ['18:00–20:59 IST',r=>{const h=istHour(r.captured_at);return h!=null&&h>=18&&h<21}],
      ['21:00–23:30 IST',r=>{const h=istHour(r.captured_at);return h!=null&&h>=21&&h<=23}],
    ];
    const dteDefs:[string,(r:Row)=>boolean][]=[
      ['0–1 DTE',r=>{const d=dteOf(r);return d!=null&&d<=1}],
      ['2–3 DTE',r=>{const d=dteOf(r);return d!=null&&d>=2&&d<=3}],
      ['4+ DTE',r=>{const d=dteOf(r);return d!=null&&d>=4}],
    ];
    const buildSegments=(items:[string,(r:Row)=>boolean][])=>items.map(([label,predicate])=>{const ids=new Set(includedRows.filter(predicate).map(r=>r.id));return{label,sample:ids.size,scenarios:buildScenarioSummary(maps,ids)}});
    setSegments(buildSegments(defs));setSessionSegments(buildSegments(sessionDefs));setDteSegments(buildSegments(dteDefs));
  }finally{setLoading(false)}};
  useEffect(()=>{if(resolved.length)void run();else{setScenarios([]);setSegments([]);setSessionSegments([]);setDteSegments([])}},[resolved.length]);
  const evidence=quality(scenarios[0]?.samples??0);
  const gated=scenarios.slice(1).map(s=>({scenario:s,gate:evidenceGate(s)}));
  return <Card><CardHeader title="Commodity Management Simulation" subtitle="Analytics-only comparison of frozen exits versus simple profit-protection rules on resolved MCX trades." action={<div className="flex gap-2 items-center"><Badge variant={evidence.variant}>{evidence.label}</Badge><Button size="sm" variant="ghost" onClick={()=>void run()} disabled={loading}>{loading?<RefreshCw size={13} className="inline mr-1 animate-spin"/>:<Activity size={13} className="inline mr-1"/>}Refresh</Button></div>}/><CardBody className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-5 gap-2">{scenarios.map((s,index)=><ScenarioCard key={s.name} scenario={s} baseline={index===0}/>)}</div><div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-500"><b>Matched-sample safeguard:</b> the “vs base” figure compares only the same trades that are usable in both that scenario and the Frozen Plan. This prevents a scenario from looking better simply because difficult or ambiguous trades were excluded. Positive paired ΔR means the management rule improved average realised R on those matched trades.</div><div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-500"><b>Simulation rules:</b> breakeven is armed only after a completed 5m candle closes at or beyond +0.50R/+1.00R, then applies from the next candle. The 50% partial scenario also requires a 5m close ≥ +0.50R. A full +0.50R exit uses OHLC touch and excludes candles that touch both +0.50R and SL because intrabar order is unknowable.</div><div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-3"><div><p className="text-sm font-semibold">Minimum-evidence management gate</p><p className="text-xs text-slate-500 mt-1">This gate prevents a small positive ΔR from looking actionable. It never changes the live commodity strategy automatically.</p></div><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{gated.map(({scenario,gate})=><div key={scenario.name} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3"><div className="flex items-center justify-between gap-2"><b className="text-xs">{scenario.name}</b><Badge variant={gate.variant}>{gate.label}</Badge></div><p className="text-[11px] text-slate-500 mt-2">{gate.reason}</p></div>)}</div><p className="text-[11px] text-slate-500"><b>Thresholds:</b> EARLY CANDIDATE requires at least 5 matched trades, ≥ +0.05R average improvement and more improved than worsened trades. REVIEW CANDIDATE requires at least 20 matched trades, ≥ +0.10R improvement and the same consistency condition. “Review” means investigate further—not deploy.</p></div><SegmentSection title="Commodity / direction segmentation" subtitle="Same matched-sample methodology split by commodity and direction." segments={segments}/><SegmentSection title="Session-window segmentation" subtitle="Entry time in IST. Evening is split at 21:00 so late-session management behavior can be reviewed separately from the earlier US-overlap window." segments={sessionSegments}/><SegmentSection title="Days-to-expiry segmentation" subtitle="Uses DTE captured at enrollment; older records fall back to contract expiry and captured timestamp when available." segments={dteSegments}/>{(skipped.contractMismatch>0||skipped.history>0)&&<p className="text-[11px] text-slate-500">Excluded before simulation: {skipped.contractMismatch} rollover-contract mismatch · {skipped.history} insufficient retained 5m history.</p>}<p className="text-xs text-slate-500">No live commodity entry, stop, target or execution gate is changed by this panel. Use it only after enough resolved trades accumulate.</p></CardBody></Card>;
}

function ScenarioCard({scenario:s,baseline=false}:{scenario:ScenarioResult;baseline?:boolean}){const gate=!baseline?evidenceGate(s):null;return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold">{s.name}</p>{!baseline&&<Badge variant={s.pairedAvgDeltaR>0?'green':s.pairedAvgDeltaR<0?'red':'default'}>{s.pairedAvgDeltaR>=0?'+':''}{s.pairedAvgDeltaR.toFixed(2)}R vs base</Badge>}</div><p className="text-lg font-bold mt-1">{s.avgR.toFixed(2)}R</p><p className="text-[11px] text-slate-500">Avg R · Net {s.netR.toFixed(2)}R</p><p className="text-[11px] text-slate-500 mt-1">{s.samples} usable · {s.wins}W / {s.losses}L / {s.breakeven}BE</p>{!baseline&&<p className="text-[11px] text-slate-500 mt-1">Paired {s.pairedSamples}: {s.improved} improved · {s.worsened} worse · {s.unchanged} same</p>}{gate&&<div className="mt-2"><Badge variant={gate.variant}>{gate.label}</Badge></div>}{s.excluded>0&&<p className="text-[11px] text-amber-600 mt-1">{s.excluded} ambiguous/excluded</p>}</div>}
function SegmentSection({title,subtitle,segments}:{title:string;subtitle:string;segments:SegmentSummary[]}){return <div className="space-y-2"><div><p className="text-sm font-semibold">{title}</p><p className="text-xs text-slate-500">{subtitle} Use the sample badge before interpreting any apparent edge.</p></div><div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{segments.map(segment=><SegmentCard key={segment.label} segment={segment}/>)}</div></div>}
function SegmentCard({segment}:{segment:SegmentSummary}){const q=quality(segment.scenarios[0]?.samples??0);return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><div className="flex items-center justify-between gap-2"><b className="text-sm">{segment.label}</b><Badge variant={q.variant}>{q.label}</Badge></div><p className="text-[11px] text-slate-500 mt-1">{segment.sample} retained resolved trade{segment.sample===1?'':'s'}</p><div className="mt-3 space-y-2">{segment.scenarios.map((s,index)=>{const gate=index===0?null:evidenceGate(s);return <div key={s.name} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-[11px]"><span className="truncate">{s.name}</span><span className="font-semibold">{s.avgR.toFixed(2)}R</span><span className={index===0?'text-slate-400':gate?.label==='REVIEW CANDIDATE'?'text-emerald-600':gate?.label==='EARLY CANDIDATE'?'text-blue-600':'text-slate-500'}>{index===0?'BASE':gate?.label==='REVIEW CANDIDATE'?'REVIEW':gate?.label==='EARLY CANDIDATE'?'EARLY':'NO CONCLUSION'}</span></div>})}</div></div>}
