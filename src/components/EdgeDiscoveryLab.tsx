import { useMemo,useState } from 'react';
import { Microscope,Play } from 'lucide-react';
import { Badge,Button,Card,CardBody,CardHeader,Input } from '@/components/ui';
import { runEdgeDiscovery,type EdgeBucket,type EdgeDiscoveryResponse } from '@/lib/edgeDiscoveryApi';

function offset(days:number){const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)}
function fmt(v:unknown,d=1){const n=Number(v);return Number.isFinite(n)?n.toFixed(d):'—'}
function title(k:string){return k.replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase())}

function BucketTable({name,rows}:{name:string;rows:EdgeBucket[]}){
 return <div><p className="text-sm font-semibold mb-2">{title(name)}</p><div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-2 text-left">Bucket</th><th>Obs</th><th>0.5R hit</th><th>1.0R hit</th><th>1.5R hit</th><th>Avg MFE</th><th>Avg MAE</th></tr></thead><tbody>{rows.map((r,i)=><tr key={`${name}-${r.bucket}-${i}`} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2 font-semibold">{r.bucket}</td><td className="text-center">{r.observations}</td><td className="text-center">{fmt(r.hit_0_5r_pct)}%</td><td className="text-center font-semibold">{fmt(r.hit_1_0r_pct)}%</td><td className="text-center">{fmt(r.hit_1_5r_pct)}%</td><td className="text-center">{fmt(r.avg_mfe_r,2)}R</td><td className="text-center">{fmt(r.avg_mae_r,2)}R</td></tr>)}</tbody></table></div></div>
}

export function EdgeDiscoveryLab(){
 const [symbolsText,setSymbolsText]=useState('RELIANCE,SBIN,AXISBANK,HDFCBANK,ICICIBANK,TATASTEEL,HINDALCO,ONGC,INFY,TCS');
 const [start,setStart]=useState(offset(10));const [end,setEnd]=useState(offset(1));const [maxObs,setMaxObs]=useState('600');const [cost,setCost]=useState('10');const [sampleBars,setSampleBars]=useState('3');
 const [running,setRunning]=useState(false);const [error,setError]=useState<string|null>(null);const [result,setResult]=useState<EdgeDiscoveryResponse|null>(null);
 const symbols=useMemo(()=>symbolsText.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean).slice(0,20),[symbolsText]);
 async function run(){if(!symbols.length||!start||!end){setError('Enter symbols and dates.');return}if(end<start){setError('End date must be on or after start date.');return}setRunning(true);setError(null);setResult(null);try{setResult(await runEdgeDiscovery({symbols,start_date:start,end_date:end,max_observations:Math.max(30,Math.min(Number(maxObs)||600,1500)),round_trip_cost_bps:Math.max(0,Number(cost)||0),sample_every_bars:Math.max(1,Math.min(Number(sampleBars)||3,12))}))}catch(e){setError(e instanceof Error?e.message:'Edge discovery failed.')}finally{setRunning(false)}}
 const baseline=result?.baseline??{};const reports=result?.feature_reports??{};
 return <Card><CardHeader title="Edge Discovery Lab v1" subtitle="Studies what market and option-premium conditions existed before successful option expansion instead of starting from a preselected strategy." action={<Microscope size={18} className="text-violet-500"/>}/><CardBody className="space-y-4">
 <div className="flex gap-2 flex-wrap"><Badge variant="blue">DISCOVERY</Badge><Badge variant="default">RESEARCH ONLY</Badge><Badge variant="default">FIXED BUCKETS</Badge><Badge variant="default">PRODUCTION UNCHANGED</Badge></div>
 <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end"><Input label="Symbols" value={symbolsText} onChange={setSymbolsText}/><Input label="Start date" type="date" value={start} onChange={setStart}/><Input label="End date" type="date" value={end} onChange={setEnd}/><Input label="Max observations" type="number" value={maxObs} onChange={setMaxObs}/><Input label="Round-trip cost (bps)" type="number" value={cost} onChange={setCost}/></div>
 <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-end"><Input label="Sample every N bars" type="number" value={sampleBars} onChange={setSampleBars}/><div className="flex justify-end"><Button variant="primary" onClick={run} disabled={running}><Play size={14} className="inline mr-1"/>{running?'Discovering edge conditions…':'Run Edge Discovery'}</Button></div></div>
 <p className="text-[11px] text-slate-500">Each observation freezes the information available at that 5-minute timestamp, then labels whether the option later reaches +0.5R, +1.0R or +1.5R before its stop. This is descriptive research, not a trading signal.</p>
 {error&&<div className="rounded-lg border border-red-200 p-3 text-sm text-red-600">{error}</div>}
 {result&&<><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div className="rounded-lg border p-3"><p className="text-xs text-slate-500">Observations</p><p className="text-lg font-bold">{baseline.observations??0}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-slate-500">0.5R before stop</p><p className="text-lg font-bold">{fmt(baseline.hit_0_5r_before_stop_pct)}%</p></div><div className="rounded-lg border p-3"><p className="text-xs text-slate-500">1.0R before stop</p><p className="text-lg font-bold">{fmt(baseline.hit_1_0r_before_stop_pct)}%</p></div><div className="rounded-lg border p-3"><p className="text-xs text-slate-500">1.5R before stop</p><p className="text-lg font-bold">{fmt(baseline.hit_1_5r_before_stop_pct)}%</p></div></div>
 <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">{Object.entries(reports).map(([name,rows])=><BucketTable key={name} name={name} rows={rows??[]}/>)}</div>
 {(result.errors?.length??0)>0&&<div className="rounded-lg border border-amber-200 p-3 text-xs text-amber-700">{result.errors!.length} contract/data errors were excluded rather than fabricated.</div>}
 <p className="text-xs text-slate-500">Do not turn the best-looking bucket into a live rule. First identify repeated conditions, freeze a candidate definition, then test it on untouched symbols and dates.</p></>}
 </CardBody></Card>
}
