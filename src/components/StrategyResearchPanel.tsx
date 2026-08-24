import { useMemo, useState } from 'react';
import { FlaskConical, Play } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui';
import { runStrategyResearch, type StrategyResearchResponse } from '@/lib/strategyResearchApi';

const DEFAULT_SYMBOLS='RELIANCE,SBIN,AXISBANK,HDFCBANK,ICICIBANK,TATASTEEL,HINDALCO,ONGC,INFY,TCS';
function offset(days:number){const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)}
function fmt(v:unknown,d=2){const n=Number(v);return Number.isFinite(n)?n.toFixed(d):'—'}
function label(name:string){return name==='ORB_30'?'ORB 30':name==='VWAP_TREND'?'VWAP Trend':name==='BREAKOUT_20'?'20-Bar Breakout':name}

export function StrategyResearchPanel(){
  const [symbolsText,setSymbolsText]=useState(DEFAULT_SYMBOLS);
  const [start,setStart]=useState(offset(10));
  const [end,setEnd]=useState(offset(1));
  const [targetR,setTargetR]=useState('1.0');
  const [running,setRunning]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [result,setResult]=useState<StrategyResearchResponse|null>(null);
  const symbols=useMemo(()=>symbolsText.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean).slice(0,12),[symbolsText]);

  async function run(){
    if(!symbols.length||!start||!end){setError('Enter symbols, start date and end date.');return}
    if(end<start){setError('End date must be on or after start date.');return}
    setRunning(true);setError(null);setResult(null);
    try{setResult(await runStrategyResearch({symbols,start_date:start,end_date:end,target_r:Number(targetR)||1}));}
    catch(e){setError(e instanceof Error?e.message:'Strategy research failed.');}
    finally{setRunning(false)}
  }

  const leaders=result?.leaderboard??[];
  return <Card><CardHeader title="Strategy Research v2" subtitle="Independent underlying-market strategies compete on the same historical NSE data before any option-premium replay." action={<FlaskConical size={18} className="text-indigo-500"/>}/><CardBody className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
      <Input label="Symbols" value={symbolsText} onChange={setSymbolsText}/>
      <Input label="Start date" type="date" value={start} onChange={setStart}/>
      <Input label="End date" type="date" value={end} onChange={setEnd}/>
      <Input label="Research target (R)" type="number" value={targetR} onChange={setTargetR}/>
    </div>
    <div className="flex justify-between gap-3 items-center"><p className="text-[11px] text-slate-500">Phase 1 tests directional edge on the underlying only. ORB, VWAP Trend and 20-Bar Breakout use next-candle entry to avoid look-ahead.</p><Button variant="primary" onClick={run} disabled={running||!symbols.length}><Play size={14} className="inline mr-1"/>{running?'Running strategy research…':'Run Strategy Research v2'}</Button></div>
    {error&&<div className="rounded-lg border border-red-200 p-3 text-sm text-red-600">{error}</div>}
    {result&&<>
      <div className="flex flex-wrap justify-between gap-2 items-center"><div><p className="text-sm font-semibold">Strategy leaderboard</p><p className="text-[11px] text-slate-500">Ranked by Avg R, then trade count. Positive results are hypotheses until they survive larger and untouched samples.</p></div><Badge variant="blue">UNDERLYING DISCOVERY</Badge></div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-2 text-left">Strategy</th><th>Trades</th><th>Wins</th><th>Win %</th><th>Avg R</th><th>Total R</th><th>Max DD</th></tr></thead><tbody>{leaders.map((x,i)=><tr key={x.strategy} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2 font-semibold">#{i+1} {label(x.strategy)}</td><td className="text-center">{x.trades}</td><td className="text-center">{x.wins}</td><td className="text-center">{fmt(x.win_rate,1)}%</td><td className={`text-center font-semibold ${x.average_r>0?'text-emerald-600':x.average_r<0?'text-red-600':''}`}>{x.average_r>=0?'+':''}{fmt(x.average_r)}R</td><td className={`text-center ${x.total_r>0?'text-emerald-600':x.total_r<0?'text-red-600':''}`}>{x.total_r>=0?'+':''}{fmt(x.total_r)}R</td><td className="text-center">{fmt(x.max_drawdown_r)}R</td></tr>)}</tbody></table></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">{Object.entries(result.strategy_definitions??{}).map(([k,v])=><div key={k} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="text-xs font-semibold">{label(k)}</p><p className="text-[11px] text-slate-500 mt-1">{v}</p></div>)}</div>
      {(result.errors?.length??0)>0&&<div className="rounded-lg border border-amber-200 p-3 text-xs text-amber-700">{result.errors!.length} symbol-data errors occurred. They are excluded rather than fabricated.</div>}
      <p className="text-xs text-slate-500">Do not promote a strategy from one run. A credible candidate must first show positive expectancy with enough trades, then survive different symbols/time periods, and only then be sent to the True F&O Premium Replay.</p>
    </>}
  </CardBody></Card>
}
