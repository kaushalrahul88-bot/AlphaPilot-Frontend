import { useMemo } from 'react';
import { Badge, Card, CardBody, CardHeader } from '@/components/ui';
import type { ValidationRecord } from '@/lib/liveValidation';

type Props = { records: ValidationRecord[] };
type Scenario = { name: string; samples: number; avgR: number; netR: number; deltaR: number; improved: number; worsened: number; unchanged: number };

function realisedR(r: ValidationRecord) {
  const e=Number(r.option_entry), s=Number(r.option_stop), t=Number(r.option_target1), risk=e-s;
  if(![e,s,t,risk].every(Number.isFinite)||risk<=0) return null;
  if(r.status==='STOP_HIT') return -1;
  if(r.status==='TARGET1_HIT'||r.status==='TARGET2_HIT') return (t-e)/risk;
  return null;
}
function scenarioR(r:ValidationRecord,kind:'HALF_EXIT'|'HALF_PARTIAL'|'BE_HALF'|'BE_ONE'){
  const base=realisedR(r), mfe=Number(r.mfe_r);
  if(base==null||!Number.isFinite(mfe)) return null;
  if(kind==='HALF_EXIT') return mfe>=.5?.5:base;
  if(kind==='HALF_PARTIAL') return mfe>=.5?.25+.5*base:base;
  // Excursion observations are polling-based, so these are deliberately conservative
  // counterfactuals rather than claims about exact intraminute path ordering.
  if(kind==='BE_HALF') return base<0&&mfe>=.5?0:base;
  if(kind==='BE_ONE') return base<0&&mfe>=1?0:base;
  return base;
}
function summarize(name:string,rows:ValidationRecord[],kind?:'HALF_EXIT'|'HALF_PARTIAL'|'BE_HALF'|'BE_ONE'):Scenario{
  const pairs=rows.map(r=>{const b=realisedR(r),v=kind?scenarioR(r,kind):b;return b==null||v==null?null:{b,v,d:v-b}}).filter((x):x is {b:number;v:number;d:number}=>Boolean(x));
  const vals=pairs.map(x=>x.v), ds=pairs.map(x=>x.d), eps=1e-9;
  return {name,samples:vals.length,avgR:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0,netR:vals.reduce((a,b)=>a+b,0),deltaR:ds.length?ds.reduce((a,b)=>a+b,0)/ds.length:0,improved:ds.filter(x=>x>eps).length,worsened:ds.filter(x=>x<-eps).length,unchanged:ds.filter(x=>Math.abs(x)<=eps).length};
}
function evidence(s:Scenario){if(s.samples>=20&&s.deltaR>=.10&&s.improved>s.worsened)return{label:'REVIEW CANDIDATE',variant:'green' as const};if(s.samples>=5&&s.deltaR>=.05&&s.improved>s.worsened)return{label:'EARLY CANDIDATE',variant:'blue' as const};return{label:'NO CONCLUSION',variant:'default' as const}}
export function FnoManagementSimulation({records}:Props){
  const resolved=useMemo(()=>records.filter(r=>r.status==='STOP_HIT'||r.status==='TARGET1_HIT'||r.status==='TARGET2_HIT'),[records]);
  const scenarios=useMemo(()=>[
    summarize('Frozen Plan',resolved),
    summarize('Full Exit at +0.50R',resolved,'HALF_EXIT'),
    summarize('50% at +0.50R, Rest Frozen',resolved,'HALF_PARTIAL'),
    summarize('BE after observed +0.50R',resolved,'BE_HALF'),
    summarize('BE after observed +1.00R',resolved,'BE_ONE'),
  ],[resolved]);
  const usable=scenarios[0]?.samples??0;
  return <Card><CardHeader title="F&O Management Simulation" subtitle="Analytics-only counterfactuals using saved realised outcomes plus observed option-premium MFE. No live rule is changed." action={<Badge variant={usable>=30?'green':usable>=10?'blue':'default'}>{usable>=30?'USABLE SAMPLE':usable>=10?'EARLY SIGNAL':'INSUFFICIENT SAMPLE'}</Badge>}/><CardBody className="space-y-3">
    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">{scenarios.map((s,i)=><div key={s.name} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><div className="flex items-start justify-between gap-2"><b className="text-xs">{s.name}</b>{i>0&&<Badge variant={s.deltaR>0?'green':s.deltaR<0?'red':'default'}>{s.deltaR>=0?'+':''}{s.deltaR.toFixed(2)}R</Badge>}</div><p className="text-lg font-bold mt-1">{s.avgR.toFixed(2)}R</p><p className="text-[11px] text-slate-500">Avg R · Net {s.netR.toFixed(2)}R · {s.samples} matched</p>{i>0&&<><p className="text-[11px] text-slate-500 mt-1">{s.improved} improved · {s.worsened} worsened · {s.unchanged} unchanged</p><div className="mt-2"><Badge variant={evidence(s).variant}>{evidence(s).label}</Badge></div></>}</div>)}</div>
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-500"><b>Important limitation:</b> MFE comes from roughly one-minute option-LTP observations, not tick-perfect historical candles. The breakeven scenarios therefore answer “what if a protective rule had been available after the observed threshold?”; they do not assert exact intraminute sequencing. Promotion requires later forward/out-of-sample validation.</div>
    <p className="text-xs text-slate-500">Evidence gate: EARLY requires ≥5 matched trades, ≥+0.05R average improvement and more improved than worsened; REVIEW requires ≥20, ≥+0.10R and the same consistency condition. Nothing here changes option entry, premium stop, targets, or execution readiness.</p>
  </CardBody></Card>
}
