import { useMemo, useState } from 'react';
import { Play, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui';
import { runTruePremiumBacktest, type PremiumBacktestResponse } from '@/lib/fnoPremiumBacktestApi';

function offset(days:number){const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)}
function fmt(v:unknown,d=2){const n=Number(v);return Number.isFinite(n)?n.toFixed(d):'—'}

export function FnoPremiumBacktest(){
  const [symbolsText,setSymbolsText]=useState('RELIANCE,SBIN,AXISBANK');
  const [start,setStart]=useState(offset(10));
  const [end,setEnd]=useState(offset(1));
  const [expiry,setExpiry]=useState('');
  const [rr,setRr]=useState('1.5');
  const [entryBefore,setEntryBefore]=useState('');
  const [maxTrades,setMaxTrades]=useState('20');
  const [running,setRunning]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [result,setResult]=useState<PremiumBacktestResponse|null>(null);
  const symbols=useMemo(()=>symbolsText.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean).slice(0,12),[symbolsText]);

  async function run(){
    if(!symbols.length||!start||!end||!expiry){setError('Enter symbols, start date, end date and the expiry to test.');return}
    if(end<start){setError('End date must be on or after start date.');return}
    setRunning(true);setError(null);setResult(null);
    try{
      setResult(await runTruePremiumBacktest({symbols,start_date:start,end_date:end,expiry,min_risk_reward:Number(rr)||1.5,entry_before:entryBefore||null,max_trades:Math.max(1,Math.min(Number(maxTrades)||20,100))}));
    }catch(e){setError(e instanceof Error?e.message:'True premium backtest failed.')}finally{setRunning(false)}
  }

  const s=result?.summary??{};
  return <Card><CardHeader title="True F&O Premium Backtest" subtitle="Core strategy test: historical AlphaPilot signals replayed through actual Groww option-premium OHLC. No live rules are changed." action={<ShieldCheck size={18} className="text-emerald-500"/>}/><CardBody className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2 items-end">
      <Input label="Symbols" value={symbolsText} onChange={setSymbolsText}/>
      <Input label="Start date" type="date" value={start} onChange={setStart}/>
      <Input label="End date" type="date" value={end} onChange={setEnd}/>
      <Input label="Expiry" type="date" value={expiry} onChange={setExpiry}/>
      <Input label="Min R:R" type="number" value={rr} onChange={setRr}/>
      <Input label="Entry before" value={entryBefore} onChange={setEntryBefore} placeholder="e.g. 12:00"/>
      <Input label="Max trades" type="number" value={maxTrades} onChange={setMaxTrades}/>
    </div>
    <div className="flex items-center justify-between gap-3 flex-wrap"><p className="text-[11px] text-slate-500">Use one listed expiry that covers the selected historical window. Start small (3–5 symbols, ≤20 trades) to protect Groww/Render request limits.</p><Button variant="primary" onClick={run} disabled={running||!symbols.length}><Play size={14} className="inline mr-1"/>{running?'Running true premium replay…':'Run True Premium Backtest'}</Button></div>
    {error&&<div className="rounded-lg border border-red-200 p-3 text-sm text-red-600">{error}</div>}
    {result&&<>
      <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
        <Stat l="Trades" v={String(s.trades??0)}/><Stat l="Wins" v={String(s.wins??0)}/><Stat l="Losses" v={String(s.losses??0)}/><Stat l="Ambiguous" v={String(s.ambiguous??0)}/><Stat l="Win rate" v={`${fmt(s.win_rate,1)}%`}/><Stat l="Total R" v={`${Number(s.total_r??0)>0?'+':''}${fmt(s.total_r)}R`}/><Stat l="Avg R" v={`${Number(s.average_r??0)>0?'+':''}${fmt(s.average_r)}R`}/>
      </div>
      <div className="flex flex-wrap gap-2 items-center"><Badge variant={Number(s.average_r??0)>0?'green':Number(s.average_r??0)<0?'red':'default'}>{Number(s.average_r??0)>0?'POSITIVE EXPECTANCY':'NO PROVEN EDGE'}</Badge><span className="text-xs text-slate-500">Max drawdown {fmt(s.max_drawdown_r)}R · Expiry {String(result.expiry??expiry)}</span></div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-2 text-left">Trade</th><th>Signal</th><th>Contract</th><th>Entry</th><th>SL</th><th>T1</th><th>Outcome</th><th>R</th><th>MFE</th><th>MAE</th></tr></thead><tbody>{(result.trades??[]).map((t,i)=><tr key={`${String(t.symbol)}-${String(t.timestamp)}-${i}`} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2"><b>{String(t.symbol??'—')}</b><div className="text-[10px] text-slate-500">{t.timestamp?new Date(String(t.timestamp)).toLocaleString('en-IN'):'—'}</div></td><td className="text-center">{String(t.action??'—')}<div className="text-[10px] text-slate-500">α {fmt(t.mtf_alpha,1)}</div></td><td className="text-center">{String(t.option_contract??`${t.strike??'—'} ${t.option_type??''}`)}</td><td className="text-center">₹{fmt(t.option_entry)}</td><td className="text-center">₹{fmt(t.option_stop)}</td><td className="text-center">₹{fmt(t.option_target1)}</td><td className="text-center"><Badge variant={t.outcome==='SL'?'red':t.outcome==='AMBIGUOUS'?'amber':'green'}>{String(t.outcome??'—')}</Badge></td><td className="text-center font-semibold">{fmt(t.r_multiple)}R</td><td className="text-center">{fmt(t.mfe_r)}R</td><td className="text-center">{fmt(t.mae_r)}R</td></tr>)}</tbody></table></div>
      {(result.errors?.length??0)>0&&<div className="rounded-lg border border-amber-200 p-3 text-xs text-amber-700">{result.errors!.length} symbol/contract errors occurred. These are excluded from expectancy rather than silently converted into trades.</div>}
      <p className="text-xs text-slate-500">This is the path we use to judge the strategy. We will not tune live AlphaPilot rules from a tiny sample; first build a meaningful historical sample, then test any improvement on untouched data.</p>
    </>}
  </CardBody></Card>
}
function Stat({l,v}:{l:string;v:string}){return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="text-[11px] text-slate-500">{l}</p><p className="text-lg font-bold mt-1">{v}</p></div>}
