import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ScanLine, ShieldCheck, XCircle } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui';
import { useStore } from '@/store/StoreContext';
import { scanFno, scanMtf, type FnoScanResponse, type MtfScanItem } from '@/lib/alphaPilotApi';
import type { PageKey } from '@/components/Sidebar';

const LIVE_TIMEFRAMES = ['5m', '15m', '1h'];
const SYMBOLS = [
  'RELIANCE','TCS','INFY','HDFCBANK','ICICIBANK','SBIN','AXISBANK','KOTAKBANK','INDUSINDBK','BAJFINANCE','BAJAJFINSV','LT','BHARTIARTL','ITC','HINDUNILVR','MARUTI','M&M','TATAMOTORS','SUNPHARMA','DRREDDY','CIPLA','DIVISLAB','APOLLOHOSP','WIPRO','HCLTECH','TECHM','LTIM','TITAN','ASIANPAINT','ULTRACEMCO','TATASTEEL','JSWSTEEL','HINDALCO','COALINDIA','ONGC','NTPC','POWERGRID','ADANIENT','ADANIPORTS','GRASIM','NESTLEIND','BRITANNIA','EICHERMOT','HEROMOTOCO'
];
const BATCH_SIZE = 6;

type ConfirmedMap = Record<string, FnoScanResponse>;
type ConfirmationFailureMap = Record<string, string>;
type ScannerMode = 'find' | 'single';
type SafetyGate = { pass: boolean; label: string; reason?: string };
type Bucket = 'Tradable Setup' | 'Watchlist' | 'No Trade';
type FinalGate = { pass: boolean; reason?: string };

