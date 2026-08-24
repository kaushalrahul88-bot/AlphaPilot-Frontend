import { useMemo, useState } from 'react';
import { Play, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui';
import { runTruePremiumBacktest, type PremiumBacktestResponse, type PremiumBacktestTrade } from '@/lib/fnoPremiumBacktestApi';

function offset(days:number){const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)}
function fmt(v:unknown,d=2){const n=Number(v);return Number.isFinite(n)?n.toFixed(d):'—'}
function scenarioSummary(result:PremiumBacktestResponse|null,key:string){
  const rows=(result?.trades??[]).map(t=>((t as any).target_scenarios?.[key])).filter(Boolean);
  const resolved=rows.filter((x:any)=>Number.isFinite(Number(x.r_multiple)));
  const ambiguous=rows.filter((x:any)=>x.ambiguous).length;
  const total=resolved.reduce((a:number,x:any)=>a+Number(x.r_multiple),0);
  const wins=resolved.filter((x:any)=>Number(x.r_multiple)>0).length;
  return {trades:resolved.length,wins,ambiguous,total,avg:resolved.length?total/resolved.length:0,winRate:resolved.length?wins/resolved.length*100:0};
}
function tradeHour(t:PremiumBacktestTrade){if(!t.timestamp)return null;const d=new Date(String(t.timestamp));if(Number.isNaN(d.getTime()))return null;return d.getHours()+d.getMinutes()/60}
function subsetSummary(rows:PremiumBacktestTrade[],scenario?:string){
  const vals=rows.map(t=>scenario?Number((t as any).target_scenarios?.[scenario]?.r_multiple):Number(t.r_multiple)).filter(Number.isFinite);
  const wins=vals.filter(x=>x>0).length,total=vals.reduce((a,b)=>a+b,0);
  return {trades:vals.length,wins,total,avg:vals.length?total/vals.length:0,winRate:vals.length?wins/vals.length*100:0};
}
function diagnosticRows(result:PremiumBacktestResponse|null){
  const rows=result?.trades??[];
  const groups=[
    {label:'BUY CE only',test:(t:PremiumBacktestTrade)=>t.action==='BUY CE'},
    {label:'BUY PE only',test:(t:PremiumBacktestTrade)=>t.action==='BUY PE'},
    {label:'Before 10:30',test:(t:PremiumBacktestTrade)=>{const h=tradeHour(t);return h!=null&&h<10.5}},
    {label:'10:30–12:00',test:(t:PremiumBacktestTrade)=>{const h=tradeHour(t);return h!=null&&h>=10.5&&h<12}},
    {label:'12:00 or later',test:(t:PremiumBacktestTrade)=>{const h=tradeHour(t);return h!=null&&h>=12}},
    {label:'Premium below ₹10',test:(t:PremiumBacktestTrade)=>Number(t.option_entry)<10},
    {label:'Premium ₹10–₹30',test:(t:PremiumBacktestTrade)=>Number(t.option_entry)>=10&&Number(t.option_entry)<=30},
    {label:'Premium above ₹30',test:(t:PremiumBacktestTrade)=>Number(t.option_entry)>30},
  ];
  return groups.map(g=>{const subset=rows.filter(g.test);return {label:g.label,baseline:subsetSummary(subset),target05:subsetSummary(subset,'0.5R')}});
}

