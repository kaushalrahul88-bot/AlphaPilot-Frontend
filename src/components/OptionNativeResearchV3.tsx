import { useMemo, useState } from 'react';
import { FlaskConical, Play } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui';
import { runOptionNativeResearch, type OptionNativeResearchResponse } from '@/lib/optionNativeResearchApi';

function offset(days:number){const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)}
function fmt(v:unknown,d=2){const n=Number(v);return Number.isFinite(n)?n.toFixed(d):'—'}
function strategyName(v:unknown){const s=String(v??'—');return s==='VWAP_TREND'?'VWAP Trend':s==='ORB_30'?'ORB 30':s==='BREAKOUT_20'?'20-Bar Breakout':s}

export function OptionNativeResearchV3(){
  const [symbolsText,setSymbolsText]=useState('RELIANCE,SBIN,AXISBANK,HDFCBANK,ICICIBANK,TATASTEEL,HINDALCO,ONGC,INFY,TCS');
  const [start,setStart]=useState(offset(10));
  const [end,setEnd]=useState(offset(1));
  const [premiumRR,setPremiumRR]=useState('1.5');
  const [maxTrades,setMaxTrades]=useState('30');
  const [costBps,setCostBps]=useState('10');
  const [running,setRunning]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [result,setResult]=useState<OptionNativeResearchResponse|null>(null);
  const symbols=useMemo(()=>symbolsText.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean).slice(0,25),[symbolsText]);

  async function run(){
    if(!symbols.length||!start||!end){setError('Enter symbols, start date and end date.');return}
    if(end<start){setError('End date must be on or after start date.');return}
    setRunning(true);setError(null);setResult(null);
    try{
      setResult(await runOptionNativeResearch({symbols,start_date:start,end_date:end,research_target_r:1.0,premium_min_risk_reward:Number(premiumRR)||1.5,max_trades_per_strategy:Math.max(1,Math.min(Number(maxTrades)||30,50)),round_trip_cost_bps:Math.max(0,Number(costBps)||0)}));
    }catch(e){setError(e instanceof Error?e.message:'Option-native research failed.')}finally{setRunning(false)}
  }

  return <Card><CardHeader title="Strategy Research v3 — Option-Premium Discovery" subtitle="Research-only stress test: frozen strategy signals compete on actual historical CE/PE premium outcomes, including a configurable trading-cost stress." action={<FlaskConical size={18} className="text-fuchsia-500"/>}/><CardBody className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><Badge variant="blue">RESEARCH ONLY</Badge><Badge variant="default">PRODUCTION UNCHANGED</Badge></div>
    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
      <Input label="Symbols" value={symbolsText} onChange={setSymbolsText}/>
      <Input label="Start date" type="date" value={start} onChange={setStart}/>
      <Input label="End date" type="date" value={end} onChange={setEnd}/>
      <Input label="Premium Min R:R" type="number" value={premiumRR} onChange={setPremiumRR}/>
      <Input label="Max trades / strategy" type="number" value={maxTrades} onChange={setMaxTrades}/>
      <Input label="Round-trip cost (bps)" type="number" value={costBps} onChange={setCostBps}/>
    </div>
    <div className="flex justify-end"><Button variant="primary" onClick={run} disabled={running||!symbols.length}><Play size={14} className="inline mr-1"/>{running?'Running option-premium research…':'Run Strategy Research v3'}</Button></div>
    <p className="text-[11px] text-slate-500">This first v3 layer does not invent new winning rules. It compares the frozen v2 strategies after true option-premium replay and applies the same cost stress to all of them. PASS/WATCH/FAIL is research classification only.</p>
    {error&&<div className="rounded-lg border border-red-200 p-3 text-sm text-red-600">{error}</div>}
    {result&&<>
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-2 text-left">Rank</th><th className="text-left">Strategy</th><th>Trades</th><th>Win %</th><th>Raw Avg R</th><th>Cost Adj Avg R</th><th>Cost Adj Total R</th><th>Max DD</th><th>Status</th></tr></thead><tbody>{(result.leaderboard??[]).map((row,i)=>{const raw=row.raw_summary??{},s=row.cost_adjusted_summary??{};const status=String(s.classification??'FAIL');return <tr key={`${String(row.strategy)}-${i}`} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2 font-semibold">#{row.rank??i+1}</td><td className="font-semibold">{strategyName(row.strategy)}</td><td className="text-center">{String(s.trades??0)}</td><td className="text-center">{fmt(s.win_rate,1)}%</td><td className={`text-center font-semibold ${Number(raw.average_r)>0?'text-emerald-600':Number(raw.average_r)<0?'text-red-600':''}`}>{Number(raw.average_r)>0?'+':''}{fmt(raw.average_r)}R</td><td className={`text-center font-semibold ${Number(s.average_r)>0?'text-emerald-600':Number(s.average_r)<0?'text-red-600':''}`}>{Number(s.average_r)>0?'+':''}{fmt(s.average_r)}R</td><td className="text-center">{Number(s.total_r)>0?'+':''}{fmt(s.total_r)}R</td><td className="text-center">{fmt(s.max_drawdown_r)}R</td><td className="text-center"><Badge variant={status==='PASS'?'green':status==='WATCH'?'amber':'red'}>{status}</Badge></td></tr>})}</tbody></table></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">{(result.leaderboard??[]).map(row=><div key={`a-${String(row.strategy)}`} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="text-sm font-semibold">{strategyName(row.strategy)}</p><p className="text-[11px] text-slate-500 mt-1">CE vs PE cost-adjusted</p><div className="mt-2 space-y-1 text-xs">{Object.entries(row.by_action??{}).map(([action,s])=><div key={action} className="flex justify-between gap-3"><span>{action}</span><span>{s.trades??0} trades · {Number(s.average_r)>0?'+':''}{fmt(s.average_r)}R avg</span></div>)}</div></div>)}</div>
      {(result.errors?.length??0)>0&&<div className="rounded-lg border border-amber-200 p-3 text-xs text-amber-700">{result.errors!.length} contract/data/replay errors occurred. They are excluded rather than fabricated.</div>}
      <p className="text-xs text-slate-500">Cost stress: {fmt(result.round_trip_cost_bps,1)} bps round trip. A positive candidate must still survive untouched symbols/time periods before any production change.</p>
    </>}
  </CardBody></Card>
}
