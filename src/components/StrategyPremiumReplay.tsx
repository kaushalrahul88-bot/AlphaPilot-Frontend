import { useMemo, useState } from 'react';
import { Play, Route } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui';
import { runStrategyPremiumReplay, type StrategyPremiumReplayResponse } from '@/lib/strategyPremiumReplayApi';

function offset(days:number){const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)}
function fmt(v:unknown,d=2){const n=Number(v);return Number.isFinite(n)?n.toFixed(d):'—'}

export function StrategyPremiumReplay(){
  const [symbolsText,setSymbolsText]=useState('RELIANCE,SBIN,AXISBANK,HDFCBANK,ICICIBANK,TATASTEEL,HINDALCO,ONGC,INFY,TCS');
  const [start,setStart]=useState(offset(10));
  const [end,setEnd]=useState(offset(1));
  const [strategy,setStrategy]=useState<'VWAP_TREND'|'ORB_30'|'BREAKOUT_20'>('VWAP_TREND');
  const [premiumRR,setPremiumRR]=useState('1.5');
  const [maxTrades,setMaxTrades]=useState('30');
  const [running,setRunning]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [result,setResult]=useState<StrategyPremiumReplayResponse|null>(null);
  const symbols=useMemo(()=>symbolsText.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean).slice(0,25),[symbolsText]);

  async function run(){
    if(!symbols.length||!start||!end){setError('Enter symbols, start date and end date.');return}
    if(end<start){setError('End date must be on or after start date.');return}
    setRunning(true);setError(null);setResult(null);
    try{
      setResult(await runStrategyPremiumReplay({symbols,start_date:start,end_date:end,strategy,research_target_r:1.0,premium_min_risk_reward:Number(premiumRR)||1.5,max_trades:Math.max(1,Math.min(Number(maxTrades)||30,50))}));
    }catch(e){setError(e instanceof Error?e.message:'Strategy premium replay failed.')}finally{setRunning(false)}
  }

  const s=result?.summary??{};
  return <Card><CardHeader title="Strategy → True F&O Premium Replay" subtitle="Phase 2: freeze a research strategy, translate its real historical signals into CE/PE contracts, then judge actual option-premium outcomes." action={<Route size={18} className="text-indigo-500"/>}/><CardBody className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
      <Input label="Symbols" value={symbolsText} onChange={setSymbolsText}/>
      <Input label="Start date" type="date" value={start} onChange={setStart}/>
      <Input label="End date" type="date" value={end} onChange={setEnd}/>
      <div><label className="text-xs font-medium">Strategy</label><select className="block mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2.5 text-sm" value={strategy} onChange={e=>setStrategy(e.target.value as any)}><option value="VWAP_TREND">VWAP Trend</option><option value="BREAKOUT_20">20-Bar Breakout</option><option value="ORB_30">ORB 30</option></select></div>
      <Input label="Premium Min R:R" type="number" value={premiumRR} onChange={setPremiumRR}/>
      <Input label="Max trades" type="number" value={maxTrades} onChange={setMaxTrades}/>
    </div>
    <div className="flex justify-end"><Button variant="primary" onClick={run} disabled={running||!symbols.length}><Play size={14} className="inline mr-1"/>{running?'Replaying strategy through options…':'Run Strategy Premium Replay'}</Button></div>
    <p className="text-[11px] text-slate-500">VWAP Trend remains frozen at its Strategy Research v2 rules. LONG becomes BUY CE and SHORT becomes BUY PE. Entry uses the strategy's next 5-minute candle time; option P&L then comes from actual Groww 5-minute premium candles.</p>
    {error&&<div className="rounded-lg border border-red-200 p-3 text-sm text-red-600">{error}</div>}
    {result&&<>
      <div className="grid grid-cols-2 md:grid-cols-7 gap-2"><Stat l="Trades" v={String(s.trades??0)}/><Stat l="Wins" v={String(s.wins??0)}/><Stat l="Losses" v={String(s.losses??0)}/><Stat l="Ambiguous" v={String(s.ambiguous??0)}/><Stat l="Win rate" v={`${fmt(s.win_rate,1)}%`}/><Stat l="Total R" v={`${Number(s.total_r??0)>0?'+':''}${fmt(s.total_r)}R`}/><Stat l="Avg R" v={`${Number(s.average_r??0)>0?'+':''}${fmt(s.average_r)}R`}/></div>
      <div className="flex flex-wrap gap-2 items-center"><Badge variant={Number(s.average_r??0)>0?'green':Number(s.average_r??0)<0?'red':'default'}>{Number(s.average_r??0)>0?'OPTION EDGE CANDIDATE':'NO PROVEN OPTION EDGE'}</Badge><span className="text-xs text-slate-500">Max drawdown {fmt(s.max_drawdown_r)}R · Strategy {String(result.strategy??strategy)}</span></div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-2 text-left">Trade</th><th>Action</th><th>Contract</th><th>Entry</th><th>SL</th><th>T1</th><th>Outcome</th><th>R</th><th>Underlying R</th></tr></thead><tbody>{(result.trades??[]).map((t:any,i:number)=><tr key={`${String(t.symbol)}-${String(t.entry_at)}-${i}`} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2"><b>{String(t.symbol??'—')}</b><div className="text-[10px] text-slate-500">{t.entry_at?new Date(String(t.entry_at)).toLocaleString('en-IN'):'—'}</div></td><td className="text-center">{String(t.action??'—')}</td><td className="text-center">{String(t.option_contract??'—')}</td><td className="text-center">₹{fmt(t.option_entry)}</td><td className="text-center">₹{fmt(t.option_stop)}</td><td className="text-center">₹{fmt(t.option_target1)}</td><td className="text-center"><Badge variant={t.outcome==='SL'?'red':t.outcome==='AMBIGUOUS'?'amber':'green'}>{String(t.outcome??'—')}</Badge></td><td className="text-center font-semibold">{fmt(t.r_multiple)}R</td><td className="text-center">{fmt(t.underlying_r_multiple)}R</td></tr>)}</tbody></table></div>
      {((result.errors?.length??0)+(result.research_errors?.length??0)>0)&&<div className="rounded-lg border border-amber-200 p-3 text-xs text-amber-700">{(result.errors?.length??0)+(result.research_errors?.length??0)} data/contract/replay errors occurred. They are excluded rather than fabricated.</div>}
      <p className="text-xs text-slate-500">This is still research. A positive result must survive another symbol/time sample and trading costs before any live AlphaPilot rule changes.</p>
    </>}
  </CardBody></Card>
}
function Stat({l,v}:{l:string;v:string}){return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="text-[11px] text-slate-500">{l}</p><p className="text-lg font-bold mt-1">{v}</p></div>}