export function FnoPremiumBacktest(){
  const [symbolsText,setSymbolsText]=useState('RELIANCE,SBIN,AXISBANK,HDFCBANK,ICICIBANK,TATASTEEL,HINDALCO,ONGC,INFY,TCS');
  const [start,setStart]=useState(offset(10));
  const [end,setEnd]=useState(offset(1));
  const [expiry,setExpiry]=useState('');
  const [autoExpiry,setAutoExpiry]=useState(true);
  const [rr,setRr]=useState('1.5');
  const [entryBefore,setEntryBefore]=useState('');
  const [maxTrades,setMaxTrades]=useState('50');
  const [running,setRunning]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [result,setResult]=useState<PremiumBacktestResponse|null>(null);
  const symbols=useMemo(()=>symbolsText.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean).slice(0,12),[symbolsText]);

  async function run(){
    if(!symbols.length||!start||!end){setError('Enter symbols, start date and end date.');return}
    if(!autoExpiry&&!expiry){setError('Choose an expiry or enable Auto Expiry.');return}
    if(end<start){setError('End date must be on or after start date.');return}
    setRunning(true);setError(null);setResult(null);
    try{setResult(await runTruePremiumBacktest({symbols,start_date:start,end_date:end,expiry:autoExpiry?null:expiry,min_risk_reward:Number(rr)||1.5,entry_before:entryBefore||null,max_trades:Math.max(1,Math.min(Number(maxTrades)||50,50))}));}
    catch(e){setError(e instanceof Error?e.message:'True premium backtest failed.')}finally{setRunning(false)}
  }

  const s=result?.summary??{};
  const expiryText=result?.expiry_mode==='AUTO_NEAREST_LISTED'?`Auto · ${(result.expiries_used??[]).join(', ')||'no expiry resolved'}`:String(result?.expiry ?? (expiry || '—'));
  const targetScenarios=['0.5R','1.0R','1.5R','2.0R'].map(k=>({key:k,...scenarioSummary(result,k)}));
  const hasTargetScenarios=targetScenarios.some(x=>x.trades>0||x.ambiguous>0);
  const diagnostics=diagnosticRows(result);

  return <Card><CardHeader title="True F&O Premium Backtest" subtitle="Core strategy test: historical AlphaPilot signals replayed through actual Groww option-premium OHLC. No live rules are changed." action={<ShieldCheck size={18} className="text-emerald-500"/>}/><CardBody className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2 items-end"><Input label="Symbols" value={symbolsText} onChange={setSymbolsText}/><Input label="Start date" type="date" value={start} onChange={setStart}/><Input label="End date" type="date" value={end} onChange={setEnd}/><div><label className="text-xs font-medium">Expiry mode</label><select className="block mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2.5 text-sm" value={autoExpiry?'AUTO':'FIXED'} onChange={e=>setAutoExpiry(e.target.value==='AUTO')}><option value="AUTO">Auto nearest expiry</option><option value="FIXED">Fixed expiry</option></select></div>{autoExpiry?<div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2.5"><p className="text-xs text-slate-500">Expiry</p><p className="text-sm font-semibold">Auto per trade</p></div>:<Input label="Expiry" type="date" value={expiry} onChange={setExpiry}/>}<Input label="Min R:R" type="number" value={rr} onChange={setRr}/><Input label="Max trades" type="number" value={maxTrades} onChange={setMaxTrades}/></div>
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end"><Input label="Entry before (optional)" value={entryBefore} onChange={setEntryBefore} placeholder="e.g. 12:00"/><Button variant="primary" onClick={run} disabled={running||!symbols.length}><Play size={14} className="inline mr-1"/>{running?'Running true premium replay…':'Run True Premium Backtest'}</Button></div>
    <p className="text-[11px] text-slate-500">Auto Expiry selects the nearest Groww-listed option expiry on or after each historical signal date. Contracts absent from Groww's current instrument master are reported as errors, never invented.</p>
    {error&&<div className="rounded-lg border border-red-200 p-3 text-sm text-red-600">{error}</div>}
    {result&&<>
      <div className="grid grid-cols-2 md:grid-cols-7 gap-2"><Stat l="Trades" v={String(s.trades??0)}/><Stat l="Wins" v={String(s.wins??0)}/><Stat l="Losses" v={String(s.losses??0)}/><Stat l="Ambiguous" v={String(s.ambiguous??0)}/><Stat l="Win rate" v={`${fmt(s.win_rate,1)}%`}/><Stat l="Total R" v={`${Number(s.total_r??0)>0?'+':''}${fmt(s.total_r)}R`}/><Stat l="Avg R" v={`${Number(s.average_r??0)>0?'+':''}${fmt(s.average_r)}R`}/></div>
      <div className="flex flex-wrap gap-2 items-center"><Badge variant={Number(s.average_r??0)>0?'green':Number(s.average_r??0)<0?'red':'default'}>{Number(s.average_r??0)>0?'POSITIVE EXPECTANCY':'NO PROVEN EDGE'}</Badge><span className="text-xs text-slate-500">Max drawdown {fmt(s.max_drawdown_r)}R · Expiry {expiryText}</span></div>
      {hasTargetScenarios&&<div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-sm font-semibold">Exact target-efficiency comparison</p><p className="text-[11px] text-slate-500 mt-1">Same entries and same premium SL; only the full-exit target changes. Each scenario is replayed candle-by-candle on the actual 5-minute option path.</p></div><Badge variant="blue">RESEARCH ONLY</Badge></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">{targetScenarios.map(x=><div key={x.key} className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3"><p className="text-xs font-semibold">Target {x.key}</p><p className={`text-lg font-bold mt-1 ${x.avg>0?'text-emerald-600':x.avg<0?'text-red-600':''}`}>{x.avg>=0?'+':''}{x.avg.toFixed(2)}R avg</p><p className="text-[11px] text-slate-500">{x.winRate.toFixed(1)}% wins · {x.total>=0?'+':''}{x.total.toFixed(2)}R total</p><p className="text-[10px] text-slate-500 mt-1">{x.trades} resolved · {x.ambiguous} ambiguous</p></div>)}</div></div>}
      {hasTargetScenarios&&<div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-sm font-semibold">Focused baseline diagnostics</p><p className="text-[11px] text-slate-500 mt-1">No new market requests: this re-slices the exact same replayed trades to test only the next core hypotheses—direction, entry time and premium band. Baseline uses the current plan; 0.5R uses the exact target replay above.</p></div><Badge variant="blue">DEVELOPMENT SAMPLE</Badge></div><div className="overflow-x-auto mt-3"><table className="w-full text-xs"><thead><tr className="border-b border-slate-200 dark:border-slate-800"><th className="text-left p-2">Filter</th><th>Trades</th><th>Current avg R</th><th>Current win %</th><th>0.5R avg R</th><th>0.5R win %</th></tr></thead><tbody>{diagnostics.map(d=><tr key={d.label} className="border-b border-slate-100 dark:border-slate-900"><td className="p-2 font-medium">{d.label}</td><td className="text-center">{d.baseline.trades}</td><td className={`text-center font-semibold ${d.baseline.avg>0?'text-emerald-600':d.baseline.avg<0?'text-red-600':''}`}>{d.baseline.avg>=0?'+':''}{d.baseline.avg.toFixed(2)}R</td><td className="text-center">{d.baseline.winRate.toFixed(1)}%</td><td className={`text-center font-semibold ${d.target05.avg>0?'text-emerald-600':d.target05.avg<0?'text-red-600':''}`}>{d.target05.avg>=0?'+':''}{d.target05.avg.toFixed(2)}R</td><td className="text-center">{d.target05.winRate.toFixed(1)}%</td></tr>)}</tbody></table></div><p className="text-[10px] text-slate-500 mt-2">Treat rows with very few trades as descriptive only. A positive subgroup here is a hypothesis to test on a larger development sample—not permission to change the live scanner.</p></div>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-2 text-left">Trade</th><th>Signal</th><th>Expiry</th><th>Contract</th><th>Entry</th><th>SL</th><th>T1</th><th>Outcome</th><th>R</th><th>MFE</th><th>MAE</th></tr></thead><tbody>{(result.trades??[]).map((t,i)=><tr key={`${String(t.symbol)}-${String(t.timestamp)}-${i}`} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2"><b>{String(t.symbol??'—')}</b><div className="text-[10px] text-slate-500">{t.timestamp?new Date(String(t.timestamp)).toLocaleString('en-IN'):'—'}</div></td><td className="text-center">{String(t.action??'—')}<div className="text-[10px] text-slate-500">α {fmt(t.mtf_alpha,1)}</div></td><td className="text-center">{String(t.expiry??'—')}</td><td className="text-center">{String(t.option_contract??`${t.strike??'—'} ${t.option_type??''}`)}</td><td className="text-center">₹{fmt(t.option_entry)}</td><td className="text-center">₹{fmt(t.option_stop)}</td><td className="text-center">₹{fmt(t.option_target1)}</td><td className="text-center"><Badge variant={t.outcome==='SL'?'red':t.outcome==='AMBIGUOUS'?'amber':'green'}>{String(t.outcome??'—')}</Badge></td><td className="text-center font-semibold">{fmt(t.r_multiple)}R</td><td className="text-center">{fmt(t.mfe_r)}R</td><td className="text-center">{fmt(t.mae_r)}R</td></tr>)}</tbody></table></div>
      {(result.errors?.length??0)>0&&<div className="rounded-lg border border-amber-200 p-3 text-xs text-amber-700">{result.errors!.length} expiry/contract/replay errors occurred. These are excluded from expectancy rather than silently converted into trades.</div>}
      <p className="text-xs text-slate-500">Target scenarios and subgroup rows are research diagnostics only. We will not alter live AlphaPilot until a candidate survives a larger development sample and an untouched out-of-sample period.</p>
    </>}
  </CardBody></Card>
}
function Stat({l,v}:{l:string;v:string}){return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="text-[11px] text-slate-500">{l}</p><p className="text-lg font-bold mt-1">{v}</p></div>}
