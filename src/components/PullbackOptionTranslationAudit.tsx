import { Activity,LockKeyhole } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { PullbackShortOptionH1Trade } from '@/lib/pullbackShortOptionH1Api';

type Metrics={trades:number;wins:number;winRate:number;totalR:number;averageR:number;profitFactor:number|null;unbounded:boolean};
type GroupRow={label:string;metrics:Metrics};

function number(value:unknown){return typeof value==='number'&&Number.isFinite(value)?value:null}
function adjustedR(trade:PullbackShortOptionH1Trade){return number(trade.cost_adjusted_r)??number(trade.r_multiple)}
function fmtR(value:number){return `${value>0?'+':''}${value.toFixed(3)}R`}
function fmtPct(value:number){return `${value.toFixed(1)}%`}
function fmtPf(metrics:Metrics){return metrics.unbounded?'∞':metrics.profitFactor==null?'—':metrics.profitFactor.toFixed(2)}
function metrics(trades:PullbackShortOptionH1Trade[]):Metrics{
  const values=trades.map(adjustedR).filter((value):value is number=>value!=null);
  const wins=values.filter(value=>value>0),losses=values.filter(value=>value<0);
  const grossWin=wins.reduce((sum,value)=>sum+value,0),grossLoss=Math.abs(losses.reduce((sum,value)=>sum+value,0));
  const totalR=values.reduce((sum,value)=>sum+value,0);
  return{trades:values.length,wins:wins.length,winRate:values.length?wins.length/values.length*100:0,totalR,averageR:values.length?totalR/values.length:0,profitFactor:grossLoss?grossWin/grossLoss:null,unbounded:Boolean(values.length&&grossLoss===0&&grossWin>0)};
}
function groups(trades:PullbackShortOptionH1Trade[],labelFor:(trade:PullbackShortOptionH1Trade)=>string):GroupRow[]{
  const map=new Map<string,PullbackShortOptionH1Trade[]>();
  for(const trade of trades){const label=labelFor(trade);map.set(label,[...(map.get(label)||[]),trade])}
  return[...map.entries()].map(([label,sample])=>({label,metrics:metrics(sample)})).sort((a,b)=>b.metrics.trades-a.metrics.trades||a.label.localeCompare(b.label));
}
function dteBucket(trade:PullbackShortOptionH1Trade){const dte=number(trade.expiry_dte);if(dte==null)return'UNKNOWN';if(dte<=7)return'0–7 DTE';if(dte<=14)return'8–14 DTE';return'15–35 DTE'}
function premiumBucket(trade:PullbackShortOptionH1Trade){const premium=number(trade.option_entry);if(premium==null)return'UNKNOWN';if(premium<30)return'Below ₹30';if(premium<75)return'₹30–74.99';if(premium<150)return'₹75–149.99';return'₹150+'}
function strikeBucket(trade:PullbackShortOptionH1Trade){const strike=number(trade.strike),underlying=number(trade.underlying_entry);if(strike==null||underlying==null||underlying<=0)return'UNKNOWN';const distance=Math.abs(strike-underlying)/underlying*100;if(distance<=.25)return'≤0.25% from ATM';if(distance<=.75)return'0.26–0.75% from ATM';return'>0.75% from ATM'}
function timeBucket(trade:PullbackShortOptionH1Trade){const value=String(trade.entry_at||trade.signal_at||'').slice(11,16);if(!value)return'UNKNOWN';if(value<'10:30')return'Before 10:30';if(value<'12:00')return'10:30–11:59';return'12:00+'}

