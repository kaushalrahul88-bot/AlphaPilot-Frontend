import { useEffect,useMemo,useState } from 'react';
import { BookOpenCheck,LockKeyhole,Play } from 'lucide-react';
import { Badge,Button,Card,CardBody,CardHeader } from '@/components/ui';
import { runPullbackShortOptionH1,type DiagnosticRow,type PullbackShortOptionH1Response } from '@/lib/pullbackShortOptionH1Api';
import type { RoutingMetrics } from '@/lib/strategyRegimeRoutingApi';

const STORAGE_KEY='alphapilot.pullbackShortOptionH1.frozen-2026-08-25';

function readable(value:string){return value.replaceAll('_',' ').toLowerCase()}
function fmtR(value:number){return `${value>0?'+':''}${Number(value||0).toFixed(3)}R`}
function fmtPct(value:number){return `${Number(value||0).toFixed(1)}%`}
function pf(metrics:RoutingMetrics){return metrics.profit_factor_unbounded?'∞':metrics.profit_factor==null?'—':metrics.profit_factor.toFixed(2)}
function readSaved():PullbackShortOptionH1Response|null{
  if(typeof window==='undefined')return null;
  try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');return value&&typeof value==='object'?value:null}catch{return null}
}
function saveResult(value:PullbackShortOptionH1Response){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value))}catch{/* The result remains visible in memory if browser storage is unavailable. */}
}
function progressState(seconds:number){
  if(seconds<20)return{label:'Rebuilding frozen underlying signals',percent:Math.min(18,4+seconds*.7)};
  if(seconds<120)return{label:'Resolving BUY PE contracts and replaying 5-minute premiums',percent:18+(seconds-20)*.48};
  if(seconds<210)return{label:'Building lagged Market Brain diagnostics',percent:66+(seconds-120)*.2};
  return{label:'Applying fixed cost, sample and economic gates',percent:Math.min(96,84+(seconds-210)*.04)};
}