function scoreOf(item: MtfScanItem) { return Number(item.multi_timeframe_score ?? 50); }
function strength(item: MtfScanItem, fno?: FnoScanResponse) {
  const score = Number(fno?.overall_alpha_score ?? scoreOf(item));
  const direction = String(fno?.technical?.direction ?? item.direction ?? '').toUpperCase();
  return direction === 'SHORT' ? 100 - score : score;
}
function optionAction(directionValue: unknown) {
  const direction = String(directionValue ?? '').toUpperCase();
  return direction.includes('SHORT') ? 'BUY PE' : 'BUY CE';
}
function directionOf(item: MtfScanItem, fno?: FnoScanResponse) {
  const raw = String(fno?.technical?.direction ?? item.direction ?? item.signal ?? '').toUpperCase();
  return raw.includes('SHORT') ? 'SHORT' : 'LONG';
}
function timeframeDirection(frame: any): 'LONG' | 'SHORT' | null {
  const direction = String(frame?.direction ?? '').toUpperCase();
  const signal = String(frame?.signal ?? '').toUpperCase();
  if (direction === 'LONG' || signal.includes('LONG')) return 'LONG';
  if (direction === 'SHORT' || signal.includes('SHORT')) return 'SHORT';
  return null;
}
function safetyGate(item: MtfScanItem, fno?: FnoScanResponse): SafetyGate {
  const direction = directionOf(item, fno);
  const action = optionAction(direction);
  const frames = (fno?.technical?.timeframes ?? item.timeframes ?? {}) as Record<string, any>;
  const tf15 = frames?.['15m'] ?? item.timeframes?.['15m'] ?? {};
  const structure15 = String(tf15.market_structure ?? '').toUpperCase();
  const rsi = Number(tf15.rsi14);
  const contradictory = direction === 'LONG' ? structure15 === 'DOWNTREND' : structure15 === 'UPTREND';
  const exhausted = Number.isFinite(rsi) && (direction === 'LONG' ? rsi >= 80 : rsi <= 20);
  const votes = LIVE_TIMEFRAMES
    .map(tf => timeframeDirection(frames?.[tf] ?? item.timeframes?.[tf] ?? {}))
    .filter((vote): vote is 'LONG' | 'SHORT' => vote !== null);
  const alignedCount = votes.filter(vote => vote === direction).length;
  const aligned = alignedCount >= 2;
  if (exhausted) return { pass: false, label: `EXTENDED ${action} — WAIT`, reason: `RSI ${rsi.toFixed(1)} is exhausted; wait for pullback/retest.` };
  if (contradictory) return { pass: false, label: `WATCH ${action}`, reason: `15m ${structure15} contradicts ${action} direction.` };
  if (!aligned) return { pass: false, label: `WATCH ${action}`, reason: `5m/15m/1h signal agreement is below 2 timeframes (currently ${alignedCount}/3).` };
  return { pass: true, label: action };
}
function finalGate(item: MtfScanItem, fno: FnoScanResponse | undefined, minRR: number): FinalGate {
  if (item.status !== 'SETUP') return { pass: false };
  const safety = safetyGate(item, fno);
  if (!safety.pass) return { pass: false, reason: safety.reason };
  if (!fno) return { pass: false, reason: 'Awaiting F&O confirmation before execution.' };
  const direction = directionOf(item, fno);
  const alpha = Number(fno.overall_alpha_score ?? 50);
  const rr = Number(fno.technical?.risk_reward ?? item.risk_reward ?? 0);
  const alphaPass = direction === 'SHORT' ? alpha <= 35 : alpha >= 65;
  if (!alphaPass) return { pass: false, reason: direction === 'SHORT' ? `Final Alpha ${alpha.toFixed(1)} is above the BUY PE limit of 35.` : `Final Alpha ${alpha.toFixed(1)} is below the BUY CE threshold of 65.` };
  if (rr < minRR) return { pass: false, reason: `Underlying R:R ${rr.toFixed(2)} is below the required ${minRR.toFixed(2)}.` };
  if (fno.execution_ready !== true) return { pass: false, reason: 'Backend execution gate is not ready.' };
  return { pass: true };
}
function groupOf(item: MtfScanItem, fno: FnoScanResponse | undefined, minRR: number): Bucket {
  if (item.status === 'SETUP') return finalGate(item, fno, minRR).pass ? 'Tradable Setup' : 'Watchlist';
  if (item.signal === 'WATCH_LONG' || item.signal === 'WATCH_SHORT') return 'Watchlist';
  return 'No Trade';
}
function visibleSignal(item: MtfScanItem, fno: FnoScanResponse | undefined, minRR: number, confirmationFailure?: string) {
  const bucket = groupOf(item, fno, minRR);
  const gate = safetyGate(item, fno);
  const action = optionAction(directionOf(item, fno));
  if (bucket === 'No Trade') return 'NO_TRADE';
  if (bucket === 'Tradable Setup') return action;
  if (!gate.pass) return gate.label;
  if (item.status === 'SETUP' && confirmationFailure) return 'F&O CONFIRMATION FAILED';
  if (item.status === 'SETUP' && !fno) return `F&O PENDING — ${action}`;
  if (item.status === 'SETUP' && fno) return 'REJECTED AFTER F&O';
  return `WATCH ${action}`;
}
function optionRiskReward(option: any) {
  const entry = Number(option?.option_entry ?? option?.premium);
  const stop = Number(option?.option_stop_loss);
  const target = Number(option?.option_target1);
  const risk = entry - stop;
  const reward = target - entry;
  if (![entry, stop, target, risk, reward].every(Number.isFinite) || risk <= 0 || reward <= 0) return null;
  return reward / risk;
}
function rupee(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? `₹${n.toFixed(2)}` : '—';
}
function plainNumber(value: unknown, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}
function lotSize(option: any) {
  const n = Number(option?.lot_size);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n).toLocaleString('en-IN') : '—';
}
function amountRequired(option: any) {
  return rupee(option?.amount_required_1_lot);
}
function marketIsOpen(result: FnoScanResponse) {
  if (result.market_session?.is_open === true) return true;
  const status = String(result.market_session?.status ?? result.market_session?.phase ?? '').toUpperCase();
  return status === 'OPEN' || status === 'CONTINUOUS';
}

