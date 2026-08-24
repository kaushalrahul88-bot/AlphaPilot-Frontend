import { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { getCommodityCandles, type CommoditySymbol } from '@/lib/commodityApi';

const STORAGE_KEY = 'alphapilot.commodityOutcomes.v1';

type Outcome = 'OPEN' | 'T1 HIT' | 'T2 HIT' | 'SL HIT' | 'AMBIGUOUS';
type Row = {
  id:string; symbol:string; contract?:string; action:'BUY'|'SELL'; captured_at:string;
  execution_entry?:number; entry:number; stop:number; target1:number; outcome:Outcome; resolved_at?:string|null;
};
type ScenarioResult = { name:string; samples:number; excluded:number; netR:number; avgR:number; wins:number; losses:number; breakeven:number };

type SimResult = { r:number|null; excluded:boolean };

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
function baseline(r:Row):SimResult { const risk=riskOf(r); if(risk<=0)return{r:null,excluded:true}; if(r.outcome==='SL HIT')return{r:-1,excluded:false}; if(r.outcome==='T1 HIT'||r.outcome==='T2 HIT'){const reward=Math.abs(Number(r.target1)-entryOf(r));return{r:reward/risk,excluded:false};} return{r:null,excluded:true}; }
function fullHalfR(r:Row,candles:any[]):SimResult { const cs=windowCandles(r,candles),target=favPrice(r,.5),stop=Number(r.stop); for(const c of cs){const fav=touches(c,target,r.action,'FAV'),adv=touches(c,stop,r.action,'ADV'); if(fav&&adv)return{r:null,excluded:true}; if(fav)return{r:.5,excluded:false}; if(adv)return{r:-1,excluded:false};} return baseline(r); }
function partialHalfR(r:Row,candles:any[]):SimResult { const cs=windowCandles(r,candles); let partial=false; for(const c of cs){const cr=closeR(r,c); if(cr!=null&&cr>=.5){partial=true;break;}} const b=baseline(r); if(b.excluded||b.r==null)return b; return partial?{r:.25+.5*b.r,excluded:false}:b; }
function breakevenAfter(r:Row,candles:any[],threshold:number):SimResult { const cs=windowCandles(r,candles),entry=entryOf(r),t1=Number(r.target1),stop=Number(r.stop); let armed=false; for(let i=0;i<cs.length;i++){const c=cs[i]; if(!armed){const cr=closeR(r,c); if(cr!=null&&cr>=threshold){armed=true; continue;} const hitT1=touches(c,t1,r.action,'FAV'),hitSl=touches(c,stop,r.action,'ADV'); if(hitT1&&hitSl)return{r:null,excluded:true}; if(hitT1)return baseline(r); if(hitSl)return{r:-1,excluded:false}; }
    else { const hitT1=touches(c,t1,r.action,'FAV'),hitBe=touches(c,entry,r.action,'ADV'); if(hitT1&&hitBe)return{r:null,excluded:true}; if(hitT1)return baseline(r); if(hitBe)return{r:0,excluded:false}; }
  } return baseline(r); }
function summarize(name:string,results:SimResult[]):ScenarioResult { const usable=results.filter(x=>!x.excluded&&x.r!=null).map(x=>Number(x.r)); const netR=usable.reduce((s,x)=>s+x,0); return {name,samples:usable.length,excluded:results.length-usable.length,netR,avgR:usable.length?netR/usable.length:0,wins:usable.filter(x=>x>0).length,losses:usable.filter(x=>x<0).length,breakeven:usable.filter(x=>x===0).length}; }
function quality(n:number){return n>=20?{label:'USABLE SAMPLE',variant:'green' as const}:n>=5?{label:'EARLY SIGNAL',variant:'blue' as const}:{label:'INSUFFICIENT SAMPLE',variant:'default' as const};}

export function CommodityManagementSimulation(){
  const[rows,setRows]=useState<Row[]>(()=>loadRows()); const[loading,setLoading]=useState(false); const[scenarios,setScenarios]=useState<ScenarioResult[]>([]); const[skipped,setSkipped]=useState({contractMismatch:0,history:0});
  useEffect(()=>{const f=()=>setRows(loadRows());window.addEventListener('storage',f);const id=window.setInterval(f,30_000);return()=>{window.removeEventListener('storage',f);window.clearInterval(id)}},[]);
  const resolved=useMemo(()=>rows.filter(r=>r.resolved_at&&(r.outcome==='T1 HIT'||r.outcome==='T2 HIT'||r.outcome==='SL HIT')),[rows]);
  const run=async()=>{setLoading(true);try{const symbols=Array.from(new Set(resolved.map(r=>r.symbol).filter(s=>s==='CRUDEOIL'||s==='NATURALGAS'))) as CommoditySymbol[];const feeds=new Map<string,any>();await Promise.all(symbols.map(async s=>{try{feeds.set(s,await getCommodityCandles(s,'5m'))}catch{feeds.set(s,null)}}));let mismatch=0,history=0;const baselineResults:SimResult[]=[],fullHalf:SimResult[]=[],partialHalf:SimResult[]=[],beHalf:SimResult[]=[],beOne:SimResult[]=[];for(const r of resolved){const feed=feeds.get(r.symbol);if(!feed){history++;continue;}const returned=String(feed?.contract?.trading_symbol??feed?.contract?.groww_symbol??'');if(r.contract&&returned&&r.contract!==returned){mismatch++;continue;}const cs=Array.isArray(feed?.candles)?feed.candles:[];if(!windowCandles(r,cs).length){history++;continue;}baselineResults.push(baseline(r));fullHalf.push(fullHalfR(r,cs));partialHalf.push(partialHalfR(r,cs));beHalf.push(breakevenAfter(r,cs,.5));beOne.push(breakevenAfter(r,cs,1));}
    setSkipped({contractMismatch:mismatch,history});setScenarios([summarize('Frozen Plan',baselineResults),summarize('Full Exit at +0.50R',fullHalf),summarize('50% at +0.50R, Rest Frozen',partialHalf),summarize('BE after 5m Close ≥ +0.50R',beHalf),summarize('BE after 5m Close ≥ +1.00R',beOne)]);
  }finally{setLoading(false)}};
  useEffect(()=>{if(resolved.length)void run();else setScenarios([])},[resolved.length]);
  const evidence=quality(scenarios[0]?.samples??0);
  return <Card><CardHeader title="Commodity Management Simulation" subtitle="Analytics-only comparison of frozen exits versus simple profit-protection rules on resolved MCX trades." action={<div className="flex gap-2 items-center"><Badge variant={evidence.variant}>{evidence.label}</Badge><Button size="sm" variant="ghost" onClick={()=>void run()} disabled={loading}>{loading?<RefreshCw size={13} className="inline mr-1 animate-spin"/>:<Activity size={13} className="inline mr-1"/>}Refresh</Button></div>}/><CardBody className="space-y-3"><div className="grid grid-cols-1 md:grid-cols-5 gap-2">{scenarios.map(s=><div key={s.name} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="text-xs font-semibold">{s.name}</p><p className="text-lg font-bold mt-1">{s.avgR.toFixed(2)}R</p><p className="text-[11px] text-slate-500">Avg R · Net {s.netR.toFixed(2)}R</p><p className="text-[11px] text-slate-500 mt-1">{s.samples} usable · {s.wins}W / {s.losses}L / {s.breakeven}BE</p>{s.excluded>0&&<p className="text-[11px] text-amber-600 mt-1">{s.excluded} ambiguous/excluded</p>}</div>)}</div><div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-500"><b>Simulation rules:</b> breakeven is armed only after a completed 5m candle closes at or beyond +0.50R/+1.00R, then applies from the next candle. The 50% partial scenario also requires a 5m close ≥ +0.50R. A full +0.50R exit uses OHLC touch and excludes candles that touch both +0.50R and SL because intrabar order is unknowable.</div>{(skipped.contractMismatch>0||skipped.history>0)&&<p className="text-[11px] text-slate-500">Excluded before simulation: {skipped.contractMismatch} rollover-contract mismatch · {skipped.history} insufficient retained 5m history.</p>}<p className="text-xs text-slate-500">No live commodity entry, stop, target or execution gate is changed by this panel. Use it only after enough resolved trades accumulate.</p></CardBody></Card>;
}
