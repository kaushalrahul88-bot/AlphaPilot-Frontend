import { useState } from 'react';
import { Activity, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { getCommodityProbe, scanCommodity, type CommodityProbeResponse, type CommodityScanResponse, type CommoditySymbol } from '@/lib/commodityApi';
import { CommodityNewsPanel } from '@/pages/CommodityNewsPanel';
import { CommodityOutcomeTracker } from '@/pages/CommodityOutcomeTracker';
import { CommodityValidationLog } from '@/pages/CommodityValidationLog';
import { CommodityDataRecorder } from '@/pages/CommodityDataRecorder';

const SYMBOLS: CommoditySymbol[] = ['CRUDEOIL', 'NATURALGAS'];

type ProbeState = { loading: boolean; result?: CommodityProbeResponse; error?: string };
type ScanState = { loading: boolean; result?: CommodityScanResponse; error?: string };

export function CommodityDiagnostics() {
  const [states, setStates] = useState<Record<CommoditySymbol, ProbeState>>({ CRUDEOIL: { loading: false }, NATURALGAS: { loading: false } });
  const [scans, setScans] = useState<Record<CommoditySymbol, ScanState>>({ CRUDEOIL: { loading: false }, NATURALGAS: { loading: false } });

  const runProbe = async (symbol: CommoditySymbol) => {
    setStates(prev => ({ ...prev, [symbol]: { loading: true } }));
    try { const result = await getCommodityProbe(symbol); setStates(prev => ({ ...prev, [symbol]: { loading: false, result } })); }
    catch (error) { setStates(prev => ({ ...prev, [symbol]: { loading: false, error: error instanceof Error ? error.message : 'Probe failed.' } })); }
  };
  const runBoth = async () => { await Promise.all(SYMBOLS.map(runProbe)); };
  const runScan = async (symbol: CommoditySymbol) => {
    setScans(prev => ({ ...prev, [symbol]: { loading: true } }));
    try { const result = await scanCommodity(symbol, 1.5); setScans(prev => ({ ...prev, [symbol]: { loading: false, result } })); }
    catch (error) { setScans(prev => ({ ...prev, [symbol]: { loading: false, error: error instanceof Error ? error.message : 'Commodity scan failed.' } })); }
  };

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3 flex-wrap"><div><h1 className="text-xl font-bold text-slate-900 dark:text-white">Commodity Diagnostics</h1><p className="text-sm text-slate-500">MCX CRUDEOIL and NATURALGAS futures through Groww.</p></div><Button variant="primary" onClick={() => void runBoth()}><RefreshCw size={15} className="inline mr-1.5"/>Probe Both</Button></div>

    <Card><CardHeader title="Commodity Phase 1" subtitle="Groww MCX data foundation plus separate commodity MTF scanner." action={<Badge variant="blue">MCX FUTURES</Badge>} /><CardBody><p className="text-xs text-slate-500">Commodity signals use 5m + 15m + 1h BUY/SELL logic with MCX-specific session, freshness and RSI-exhaustion gates. Commodity news is context only and does not override execution gates.</p></CardBody></Card>

    {SYMBOLS.map(symbol => <div key={symbol} className="space-y-3"><ProbeCard symbol={symbol} state={states[symbol]} onProbe={() => void runProbe(symbol)} /><ScanCard symbol={symbol} state={scans[symbol]} enabled={states[symbol].result?.ready_for_phase1===true} onScan={() => void runScan(symbol)} /><CommodityNewsPanel symbol={symbol} scanKey={scans[symbol].result?.market_session?.checked_at ?? null}/></div>)}

    <CommodityDataRecorder />
    <CommodityOutcomeTracker />
    <CommodityValidationLog />
  </div>;
}

function ProbeCard({ symbol, state, onProbe }: { symbol: CommoditySymbol; state: ProbeState; onProbe: () => void }) {
  const r = state.result; const contract = r?.contract ?? {}; const tradingSymbol = contract.trading_symbol ?? contract.groww_symbol ?? '—'; const candleCount = Number(r?.candle_count ?? (Array.isArray(r?.candles) ? r?.candles.length : 0)); const checks = r?.checks ?? {}; const contractOk = Boolean(checks.contract ?? r?.contract); const quoteOk = Boolean(checks.quote ?? r?.quote_ok ?? r?.quote); const candlesOk = Boolean(checks.candles ?? r?.candles_ok ?? candleCount > 0); const ready = r?.ready_for_phase1 === true;
  return <Card><CardHeader title={symbol} subtitle="Nearest liquid MCX futures contract capability probe." action={<div className="flex items-center gap-2"><Badge variant={ready ? 'green' : r ? 'red' : 'default'}>{ready ? 'PHASE 1 READY' : r ? 'NOT READY' : 'NOT TESTED'}</Badge><Button size="sm" variant="ghost" onClick={onProbe} disabled={state.loading}>{state.loading ? <RefreshCw size={14} className="inline mr-1 animate-spin"/> : <Activity size={14} className="inline mr-1"/>}{state.loading ? 'Probing…' : 'Run Probe'}</Button></div>} /><CardBody className="space-y-4">{state.error&&<div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/20 p-3 text-xs text-red-600">{state.error}</div>}<div className="grid grid-cols-2 md:grid-cols-5 gap-3"><Metric label="Contract" value={tradingSymbol}/><Metric label="Expiry" value={String(contract.expiry_date ?? contract.expiry ?? '—')}/><Metric label="Exchange" value={String(contract.exchange ?? 'MCX')}/><Metric label="Segment" value={String(contract.segment ?? 'COMMODITY')}/><Metric label="5m Candles" value={Number.isFinite(candleCount)?String(candleCount):'—'}/></div><div className="grid grid-cols-1 md:grid-cols-3 gap-2"><Check label="Contract resolution" ok={contractOk} tested={Boolean(r)}/><Check label="Groww live quote" ok={quoteOk} tested={Boolean(r)}/><Check label="Historical candles" ok={candlesOk} tested={Boolean(r)}/></div></CardBody></Card>;
}

function ScanCard({ symbol, state, enabled, onScan }: { symbol: CommoditySymbol; state: ScanState; enabled: boolean; onScan: () => void }) {
  const r=state.result; const action=r?.action ?? '—'; const ready=r?.execution_ready===true; const session=r?.market_session?.status ?? '—';
  return <Card><CardHeader title={`${symbol} · Commodity Scanner`} subtitle="5m + 15m + 1h technical confluence with MCX session/freshness gates." action={<div className="flex items-center gap-2"><Badge variant={ready?'green':r?'blue':'default'}>{r ? (ready?'EXECUTION READY':r.status) : 'AWAITING SCAN'}</Badge><Button size="sm" variant="primary" onClick={onScan} disabled={!enabled||state.loading}>{state.loading?<RefreshCw size={14} className="inline mr-1 animate-spin"/>:<Activity size={14} className="inline mr-1"/>}{state.loading?'Scanning…':'Run MTF Scan'}</Button></div>} /><CardBody className="space-y-4">{!enabled&&!r&&<p className="text-xs text-slate-500">Run the Phase 1 probe first. Scanner stays disabled until contract, quote and candles are confirmed.</p>}{state.error&&<div className="rounded-lg border border-red-200 dark:border-red-900 p-3 text-xs text-red-600">{state.error}</div>}{r&&<><div className="grid grid-cols-2 md:grid-cols-6 gap-3"><Metric label="Action" value={action}/><Metric label="Directional Strength" value={`${Number(r.alpha_score??0).toFixed(1)}/100`}/><Metric label="MCX Session" value={session}/><Metric label="Entry" value={money(r.entry)}/><Metric label="Stop" value={money(r.stop_loss)}/><Metric label="R:R" value={r.risk_reward?`${Number(r.risk_reward).toFixed(2)}:1`:'—'}/></div><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{['5m','15m','1h'].map(tf=>{const row=r.timeframes?.[tf]??{};return <div key={tf} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><div className="flex items-center justify-between gap-2"><b className="text-sm">{tf}</b><Badge variant={row.signal==='BUY'?'green':row.signal==='SELL'?'red':'default'}>{row.signal??'NO TRADE'}</Badge></div><p className="text-xs text-slate-500 mt-2">Raw Alpha {Number(row.alpha_score??0).toFixed(1)} · RSI {Number(row.rsi14??0).toFixed(1)}</p><p className="text-xs text-slate-500">{row.market_structure??'—'} · {row.fresh?'FRESH':'STALE/SNAPSHOT'}</p><p className="text-[11px] text-slate-500 mt-1">{formatTime(row.latest_candle_at)}</p></div>})}</div>{(r.blockers??[]).length>0&&<div className="rounded-lg border border-amber-200 dark:border-amber-900 p-3"><p className="text-xs font-semibold text-amber-600">Execution blocked</p>{r.blockers?.map((b,i)=><p key={i} className="text-xs text-slate-500 mt-1">• {b}</p>)}</div>}{ready&&<div className="rounded-lg border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-600 font-semibold">All commodity scanner gates passed. This futures setup will also be enrolled in Commodity Outcome Tracking and the MCX recorder will sync completed 5m candles.</div>}</>}</CardBody></Card>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="text-sm font-semibold mt-1 break-all">{value}</p></div>; }
function Check({ label, ok, tested }: { label: string; ok: boolean; tested: boolean }) { return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-2">{!tested?<Activity size={16} className="text-slate-400"/>:ok?<CheckCircle2 size={16} className="text-emerald-500"/>:<XCircle size={16} className="text-red-500"/>}<div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-slate-500">{!tested?'Awaiting probe':ok?'PASS':'FAIL'}</p></div></div>; }
function money(value: unknown){const n=Number(value);return Number.isFinite(n)?`₹${n.toFixed(2)}`:'—';}
function formatTime(value: unknown){if(value==null||value==='')return'—';let d:Date;if(typeof value==='number'||(/^\d+$/.test(String(value)))){let n=Number(value);if(n>1_000_000_000_000)n/=1000;d=new Date(n*1000);}else d=new Date(String(value));return Number.isNaN(d.getTime())?String(value):d.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour12:true});}