export function TradeScannerLive({ onNavigate: _onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const { scannerFilters, setScannerFilters } = useStore();
  const [mode, setMode] = useState<ScannerMode>('find');
  const [symbol, setSymbol] = useState('RELIANCE');
  const [items, setItems] = useState<MtfScanItem[]>([]);
  const [errors, setErrors] = useState<MtfScanItem[]>([]);
  const [confirmed, setConfirmed] = useState<ConfirmedMap>({});
  const [confirmationFailures, setConfirmationFailures] = useState<ConfirmationFailureMap>({});
  const [singleResult, setSingleResult] = useState<FnoScanResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ranked = useMemo(() => [...items].sort((a, b) => strength(b, confirmed[b.symbol]) - strength(a, confirmed[a.symbol])), [items, confirmed]);
  const qualified = useMemo(() => ranked.filter(i => finalGate(i, confirmed[i.symbol], scannerFilters.minRiskReward).pass).slice(0, 3), [ranked, confirmed, scannerFilters.minRiskReward]);
  const best = qualified[0] ?? null;

  async function confirmCandidates(list: MtfScanItem[]) {
    const candidates = list.filter(i => i.status === 'SETUP' && safetyGate(i).pass).sort((a, b) => strength(b) - strength(a));
    const updates: ConfirmedMap = {};
    for (let i = 0; i < candidates.length; i += 1) {
      const item = candidates[i];
      setProgress(`F&O confirming all eligible setups ${i + 1}/${candidates.length}: ${item.symbol}`);
      try {
        const result = await scanFno(item.symbol, scannerFilters.minRiskReward, LIVE_TIMEFRAMES);
        updates[item.symbol] = result;
        setConfirmed(prev => ({ ...prev, [item.symbol]: result }));
        setConfirmationFailures(prev => {
          const next = { ...prev };
          delete next[item.symbol];
          return next;
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'F&O confirmation request failed';
        setConfirmationFailures(prev => ({ ...prev, [item.symbol]: message }));
        console.error('F&O confirmation failed', item.symbol, e);
      }
    }
    setConfirmed(prev => ({ ...prev, ...updates }));
  }

  async function runUniverseScan() {
    setScanning(true); setItems([]); setErrors([]); setConfirmed({}); setConfirmationFailures({}); setSingleResult(null); setError(null);
    const good: MtfScanItem[] = []; const bad: MtfScanItem[] = [];
    try {
      for (let i = 0; i < SYMBOLS.length; i += BATCH_SIZE) {
        const batch = SYMBOLS.slice(i, i + BATCH_SIZE);
        setProgress(`Scanning ${Math.min(i + batch.length, SYMBOLS.length)}/${SYMBOLS.length}: ${batch.join(', ')}`);
        try {
          const response = await scanMtf(batch, scannerFilters.minRiskReward, LIVE_TIMEFRAMES);
          const received = [...(response.setups ?? []), ...(response.others ?? [])];
          for (const row of received) { if (row.status === 'ERROR') bad.push(row); else good.push(row); }
          setItems([...good]); setErrors([...bad]);
        } catch (batchError) {
          const message = batchError instanceof Error ? batchError.message : 'Batch request failed';
          batch.forEach(s => bad.push({ symbol: s, status: 'ERROR', signal: 'ERROR', error: message }));
          setErrors([...bad]);
        }
      }
      if (good.length === 0) {
        const sample = bad[0]?.error ? ` First error: ${bad[0].error}` : '';
        setError(`The backend returned no usable market data for all ${SYMBOLS.length} symbols.${sample}`);
        return;
      }
      const sorted = [...good].sort((a, b) => scoreOf(b) - scoreOf(a));
      setItems(sorted);
      await confirmCandidates(sorted);
    } finally {
      setProgress('');
      setScanning(false);
    }
  }

  async function runSingleScan() {
    const s = symbol.trim().toUpperCase(); if (!s) return;
    setScanning(true); setError(null); setSingleResult(null); setProgress(`Scanning ${s}...`);
    try { setSingleResult(await scanFno(s, scannerFilters.minRiskReward, LIVE_TIMEFRAMES)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to scan symbol.'); }
    finally { setScanning(false); setProgress(''); }
  }

  const bestConfirmed = best ? confirmed[best.symbol] : undefined;
  const bestDirection = best ? directionOf(best, bestConfirmed) : '';
  const bestAlpha = Number(bestConfirmed?.overall_alpha_score ?? (best ? scoreOf(best) : 50));
  const bestUnderlyingRR = Number(bestConfirmed?.technical?.risk_reward ?? best?.risk_reward ?? 0);
  const bestOption = (bestConfirmed?.recommended_option ?? null) as any;
  const bestOptionRR = optionRiskReward(bestOption);
  const bestEntry = bestConfirmed?.technical?.entry ?? best?.entry;
  const bestStop = bestConfirmed?.technical?.stop_loss ?? best?.stop_loss;
  const bestTarget1 = bestConfirmed?.technical?.target1 ?? best?.target1;
  const bestTarget2 = bestConfirmed?.technical?.target2 ?? best?.target2;
  const optionEntry = bestOption?.option_entry ?? bestOption?.premium;
  const optionStop = bestOption?.option_stop_loss;
  const optionTarget1 = bestOption?.option_target1;
  const optionTarget2 = bestOption?.option_target2;
  const bestChecks = best ? [
    { label: 'Direction consistency', pass: safetyGate(best, bestConfirmed).pass },
    { label: 'F&O confirmation', pass: Boolean(bestConfirmed) },
    { label: bestDirection === 'SHORT' ? 'Final Alpha ≤ 35' : 'Final Alpha ≥ 65', pass: bestDirection === 'SHORT' ? bestAlpha <= 35 : bestAlpha >= 65 },
    { label: `Underlying R:R ≥ ${scannerFilters.minRiskReward.toFixed(2)}`, pass: bestUnderlyingRR >= scannerFilters.minRiskReward },
    { label: 'Execution ready', pass: bestConfirmed?.execution_ready === true },
  ] : [];

  return <div className="space-y-5">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div><h1 className="text-xl font-bold">Find Trade</h1><p className="text-sm text-slate-500">Broad NSE F&amp;O scan → shortlist → F&amp;O confirm → execution gate.</p></div>
      <div className="flex gap-2"><Button variant={mode === 'find' ? 'primary' : 'ghost'} onClick={() => setMode('find')}>Find Trade</Button><Button variant={mode === 'single' ? 'primary' : 'ghost'} onClick={() => setMode('single')}>Single Symbol</Button></div>
    </div>
    <Card><CardHeader title={mode === 'find' ? 'NSE F&O Market Scanner' : 'Single Symbol Scanner'} subtitle="5m + 15m + 1h · direction consistency + RSI exhaustion protected"/><CardBody><div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">{mode === 'find' ? <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2"><p className="text-xs text-slate-500">Universe</p><p className="font-medium text-sm">{SYMBOLS.length} liquid NSE F&amp;O stocks · batches of {BATCH_SIZE}</p></div> : <Input label="Symbol" value={symbol} onChange={v => setSymbol(v.toUpperCase())}/>}<Input label="Min Risk/Reward" type="number" value={String(scannerFilters.minRiskReward)} onChange={v => setScannerFilters({ minRiskReward: parseFloat(v) || 0 })}/><Button variant="primary" disabled={scanning} onClick={mode === 'find' ? runUniverseScan : runSingleScan}><ScanLine size={16} className="inline mr-1.5"/>{scanning ? 'Scanning...' : mode === 'find' ? 'Scan F&O Universe' : 'Run Live Scan'}</Button></div></CardBody></Card>
    {scanning && <Card><CardBody className="text-center py-8"><ScanLine size={36} className="mx-auto text-blue-500 mb-2 animate-pulse"/><p className="font-medium text-sm">{progress || 'Working...'}</p><p className="text-xs text-slate-500 mt-1">Results appear progressively as each batch completes. Every safety-passed technical SETUP is then F&amp;O-confirmed sequentially before BEST TRADE is ranked.</p></CardBody></Card>}
    {error && <Card><CardBody><div className="flex items-start gap-3"><AlertCircle className="text-red-500 shrink-0"/><div><p className="font-semibold text-red-600">Scanner data error</p><p className="text-sm text-slate-600 dark:text-slate-400 mt-1 break-words">{error}</p>{errors.length > 0 && <p className="text-xs text-slate-500 mt-2">Failed symbols: {errors.map(e => e.symbol).join(', ')}</p>}</div></div></CardBody></Card>}
    {!scanning && mode === 'find' && items.length === 0 && !error && <Card><CardBody className="text-center py-10"><p className="text-sm text-slate-500">Click “Scan F&amp;O Universe” to search {SYMBOLS.length} stocks.</p></CardBody></Card>}
    {!scanning && mode === 'find' && items.length > 0 && <>
      <Card><CardBody className="py-5">{best ? <div className="space-y-4"><div className="flex items-start gap-3"><ShieldCheck className="text-emerald-500"/><div><p className="text-lg font-bold">BEST TRADE — {best.symbol} {optionAction(bestDirection)}</p><p className="text-sm text-slate-500">Final Alpha {bestAlpha.toFixed(1)}/100 · Option R:R {bestOptionRR == null ? '—' : `${bestOptionRR.toFixed(2)} : 1`} · Underlying R:R {bestUnderlyingRR.toFixed(2)} : 1</p></div></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">{bestChecks.map(check => <div key={check.label} className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center gap-2 text-xs">{check.pass ? <CheckCircle2 size={15} className="text-emerald-500"/> : <XCircle size={15} className="text-red-500"/>}<span>{check.label}</span></div>)}</div>{bestOption && <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs text-slate-500">Recommended option</p><p className="font-bold mt-0.5">{bestOption.contract_label ?? `${best.symbol} ${bestOption.strike ?? ''} ${bestOption.option_type ?? ''}`}</p></div><Badge variant="green">{optionAction(bestDirection)}</Badge></div><div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4"><TradeMetric label="Option Entry" value={rupee(optionEntry)}/><TradeMetric label="Option Stop Loss" value={rupee(optionStop)}/><TradeMetric label="Option Target 1" value={rupee(optionTarget1)}/><TradeMetric label="Option Target 2" value={rupee(optionTarget2)}/><TradeMetric label="Option R:R" value={bestOptionRR == null ? '—' : `${bestOptionRR.toFixed(2)} : 1`}/></div><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4"><TradeMetric label="Lot Size" value={lotSize(bestOption)}/><TradeMetric label="Amount Required (1 Lot)" value={amountRequired(bestOption)}/><TradeMetric label="Live Premium" value={rupee(bestOption.premium)}/><TradeMetric label="Expiry" value={String(bestOption.expiry ?? bestConfirmed?.expiry ?? '—')}/></div><div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4"><TradeMetric label="IV" value={bestOption.iv == null ? '—' : `${plainNumber(bestOption.iv)}%`}/><TradeMetric label="Open Interest" value={bestOption.open_interest == null ? '—' : Number(bestOption.open_interest).toLocaleString('en-IN')}/><TradeMetric label="Volume" value={bestOption.volume == null ? '—' : Number(bestOption.volume).toLocaleString('en-IN')}/></div></div>}<div><p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Underlying confirmation levels</p><div className="grid grid-cols-2 md:grid-cols-5 gap-3"><TradeMetric label="Underlying Entry" value={rupee(bestEntry)}/><TradeMetric label="Underlying Stop" value={rupee(bestStop)}/><TradeMetric label="Underlying Target 1" value={rupee(bestTarget1)}/><TradeMetric label="Underlying Target 2" value={rupee(bestTarget2)}/><TradeMetric label="Underlying R:R" value={`${bestUnderlyingRR.toFixed(2)} : 1`}/></div></div><div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-800 dark:text-amber-300"><b>Research setup only.</b> Amount required is the estimated option entry premium × current F&amp;O lot size. Option entry, stop and targets are estimated from live premium using current delta/gamma and can change with IV, theta and spread.</div></div> : <div className="flex items-start gap-3"><ShieldCheck className="text-amber-500"/><div><p className="text-lg font-bold">NO TRADE RIGHT NOW</p><p className="text-sm text-slate-500">No candidate passed direction consistency, exhaustion, F&amp;O and execution gates.</p></div></div>}</CardBody></Card>
      {qualified.length > 0 && <Card><CardHeader title="Top Qualified Trades" subtitle="All safety-passed technical setups were F&O-confirmed sequentially; only fully qualified results are shown."/><CardBody className="space-y-3">{qualified.map((item, index) => { const c = confirmed[item.symbol]; const direction = directionOf(item, c); const underlyingRR = Number(c?.technical?.risk_reward ?? item.risk_reward ?? 0); const option = (c?.recommended_option ?? {}) as any; const optionRR = optionRiskReward(option); return <div key={item.symbol} className={`rounded-xl border p-4 ${index === 0 ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/10' : 'border-slate-200 dark:border-slate-800'}`}><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold">{index + 1}</div><div><div className="flex gap-2 items-center flex-wrap"><b>{item.symbol}</b><Badge variant="green">{optionAction(direction)}</Badge>{index === 0 && <Badge variant="blue">BEST</Badge>}</div><p className="text-xs text-slate-500 mt-1">{option.contract_label ?? 'Confirmed option contract'}</p></div></div><div className="grid grid-cols-3 sm:grid-cols-9 gap-4 text-right"><MiniMetric label="Strength" value={`${strength(item, c).toFixed(1)}/100`}/><MiniMetric label="Final Alpha" value={`${Number(c?.overall_alpha_score ?? 50).toFixed(1)}/100`}/><MiniMetric label="Option R:R" value={optionRR == null ? '—' : `${optionRR.toFixed(2)}:1`}/><MiniMetric label="Underlying R:R" value={`${underlyingRR.toFixed(2)}:1`}/><MiniMetric label="Entry" value={rupee(option.option_entry ?? option.premium)}/><MiniMetric label="SL" value={rupee(option.option_stop_loss)}/><MiniMetric label="Target 1" value={rupee(option.option_target1)}/><MiniMetric label="Lot" value={lotSize(option)}/><MiniMetric label="Amount" value={amountRequired(option)}/></div></div></div>; })}{qualified.length > 1 && <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 px-4 py-3 text-xs text-slate-600 dark:text-slate-400"><b>Why #1 won:</b> {qualified[0].symbol} has the highest directional strength among all fully execution-qualified setups after every eligible technical setup completed F&amp;O confirmation. All Top Qualified Trades passed the same direction-consistency, RSI-exhaustion, F&amp;O confirmation, minimum underlying R:R and execution-ready gates.</div>}</CardBody></Card>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Summary label="Tradable Setup" value={ranked.filter(i => groupOf(i, confirmed[i.symbol], scannerFilters.minRiskReward) === 'Tradable Setup').length}/><Summary label="Watchlist" value={ranked.filter(i => groupOf(i, confirmed[i.symbol], scannerFilters.minRiskReward) === 'Watchlist').length}/><Summary label="No Trade" value={ranked.filter(i => groupOf(i, confirmed[i.symbol], scannerFilters.minRiskReward) === 'No Trade').length}/></div>
      {(['Tradable Setup','Watchlist','No Trade'] as Bucket[]).map(group => { const rows = ranked.filter(i => groupOf(i, confirmed[i.symbol], scannerFilters.minRiskReward) === group); if (!rows.length) return null; return <Card key={group}><CardHeader title={group}/><CardBody className="space-y-2">{rows.map((item, index) => { const c = confirmed[item.symbol]; const failure = confirmationFailures[item.symbol]; const option = (c?.recommended_option ?? null) as any; const tf = item.timeframes?.['15m'] ?? {}; const gate = safetyGate(item, c); const final = finalGate(item, c, scannerFilters.minRiskReward); const signal = visibleSignal(item, c, scannerFilters.minRiskReward, failure); const badgeVariant = group === 'Tradable Setup' ? 'green' : group === 'No Trade' ? 'red' : 'blue'; const reason = failure ? `F&O confirmation failed: ${failure}. Retry the scan before considering this setup.` : gate.reason ?? (item.status === 'SETUP' && !final.pass ? final.reason : undefined); return <div key={item.symbol} className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"><div><div className="flex gap-2 items-center flex-wrap"><b>{index + 1}. {item.symbol}</b><Badge variant={failure ? 'red' : badgeVariant}>{signal}</Badge>{c && <Badge variant="blue">F&amp;O CONFIRMED</Badge>}{item.status === 'SETUP' && (!final.pass || failure) && <Badge variant="red">EXECUTION BLOCKED</Badge>}</div><p className="text-xs text-slate-500 mt-1">15m: {tf.market_structure ?? '—'} · RSI {tf.rsi14 == null ? '—' : Number(tf.rsi14).toFixed(2)}</p>{option && <p className="text-xs text-slate-500 mt-1">{option.contract_label ?? `${item.symbol} ${option.strike ?? ''} ${option.option_type ?? ''}`} · Lot {lotSize(option)} · <b>Amount required {amountRequired(option)}</b></p>}{reason && <p className="text-xs text-amber-600 mt-1">{reason}</p>}</div><div className="text-right"><p className="text-xs text-slate-500">MTF Alpha</p><p className="font-bold">{scoreOf(item).toFixed(1)}/100</p>{c && <p className="text-xs text-slate-500">Final {Number(c.overall_alpha_score).toFixed(1)}/100</p>}</div></div>; })}</CardBody></Card>; })}
      {Object.keys(confirmationFailures).length > 0 && <Card><CardHeader title={`F&O Confirmation Failures (${Object.keys(confirmationFailures).length})`}/><CardBody><div className="flex items-start gap-3"><AlertCircle className="text-red-500 shrink-0"/><div><p className="text-sm font-medium">Retry required before ranking these setups</p><p className="text-xs text-slate-500 mt-1">These symbols passed the technical safety gate but their F&amp;O confirmation request failed, so they are excluded from BEST TRADE / Top Qualified Trades.</p><div className="space-y-2 mt-3">{Object.entries(confirmationFailures).map(([s, message]) => <div key={s} className="text-xs"><Badge variant="red">{s}</Badge><span className="ml-2 text-slate-500 break-words">{message}</span></div>)}</div></div></div></CardBody></Card>}
      {errors.length > 0 && <Card><CardHeader title={`Provider Errors (${errors.length})`}/><CardBody><div className="flex items-start gap-3"><AlertCircle className="text-amber-500 shrink-0"/><div><p className="text-sm font-medium">Excluded from ranking</p><p className="text-xs text-slate-500 mt-1">These symbols did not return usable provider data and are not counted as No Trade.</p><div className="flex flex-wrap gap-2 mt-3">{errors.map(e => <Badge key={e.symbol} variant="red">{e.symbol}</Badge>)}</div></div></div></CardBody></Card>}
    </>}
    {!scanning && mode === 'single' && singleResult && (() => { const synthetic: MtfScanItem = { symbol: singleResult.symbol, status: singleResult.status, signal: singleResult.signal, direction: singleResult.technical?.direction, timeframes: singleResult.technical?.timeframes ?? singleResult.timeframes }; const gate = safetyGate(synthetic, singleResult); const direction = directionOf(synthetic, singleResult); const alpha = Number(singleResult.overall_alpha_score ?? 50); const underlyingRR = Number(singleResult.technical?.risk_reward ?? 0); const alphaPass = direction === 'SHORT' ? alpha <= 35 : alpha >= 65; const marketOpen = marketIsOpen(singleResult); const executionReady = marketOpen && singleResult.execution_ready === true && gate.pass && alphaPass && underlyingRR >= scannerFilters.minRiskReward; const option = (singleResult.recommended_option ?? {}) as any; const optionRR = optionRiskReward(option); const displayState = !marketOpen ? 'MARKET CLOSED — SNAPSHOT ONLY' : executionReady ? optionAction(direction) : gate.pass ? 'REJECTED AFTER F&O' : gate.label; return <Card><CardHeader title={`${singleResult.symbol} — ${displayState}`} action={<Badge variant={marketOpen ? 'blue' : 'red'}>Alpha {alpha.toFixed(1)}/100</Badge>}/><CardBody>{!marketOpen && <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300"><b>Market closed — snapshot only.</b> Scores are based on the latest completed candles. Execution is hard-blocked until NSE is open and fresh market data is available.</div>}<div className="grid grid-cols-2 md:grid-cols-5 gap-3"><Metric label="Status" value={executionReady ? 'SETUP' : marketOpen ? 'WATCH' : 'SNAPSHOT'}/><Metric label="Technical" value={`${Number(singleResult.technical_score ?? 0).toFixed(1)}/100`}/><Metric label="F&O" value={`${Number(singleResult.fno_score ?? 0).toFixed(1)}/100`}/><Metric label="Option R:R" value={optionRR == null ? '—' : `${optionRR.toFixed(2)}:1`}/><Metric label="Execution" value={executionReady ? 'READY' : 'BLOCKED'}/></div>{option.contract_label && <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="font-semibold text-sm">{option.contract_label}</p><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3"><TradeMetric label="Lot Size" value={lotSize(option)}/><TradeMetric label="Amount Required (1 Lot)" value={amountRequired(option)}/><TradeMetric label="Option Entry" value={rupee(option.option_entry ?? option.premium)}/><TradeMetric label="Option Stop Loss" value={rupee(option.option_stop_loss)}/></div><div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3"><TradeMetric label="Option Target 1" value={rupee(option.option_target1)}/><TradeMetric label="Option Target 2" value={rupee(option.option_target2)}/><TradeMetric label="Option R:R" value={optionRR == null ? '—' : `${optionRR.toFixed(2)} : 1`}/></div></div>}{gate.reason && <div className="mt-4 text-xs text-amber-600">• {gate.reason}</div>}{marketOpen && gate.pass && !alphaPass && <div className="mt-4 text-xs text-amber-600">• {direction === 'SHORT' ? `Final Alpha ${alpha.toFixed(1)} is above the BUY PE limit of 35.` : `Final Alpha ${alpha.toFixed(1)} is below the BUY CE threshold of 65.`}</div>}{marketOpen && gate.pass && underlyingRR < scannerFilters.minRiskReward && <div className="mt-4 text-xs text-amber-600">• Underlying R:R {underlyingRR.toFixed(2)} is below the required {scannerFilters.minRiskReward.toFixed(2)}.</div>}{Array.isArray(singleResult.execution_blockers) && singleResult.execution_blockers.length > 0 && <div className="mt-4 text-xs text-amber-600">{singleResult.execution_blockers.map((b: string, i: number) => <p key={i}>• {b}</p>)}</div>}</CardBody></Card>; })()}
  </div>;
}
function Summary({ label, value }: { label: string; value: number }) { return <Card><CardBody><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></CardBody></Card>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="font-semibold text-sm mt-1">{value}</p></div>; }
function TradeMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2"><p className="text-[11px] text-slate-500">{label}</p><p className="font-semibold text-sm mt-1 break-words">{value}</p></div>; }
function MiniMetric({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] text-slate-500">{label}</p><p className="text-xs font-semibold mt-0.5 whitespace-nowrap">{value}</p></div>; }
