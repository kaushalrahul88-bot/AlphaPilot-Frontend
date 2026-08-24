import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Circle, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { FNO_SCAN_EVENT, MTF_SCAN_EVENT, type FnoScanResponse } from '@/lib/alphaPilotApi';

const HEALTH_KEY = 'alphapilot.firstLive.healthConfirmed.v1';
const ARMED_KEY = 'alphapilot.monday-live-test.v1';

type Step = { label: string; done: boolean; note: string };

export function FirstLiveSessionChecklist(){
  const [open,setOpen]=useState(false);
  const [health,setHealth]=useState(()=>localStorage.getItem(HEALTH_KEY)==='true');
  const [mtfSeen,setMtfSeen]=useState(false);
  const [fresh,setFresh]=useState(false);
  const [sessionOpen,setSessionOpen]=useState(false);
  const [armed,setArmed]=useState(false);

  useEffect(()=>{
    const syncArmed=()=>{try{const raw=localStorage.getItem(ARMED_KEY);const sessions=raw?JSON.parse(raw):[];void sessions;setArmed(document.body.innerText.includes('ARMED'));}catch{setArmed(false)}};
    syncArmed();const timer=window.setInterval(syncArmed,1500);
    const onMtf=()=>setMtfSeen(true);
    const onFno=(event:Event)=>{const r=(event as CustomEvent<FnoScanResponse>).detail;if(!r)return;const status=String(r.market_session?.status??r.market_session?.phase??'').toUpperCase();setSessionOpen(status==='OPEN'||status==='CONTINUOUS');const stamps=Object.values(r.technical?.timeframes??{}).map((x:any)=>x?.latest_candle_at).filter(Boolean);if(stamps.length){const newest=Math.max(...stamps.map((s:any)=>new Date(s).getTime()));setFresh(Number.isFinite(newest)&&Date.now()-newest<20*60*1000)}};
    window.addEventListener(MTF_SCAN_EVENT,onMtf);window.addEventListener(FNO_SCAN_EVENT,onFno);
    return()=>{window.clearInterval(timer);window.removeEventListener(MTF_SCAN_EVENT,onMtf);window.removeEventListener(FNO_SCAN_EVENT,onFno)};
  },[]);

  const confirmHealth=()=>{localStorage.setItem(HEALTH_KEY,'true');setHealth(true)};
  const steps:Step[]=[
    {label:'System Health checked',done:health,note:'Confirm only after System Health shows critical checks passing.'},
    {label:'Monday Live Test armed',done:armed,note:'Arm immediately before the controlled universe scan.'},
    {label:'Executable NSE session detected',done:sessionOpen,note:'Execution must remain blocked outside the live session.'},
    {label:'Fresh intraday candles detected',done:fresh,note:'Historical candles may support indicators, but execution requires fresh data.'},
    {label:'New universe scan started',done:mtfSeen,note:'Wait for the complete 44/44 MTF run and all expected F&O confirmations.'},
  ];
  const done=steps.filter(s=>s.done).length;
  const ready=health&&armed&&sessionOpen&&fresh;
  return <Card><CardHeader title="First Live Session Checklist" subtitle="Operational guardrail for the first controlled live-market validation. Strategy parameters are unchanged." action={<div className="flex items-center gap-2"><Badge variant={ready?'green':'blue'}>{ready?'READY TO COMPLETE SCAN':`${done}/${steps.length}`}</Badge><Button size="sm" variant="ghost" onClick={()=>setOpen(v=>!v)}>{open?<ChevronUp size={14} className="inline mr-1"/>:<ChevronDown size={14} className="inline mr-1"/>}{open?'Collapse':'Expand'}</Button></div>}/>{open&&<CardBody className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">This checklist does not authorize a trade. AlphaPilot's backend execution-quality gates remain authoritative.</p>{!health&&<Button size="sm" variant="ghost" onClick={confirmHealth}><ShieldCheck size={13} className="inline mr-1"/>Confirm Health Passed</Button>}</div><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{steps.map(step=><div key={step.label} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex gap-2">{step.done?<CheckCircle2 size={17} className="text-emerald-500 shrink-0"/>:<Circle size={17} className="text-slate-400 shrink-0"/>}<div><p className="text-sm font-semibold">{step.label}</p><p className="text-xs text-slate-500 mt-0.5">{step.note}</p></div></div>)}</div>{ready&&!mtfSeen&&<p className="text-xs font-semibold text-emerald-600">Operational prerequisites are satisfied. Start one Scan F&O Universe run and let it finish without interruption.</p>}</CardBody>}</Card>;
}