export function PullbackShortOptionH1(){
  const[result,setResult]=useState<PullbackShortOptionH1Response|null>(()=>readSaved());
  const[running,setRunning]=useState(false),[elapsed,setElapsed]=useState(0),[error,setError]=useState<string|null>(null);
  useEffect(()=>{if(!running)return;setElapsed(0);const timer=window.setInterval(()=>setElapsed(value=>value+1),1000);return()=>window.clearInterval(timer)},[running]);
  const closed=Boolean(result&&result.decision!=='INSUFFICIENT_DATA_FOR_PULLBACK_SHORT_OPTION_H1');
  const validated=result?.decision==='VALIDATED_PULLBACK_SHORT_OPTION_CANDIDATE';
  const insufficient=result?.decision==='INSUFFICIENT_DATA_FOR_PULLBACK_SHORT_OPTION_H1';
  const progress=progressState(elapsed);
  const failed=useMemo(()=>result?.failed_gates.map(readable).join(' · ')||'',[result]);
  async function run(){setRunning(true);setError(null);if(!insufficient)setResult(null);try{const next=await runPullbackShortOptionH1();setResult(next);saveResult(next)}catch(caught){setError(caught instanceof Error?caught.message:'Frozen H-1 test failed.')}finally{setRunning(false)}}
  return <Card><CardHeader title="Pullback Continuation SHORT v1 — Option-Premium H-1" subtitle="One untouched 11–21 August holdout for the replicated SHORT setup. Every test input is frozen; production remains unchanged." action={<LockKeyhole size={18} className="text-violet-500"/>}/><CardBody className="space-y-5">
    <div className="flex flex-wrap gap-2"><Badge variant="blue">FROZEN CANDIDATE</Badge><Badge variant="default">PULLBACK SHORT</Badge><Badge variant="default">BUY PE</Badge><Badge variant="default">ACTUAL OPTION PREMIUM</Badge><Badge variant="default">FIXED 1R</Badge><Badge variant="default">10 BPS COST</Badge><Badge variant="default">HOLDOUT ONCE</Badge><Badge variant="default">RESEARCH ONLY</Badge><Badge variant="red">LIVE DISABLED</Badge></div>

    <div className="rounded-lg border border-violet-200 dark:border-violet-900 p-3 text-xs space-y-2"><p className="font-semibold flex items-center gap-2"><BookOpenCheck size={15}/>Diagnostics cannot rescue this test</p><p className="text-slate-500">Book-informed price action and lagged Market Brain context are recorded only to explain outcomes. Neither can remove, add, route, or rescore a trade in H-1.</p></div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Frozen label="Holdout" value="11 Aug → 21 Aug 2026"/><Frozen label="Universe" value="8 discovery symbols"/><Frozen label="Entry / action" value="Next 5m open · BUY PE"/><Frozen label="Exit / cost" value="Fixed 1R · 10 bps"/></div>
    <div className="rounded-lg border p-3 text-xs"><b>Frozen development promotion basis:</b> 177 all-block trades · +22.24R total · +0.126R average · approximately 55.9% wins · positive in 4 of 6 independent blocks. The earlier +0.327R headline from promising blocks alone is not used here.</div>
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><p className="text-[11px] text-slate-500">There are no manual fields. The API also hard-codes the universe, dates, rule, target and cost. A completed economic result closes this dashboard protocol; an incomplete source-data run may retry the identical specification.</p><Button variant="primary" onClick={()=>void run()} disabled={running||closed}><Play size={14} className="inline mr-1"/>{running?'Frozen H-1 running…':closed?'H-1 Closed':insufficient?'Retry Identical Data Run':'Run Frozen H-1 Once'}</Button></div>

    {running&&<div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20 p-3" role="status" aria-live="polite"><div className="flex flex-wrap justify-between gap-2 text-xs"><span className="font-semibold">{progress.label}</span><span className="text-slate-500">{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')} elapsed</span></div><div className="h-2 rounded-full bg-blue-100 dark:bg-blue-950 mt-2 overflow-hidden"><div className="h-full rounded-full bg-blue-600 transition-[width] duration-1000" style={{width:`${progress.percent}%`}}/></div><p className="text-[10px] text-slate-500 mt-2">Stage-based progress is shown because the locked result is returned only after all premium replays and diagnostics finish.</p></div>}
    {error&&<div className="rounded-lg border border-red-200 p-3 text-sm text-red-600">{error}</div>}

    {result&&<>
      <div className={`rounded-lg border p-4 ${validated?'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20':insufficient?'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20':'border-red-300 bg-red-50/50 dark:bg-red-950/20'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{insufficient?'Source-data decision':'Official H-1 decision'}</p><p className="text-xs text-slate-500 mt-1">{result.source_diagnostics.resolved_option_trades}/{result.source_diagnostics.attempted_option_replays} option replays resolved · {fmtPct(result.source_diagnostics.option_replay_coverage_pct)}</p></div><Badge variant={validated?'green':insufficient?'amber':'red'}>{result.decision}</Badge></div>{failed&&<p className={`text-xs mt-3 ${insufficient?'text-amber-700':'text-red-600'}`}><b>{insufficient?'Missing data':'Failed'}:</b> {failed}</p>}</div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3"><Metric label="Signals" value={String(result.source_diagnostics.candidate_signals)}/><Metric label="Option trades" value={String(result.holdout_metrics.trades)}/><Metric label="Win rate" value={fmtPct(result.holdout_metrics.win_rate)}/><Metric label="Avg R" value={fmtR(result.holdout_metrics.average_r)}/><Metric label="Total R" value={fmtR(result.holdout_metrics.total_r)}/><Metric label="Profit factor" value={pf(result.holdout_metrics)}/><Metric label="Max DD" value={fmtR(result.holdout_metrics.max_drawdown_r)}/><Metric label="Symbols / dates" value={`${result.holdout_metrics.unique_symbols} / ${result.holdout_metrics.unique_dates}`}/></div>

      <div><p className="text-sm font-semibold mb-2">Fixed acceptance gates</p>{insufficient&&<p className="text-xs text-amber-700 mb-2">Economic values are visible for transparency but cannot support a conclusion until all data-quality gates pass.</p>}<div className="grid grid-cols-1 md:grid-cols-2 gap-2">{Object.entries(result.acceptance_gates).map(([name,passed])=><div key={name} className="rounded-lg border p-3 flex items-center justify-between gap-3"><span className="text-xs capitalize">{readable(name)}</span><Badge variant={passed?'green':'red'}>{passed?'PASS':'FAIL'}</Badge></div>)}</div></div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3"><DiagnosticTable title="Book price-action grades · diagnostic only" rows={result.book_diagnostics}/><DiagnosticTable title="Market Brain regimes · diagnostic only" rows={result.market_brain_diagnostics.by_regime}/></div>
      <div className="rounded-lg border p-3 text-xs"><b>Market Brain coverage:</b> {result.market_brain_diagnostics.context_match.matched_trades}/{result.market_brain_diagnostics.context_match.input_trades} matched ({fmtPct(result.market_brain_diagnostics.context_match.match_rate_pct)}) with a frozen {result.market_brain_diagnostics.context_lag_minutes}-minute lag. Missing context never removes an option trade.</div>

      {result.errors.length>0&&<details className="rounded-lg border border-amber-200 p-3 text-xs"><summary className="cursor-pointer font-semibold">Data and replay errors ({result.errors.length})</summary><div className="space-y-1 mt-2">{result.errors.slice(0,12).map((row,index)=><p key={index} className="text-amber-700 break-words"><b>{String(row.stage||'DATA')}:</b> {String(row.symbol||'')} {String(row.error||'Unknown error')}</p>)}</div>{result.errors.length>12&&<p className="text-[10px] text-slate-500 mt-2">Showing 12 of {result.errors.length} errors.</p>}</details>}
      <p className="text-[11px] text-slate-500">Protocol {result.protocol_revision}. Development ended 10 August; H-1 starts 11 August. Even a validated result remains a research candidate and does not enable scanner, paper or live execution.</p>
    </>}
  </CardBody></Card>
}

function Frozen({label,value}:{label:string;value:string}){return <div className="rounded-lg border p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="text-xs font-semibold mt-1">{value}</p></div>}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-lg border p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="text-base font-bold mt-1">{value}</p></div>}
function DiagnosticTable({title,rows}:{title:string;rows:DiagnosticRow[]}){return <div><p className="text-sm font-semibold mb-2">{title}</p><div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-2 text-left">Group</th><th>Trades</th><th>Win</th><th>Avg R</th><th>PF</th></tr></thead><tbody>{rows.map(row=><tr key={row.label} className="border-t"><td className="p-2 font-semibold">{row.label}</td><td className="text-center">{row.metrics.trades}</td><td className="text-center">{fmtPct(row.metrics.win_rate)}</td><td className="text-center">{fmtR(row.metrics.average_r)}</td><td className="text-center">{pf(row.metrics)}</td></tr>)}</tbody></table>{rows.length===0&&<p className="p-3 text-xs text-slate-500">No diagnostic matches were available. This does not change the frozen economic sample.</p>}</div></div>}
