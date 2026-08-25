import { useMemo, useState } from 'react';
import { BookOpenCheck, BrainCircuit, LockKeyhole, Play } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui';
import {
  runStrategyRegimeRouting,
  type RoutingMetrics,
  type StrategyRegimeRoutingResponse,
} from '@/lib/strategyRegimeRoutingApi';

function offset(days:number){const date=new Date();date.setUTCDate(date.getUTCDate()-days);return date.toISOString().slice(0,10)}
function fmtR(value:number){return `${value>0?'+':''}${Number(value||0).toFixed(3)}R`}
function fmtPct(value:number){return `${Number(value||0).toFixed(1)}%`}
function readable(value:string){return value.replaceAll('_',' ').replace('1 20','1.20').replace('0 10','0.10')}
function daysBetween(start:string,end:string){return Math.round((new Date(`${end}T00:00:00Z`).getTime()-new Date(`${start}T00:00:00Z`).getTime())/86400000)}
function profitFactor(metrics:RoutingMetrics){return metrics.profit_factor_unbounded?'∞':metrics.profit_factor==null?'—':metrics.profit_factor.toFixed(2)}

export function StrategyRegimeRoutingResearch(){
  const [symbolsText,setSymbolsText]=useState('RELIANCE,SBIN,AXISBANK,HDFCBANK,ICICIBANK,TATASTEEL,HINDALCO,ONGC,INFY,TCS');
  const [developmentStart,setDevelopmentStart]=useState(offset(65));
  const [developmentEnd,setDevelopmentEnd]=useState(offset(36));
  const [holdoutStart,setHoldoutStart]=useState(offset(35));
  const [holdoutEnd,setHoldoutEnd]=useState(offset(5));
  const [premiumRR,setPremiumRR]=useState('1.5');
  const [maxTrades,setMaxTrades]=useState('50');
  const [costBps,setCostBps]=useState('10');
  const [running,setRunning]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [result,setResult]=useState<StrategyRegimeRoutingResponse|null>(null);
  const symbols=useMemo(()=>symbolsText.split(',').map(value=>value.trim().toUpperCase()).filter(Boolean).slice(0,25),[symbolsText]);

  async function run(){
    if(!symbols.length){setError('Enter at least one symbol.');return}
    if(!developmentStart||!developmentEnd||!holdoutStart||!holdoutEnd){setError('Enter all development and holdout dates.');return}
    if(developmentEnd<developmentStart||holdoutEnd<holdoutStart){setError('Each end date must be on or after its start date.');return}
    if(developmentEnd>=holdoutStart){setError('Holdout must start strictly after development ends.');return}
    if(daysBetween(developmentStart,developmentEnd)>31||daysBetween(holdoutStart,holdoutEnd)>31){setError('Each range is limited to 31 days.');return}
    setRunning(true);setError(null);setResult(null);
    try{
      setResult(await runStrategyRegimeRouting({
        symbols,
        development_start:developmentStart,
        development_end:developmentEnd,
        holdout_start:holdoutStart,
        holdout_end:holdoutEnd,
        research_target_r:1.0,
        premium_min_risk_reward:Number(premiumRR)||1.5,
        max_trades_per_strategy:Math.max(1,Math.min(Number(maxTrades)||50,50)),
        round_trip_cost_bps:Math.max(0,Number(costBps)||0),
      }));
    }catch(caught){setError(caught instanceof Error?caught.message:'Strategy–regime routing failed.')}finally{setRunning(false)}
  }

  const validated=result?.decision==='VALIDATED_STRATEGY_REGIME_ROUTER';
  const developmentMetrics=result?.development.book_eligible_metrics;
  const holdoutMetrics=result?.holdout.routed_metrics;
  return <Card><CardHeader title="Strategy–Regime Routing v1 — Book-Informed Price Action" subtitle="Development-only route selection, followed by one untouched option-premium holdout after costs. Research cannot change scanner, paper or live permissions." action={<BrainCircuit size={18} className="text-violet-500"/>}/><CardBody className="space-y-5">
    <div className="flex flex-wrap gap-2"><Badge variant="blue">RESEARCH ONLY</Badge><Badge variant="default">SUNIL GURJAR CONCEPTS</Badge><Badge variant="default">ACTUAL OPTION PREMIUM</Badge><Badge variant="default">COST ADJUSTED</Badge><Badge variant="default">HOLDOUT ONCE</Badge><Badge variant="default">PRODUCTION UNCHANGED</Badge><Badge variant="red">LIVE DISABLED</Badge></div>

    <div className="rounded-lg border border-violet-200 dark:border-violet-900 p-3 text-xs space-y-2"><p className="font-semibold flex items-center gap-2"><BookOpenCheck size={15}/>What Market Brain knows in this experiment</p><p className="text-slate-500">Market structure, support/resistance, candlestick context, breakout-close quality, volume confirmation, compression and false-breakout risk. These concepts are book-informed; every numeric threshold and score is an AlphaPilot hypothesis that must earn validation.</p><p className="text-[11px] text-slate-500 flex items-center gap-1"><LockKeyhole size={12}/>Weak price-action evidence is removed before development route selection and before the unchanged holdout route is scored.</p></div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
      <Input label="Symbols" value={symbolsText} onChange={setSymbolsText}/>
      <Input label="Development start" type="date" value={developmentStart} onChange={setDevelopmentStart}/>
      <Input label="Development end" type="date" value={developmentEnd} onChange={setDevelopmentEnd}/>
      <Input label="Holdout start" type="date" value={holdoutStart} onChange={setHoldoutStart}/>
      <Input label="Holdout end" type="date" value={holdoutEnd} onChange={setHoldoutEnd}/>
      <Input label="Premium Min R:R" type="number" value={premiumRR} onChange={setPremiumRR}/>
      <Input label="Max trades / strategy" type="number" value={maxTrades} onChange={setMaxTrades}/>
      <Input label="Round-trip cost (bps)" type="number" value={costBps} onChange={setCostBps}/>
    </div>
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><p className="text-[11px] text-slate-500">The holdout should span at least two calendar months; otherwise the fixed month-stability gate fails. This request can be slow because it replays four strategies and builds lagged broad-market context for both samples.</p><Button variant="primary" onClick={()=>void run()} disabled={running||!symbols.length}><Play size={14} className="inline mr-1"/>{running?'Replaying development and holdout…':'Run Locked Routing Test'}</Button></div>

    {error&&<div className="rounded-lg border border-red-200 p-3 text-sm text-red-600">{error}</div>}
    {result&&<>
      <div className={`rounded-lg border p-4 ${validated?'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20':'border-red-300 bg-red-50/50 dark:bg-red-950/20'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Untouched holdout decision</p><p className="text-xs text-slate-500 mt-1">{result.development.selected_route_ids.length} development-selected route(s) · {result.failed_gates.length} failed final gate(s)</p></div><Badge variant={validated?'green':'red'}>{result.decision}</Badge></div>{result.failed_gates.length>0&&<p className="text-xs text-red-600 mt-3 capitalize"><b>Failed:</b> {result.failed_gates.map(readable).join(' · ')}</p>}</div>

      {developmentMetrics&&holdoutMetrics&&<div className="grid grid-cols-1 xl:grid-cols-2 gap-3"><MetricsPanel title="Development · book eligible" metrics={developmentMetrics}/><MetricsPanel title="Untouched holdout · routed" metrics={holdoutMetrics}/></div>}

      <div><p className="text-sm font-semibold mb-2">Development route selection</p><div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-2 text-left">Route</th><th>Trades</th><th>Symbols</th><th>Dates</th><th>Avg R</th><th>PF</th><th>Max DD</th><th>Selection</th></tr></thead><tbody>{result.development.route_candidates.map(route=><tr key={route.route_id} className="border-t"><td className="p-2 font-semibold">{route.route_id}</td><td className="text-center">{route.development_metrics.trades}</td><td className="text-center">{route.development_metrics.unique_symbols}</td><td className="text-center">{route.development_metrics.unique_dates}</td><td className="text-center">{fmtR(route.development_metrics.average_r)}</td><td className="text-center">{profitFactor(route.development_metrics)}</td><td className="text-center">{fmtR(route.development_metrics.max_drawdown_r)}</td><td className="text-center"><Badge variant={route.selected_on_development?'green':'red'}>{route.selected_on_development?'SELECTED':'REJECTED'}</Badge></td></tr>)}</tbody></table></div>{result.development.route_candidates.length===0&&<p className="text-xs text-slate-500 mt-2">No book-eligible development route had a resolvable sample.</p>}</div>

      <div><p className="text-sm font-semibold mb-2">Fixed acceptance gates</p><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{Object.entries(result.acceptance_gates).map(([name,passed])=><div key={name} className="rounded-lg border p-3 flex items-center justify-between gap-3"><span className="text-xs capitalize">{readable(name)}</span><Badge variant={passed?'green':'red'}>{passed?'PASS':'FAIL'}</Badge></div>)}</div></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3"><SourcePanel label="Development source" source={result.source_diagnostics.development}/><SourcePanel label="Holdout source" source={result.source_diagnostics.holdout}/></div>
      <p className="text-[11px] text-slate-500">Protocol {result.protocol_revision}. Market context is deliberately lagged by {result.source_diagnostics.holdout.context_match.context_lag_minutes} minutes. A positive result remains research-only; it does not arm paper or live trading.</p>
    </>}
  </CardBody></Card>;
}

function MetricsPanel({title,metrics}:{title:string;metrics:RoutingMetrics}){
  return <div className="rounded-lg border p-3"><p className="text-sm font-semibold mb-3">{title}</p><div className="grid grid-cols-3 gap-3"><Metric label="Trades" value={String(metrics.trades)}/><Metric label="Win rate" value={fmtPct(metrics.win_rate)}/><Metric label="Avg R" value={fmtR(metrics.average_r)}/><Metric label="Profit factor" value={profitFactor(metrics)}/><Metric label="Max DD" value={fmtR(metrics.max_drawdown_r)}/><Metric label="Symbols / dates / months" value={`${metrics.unique_symbols} / ${metrics.unique_dates} / ${metrics.unique_months}`}/></div>{metrics.by_month.length>0&&<p className="text-[11px] text-slate-500 mt-3">Monthly: {metrics.by_month.map(row=>`${row.month} ${fmtR(row.total_r)}`).join(' · ')}</p>}</div>;
}

function SourcePanel({label,source}:{label:string;source:StrategyRegimeRoutingResponse['source_diagnostics']['development']}){
  const errors=source.option_errors.length+source.context_errors.length;
  return <div className="rounded-lg border p-3 text-xs"><div className="flex justify-between gap-3"><b>{label}</b><Badge variant={errors?'amber':'green'}>{errors?`${errors} ERRORS`:'CLEAN'}</Badge></div><p className="text-slate-500 mt-2">{source.period.start_date} → {source.period.end_date} · {source.option_trade_count} option trades · {source.context_match.matched_trades}/{source.context_match.input_trades} matched to closed Market Brain context ({fmtPct(source.context_match.match_rate_pct)})</p></div>;
}

function Metric({label,value}:{label:string;value:string}){return <div><p className="text-[10px] text-slate-500">{label}</p><p className="text-sm font-semibold mt-0.5">{value}</p></div>}