export function PullbackOptionTranslationAudit({trades}:{trades:PullbackShortOptionH1Trade[]}){
  const resolved=trades.filter(trade=>adjustedR(trade)!=null);
  const underlyingTarget=resolved.filter(trade=>trade.underlying_outcome==='TARGET');
  const underlyingStop=resolved.filter(trade=>trade.underlying_outcome==='SL');
  const underlyingOther=resolved.filter(trade=>!['TARGET','SL'].includes(String(trade.underlying_outcome||'')));
  const optionPositive=(sample:PullbackShortOptionH1Trade[])=>sample.filter(trade=>(adjustedR(trade)??0)>0).length;
  const translationFailures=underlyingTarget.filter(trade=>(adjustedR(trade)??0)<=0);
  const premiumOnlyWins=underlyingStop.filter(trade=>(adjustedR(trade)??0)>0);
  const knownUnderlying=underlyingTarget.length+underlyingStop.length;
  const knownTargetRate=knownUnderlying?underlyingTarget.length/knownUnderlying*100:0;
  const translationFailureRate=underlyingTarget.length?translationFailures.length/underlyingTarget.length*100:0;
  const option=metrics(resolved);
  const meanField=(field:'mfe_r'|'mae_r')=>{const values=resolved.map(trade=>number(trade[field])).filter((value):value is number=>value!=null);return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0};
  let assessment='INSUFFICIENT_LEDGER_FOR_TRANSLATION_AUDIT';
  if(resolved.length>=20){
    if(knownUnderlying>=20&&knownTargetRate<50&&translationFailureRate>=25)assessment='UNDERLYING_AND_PREMIUM_TRANSLATION_WEAKNESS';
    else if(knownUnderlying>=20&&knownTargetRate>=50&&translationFailureRate>=25)assessment='PREMIUM_TRANSLATION_DECAY';
    else if(knownUnderlying>=20&&knownTargetRate<50)assessment='PRIMARY_UNDERLYING_SETUP_WEAKNESS';
    else assessment='TRANSLATION_FAILURE_SOURCE_INCONCLUSIVE';
  }
  const matrix=[
    {label:'TARGET',sample:underlyingTarget},
    {label:'SL',sample:underlyingStop},
    {label:'EOD / other',sample:underlyingOther},
  ];
  return <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 p-4 space-y-4">
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3"><div><p className="font-semibold flex items-center gap-2"><Activity size={16} className="text-indigo-500"/>Underlying-to-Option Translation Audit v1</p><p className="text-xs text-slate-500 mt-1">Computed only from the saved closed H-1 trade ledger. It performs no API request, rerun, filtering, route selection or retuning.</p></div><div className="flex flex-wrap gap-2"><Badge variant="default">CLOSED H-1 LEDGER</Badge><Badge variant="default">NO RERUN</Badge><Badge variant="default">DESCRIPTIVE ONLY</Badge></div></div>

    <div className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs text-slate-500">Diagnostic assessment</p><p className="text-sm font-semibold mt-1">{assessment}</p></div><Badge variant="blue">NOT A STRATEGY GATE</Badge></div><p className="text-[11px] text-slate-500 mt-2">Known underlying target rate excludes EOD/other paths because the original closed ledger retained their outcome label but not their exact underlying EOD R. That limitation is shown rather than reconstructed after H-1.</p></div>

    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2"><AuditMetric label="Ledger trades" value={String(resolved.length)}/><AuditMetric label="Known target / SL" value={`${underlyingTarget.length} / ${underlyingStop.length}`}/><AuditMetric label="Known target rate" value={fmtPct(knownTargetRate)}/><AuditMetric label="PE win rate" value={fmtPct(option.winRate)}/><AuditMetric label="Translation failures" value={`${translationFailures.length} (${fmtPct(translationFailureRate)})`}/><AuditMetric label="Premium-only wins" value={String(premiumOnlyWins.length)}/><AuditMetric label="Average MFE" value={fmtR(meanField('mfe_r'))}/><AuditMetric label="Average MAE" value={fmtR(meanField('mae_r'))}/></div>

    <div><p className="text-sm font-semibold mb-2">Outcome translation matrix</p><div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-2 text-left">Underlying outcome</th><th>PE positive</th><th>PE non-positive</th><th>Total</th></tr></thead><tbody>{matrix.map(row=>{const positive=optionPositive(row.sample);return <tr key={row.label} className="border-t"><td className="p-2 font-semibold">{row.label}</td><td className="text-center">{positive}</td><td className="text-center">{row.sample.length-positive}</td><td className="text-center">{row.sample.length}</td></tr>})}</tbody></table></div></div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3"><Breakdown title="By expiry distance" rows={groups(resolved,dteBucket)}/><Breakdown title="By option premium paid" rows={groups(resolved,premiumBucket)}/><Breakdown title="By strike distance" rows={groups(resolved,strikeBucket)}/><Breakdown title="By entry time" rows={groups(resolved,timeBucket)}/><Breakdown title="By symbol" rows={groups(resolved,trade=>trade.symbol||'UNKNOWN')}/></div>

    <div><p className="text-sm font-semibold mb-2">Underlying TARGET → PE non-positive cases</p><div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-2 text-left">Signal</th><th>Symbol</th><th>PE outcome</th><th>Adjusted R</th><th>MFE</th><th>DTE</th></tr></thead><tbody>{translationFailures.slice(0,12).map((trade,index)=><tr className="border-t" key={`${trade.symbol}-${trade.signal_at}-${index}`}><td className="p-2 whitespace-nowrap">{String(trade.signal_at).replace('T',' ').slice(0,16)}</td><td className="text-center font-semibold">{trade.symbol}</td><td className="text-center">{trade.outcome||'—'}</td><td className="text-center">{fmtR(adjustedR(trade)??0)}</td><td className="text-center">{number(trade.mfe_r)==null?'—':fmtR(number(trade.mfe_r) as number)}</td><td className="text-center">{trade.expiry_dte??'—'}</td></tr>)}</tbody></table>{translationFailures.length===0&&<p className="p-3 text-xs text-slate-500">No known underlying TARGET converted into a non-positive PE result.</p>}</div></div>
    <p className="text-[11px] text-slate-500 flex items-start gap-1"><LockKeyhole size={12} className="mt-0.5 shrink-0"/>This audit explains the rejected candidate only. None of its DTE, premium, strike, time or symbol groups may be promoted as a filter from H-1.</p>
  </div>
}

function AuditMetric({label,value}:{label:string;value:string}){return <div className="rounded-lg border p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="text-sm font-bold mt-1">{value}</p></div>}
function Breakdown({title,rows}:{title:string;rows:GroupRow[]}){return <div><p className="text-sm font-semibold mb-2">{title}</p><div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-2 text-left">Group</th><th>Trades</th><th>Win</th><th>Avg R</th><th>PF</th></tr></thead><tbody>{rows.map(row=><tr className="border-t" key={row.label}><td className="p-2 font-semibold">{row.label}</td><td className="text-center">{row.metrics.trades}</td><td className="text-center">{fmtPct(row.metrics.winRate)}</td><td className="text-center">{fmtR(row.metrics.averageR)}</td><td className="text-center">{fmtPf(row.metrics)}</td></tr>)}</tbody></table></div></div>}
