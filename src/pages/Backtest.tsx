import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FlaskConical, Play, RotateCcw, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui';
import { runHistoricalBacktest, type BacktestResponse } from '@/lib/alphaPilotApi';
import { deleteMultiValidation, listMultiValidations, saveMultiValidation, type StoredMultiValidation } from '@/lib/backtestStorage';

const FNO_UNIVERSE = [
  'RELIANCE','TCS','INFY','HDFCBANK','ICICIBANK','SBIN','AXISBANK','KOTAKBANK','INDUSINDBK','BAJFINANCE','BAJAJFINSV','LT','BHARTIARTL','ITC','HINDUNILVR','MARUTI','M&M','TATAMOTORS','SUNPHARMA','DRREDDY','CIPLA','DIVISLAB','APOLLOHOSP','WIPRO','HCLTECH','TECHM','LTIM','TITAN','ASIANPAINT','ULTRACEMCO','TATASTEEL','JSWSTEEL','HINDALCO','COALINDIA','ONGC','NTPC','POWERGRID','ADANIENT','ADANIPORTS','GRASIM','NESTLEIND','BRITANNIA','EICHERMOT','HEROMOTOCO'
];
const BACKTEST_BATCH_SIZE = 5;
const HISTORY_KEY = 'alphapilot.backtestHistory.v1';
const MAX_HISTORY = 3;

type Trade = BacktestResponse['trades'][number];
type BreakdownRow = { label: string; trades: number; wins: number; losses: number; winRate: number; totalR: number; avgR: number };
type WindowFilter = 'ALL' | 'BEFORE_1030' | 'BEFORE_1200';
type DirectionFilter = 'ALL' | 'BUY CE' | 'BUY PE';
type UniverseMode = 'CUSTOM' | 'FNO44';
type SavedBacktest = {
  id: string;
  createdAt: string;
  universeMode: UniverseMode;
  symbolsText: string;
  startDate: string;
  endDate: string;
  minRR: string;
  windowFilter: WindowFilter;
  baseline: BacktestResponse;
  filtered: BacktestResponse;
};
type PeriodSpec = { label: string; startDate: string; endDate: string };
type MultiPeriodResult = PeriodSpec & {
  allDay: BacktestResponse;
  before1030: BacktestResponse;
  before1200: BacktestResponse;
};
type SavedMultiValidation = StoredMultiValidation<MultiPeriodResult>;

function dateOffset(days: number) { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); }
function shiftDate(value: string, days: number) { const d = new Date(`${value}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function money(v: number) { return `₹${Number(v).toFixed(2)}`; }
function summarize(label: string, trades: Trade[]): BreakdownRow {
  const wins = trades.filter(t => t.r_multiple > 0).length;
  const losses = trades.filter(t => t.r_multiple < 0).length;
  const totalR = trades.reduce((sum, t) => sum + t.r_multiple, 0);
  return { label, trades: trades.length, wins, losses, winRate: trades.length ? wins / trades.length * 100 : 0, totalR, avgR: trades.length ? totalR / trades.length : 0 };
}
function localMinutes(timestamp: string) { const d = new Date(timestamp); return d.getHours() * 60 + d.getMinutes(); }
function timeBucket(timestamp: string) { const m = localMinutes(timestamp); if (m < 630) return '09:15–10:30'; if (m < 720) return '10:30–12:00'; if (m < 810) return '12:00–13:30'; return '13:30+'; }
function maxDrawdown(trades: Trade[]) { let equity = 0, peak = 0, dd = 0; for (const t of [...trades].sort((a,b) => a.timestamp.localeCompare(b.timestamp))) { equity += t.r_multiple; peak = Math.max(peak, equity); dd = Math.max(dd, peak - equity); } return dd; }
function byDirection(trades: Trade[], direction: DirectionFilter) { return direction === 'ALL' ? trades : trades.filter(t => t.action === direction); }
function entryBeforeValue(windowFilter: WindowFilter) { return windowFilter === 'BEFORE_1030' ? '10:30' : windowFilter === 'BEFORE_1200' ? '12:00' : null; }
function windowLabel(windowFilter: WindowFilter) { return windowFilter === 'ALL' ? 'All day' : windowFilter === 'BEFORE_1030' ? 'Before 10:30' : 'Before 12:00'; }
function directionLabel(direction: DirectionFilter) { return direction === 'ALL' ? 'All directions' : direction; }
function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }
function buildPeriodSpecs(startDate: string, endDate: string, count = 3): PeriodSpec[] {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  const spanDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
  return Array.from({ length: count }, (_, i) => ({
    label: `Period ${i + 1}`,
    startDate: shiftDate(startDate, -i * spanDays),
    endDate: shiftDate(endDate, -i * spanDays),
  }));
}
function readHistory(): SavedBacktest[] {
  if (typeof window === 'undefined') return [];
  try { const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
function writeHistory(items: SavedBacktest[]) {
  if (typeof window === 'undefined') return;
  const candidates = [items.slice(0, MAX_HISTORY), items.slice(0, 2), items.slice(0, 1)];
  for (const candidate of candidates) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(candidate)); return; }
    catch { /* localStorage quota: retry with fewer saved runs */ }
  }
}
function combinedResponse(parts: BacktestResponse[], fallback: { startDate:string; endDate:string; minRR:number; entryBefore:string|null }): BacktestResponse {
  const trades = parts.flatMap(p => p.trades ?? []).sort((a,b) => a.timestamp.localeCompare(b.timestamp));
  const errors = parts.flatMap(p => p.errors ?? []);
  const wins = trades.filter(t => t.r_multiple > 0).length;
  const losses = trades.filter(t => t.r_multiple < 0).length;
  const totalR = trades.reduce((s,t) => s + t.r_multiple, 0);
  return {
    mode: 'HISTORICAL_UNDERLYING_BACKTEST_BATCHED', start_date: fallback.startDate, end_date: fallback.endDate,
    min_risk_reward: fallback.minRR, entry_before: fallback.entryBefore,
    summary: { trades: trades.length, wins, losses, win_rate: trades.length ? wins / trades.length * 100 : 0, total_r: totalR, average_r: trades.length ? totalR / trades.length : 0, max_drawdown_r: maxDrawdown(trades) },
    trades, errors,
    limitations: parts[0]?.limitations ?? ['Underlying-price historical strategy validation only. Historical option-premium P&L is not reconstructed.'],
  };
}
function scenarioStats(response: BacktestResponse, direction: DirectionFilter) {
  const trades = byDirection(response.trades, direction);
  const s = summarize('', trades);
  return { ...s, drawdown: maxDrawdown(trades) };
}

export function Backtest() {
  const [universeMode, setUniverseMode] = useState<UniverseMode>('CUSTOM');
  const [symbolsText, setSymbolsText] = useState('RELIANCE,TATASTEEL,SBIN');
  const [startDate, setStartDate] = useState(dateOffset(10));
  const [endDate, setEndDate] = useState(dateOffset(1));
  const [minRR, setMinRR] = useState('1.5');
  const [windowFilter, setWindowFilterRaw] = useState<WindowFilter>('BEFORE_1030');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('ALL');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [filteredResult, setFilteredResult] = useState<BacktestResponse | null>(null);
  const [resultWindow, setResultWindow] = useState<WindowFilter | null>(null);
  const [history, setHistory] = useState<SavedBacktest[]>([]);
  const [multiRunning, setMultiRunning] = useState(false);
  const [multiProgress, setMultiProgress] = useState('');
  const [multiResults, setMultiResults] = useState<MultiPeriodResult[]>([]);
  const [multiDirection, setMultiDirection] = useState<DirectionFilter>('ALL');
  const [multiHistory, setMultiHistory] = useState<SavedMultiValidation[]>([]);

  useEffect(() => {
    const saved = readHistory();
    setHistory(saved);
    if (saved[0]) restore(saved[0], false, 'ALL');
    void (async () => {
      try {
        const multiSaved = await listMultiValidations<MultiPeriodResult>();
        setMultiHistory(multiSaved);
        const latest = multiSaved.find(x => x.results.length > 0);
        if (latest) {
          setMultiResults(latest.results);
          setMultiDirection('ALL');
        }
      } catch {
        // IndexedDB can be unavailable in restrictive/private browser modes; normal backtesting still works.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customSymbols = useMemo(() => symbolsText.split(',').map(x => x.trim().toUpperCase()).filter(Boolean).slice(0, 44), [symbolsText]);
  const symbols = universeMode === 'FNO44' ? FNO_UNIVERSE : customSymbols;
  const comparisonFresh = resultWindow === windowFilter;
  const periodSpecs = useMemo(() => buildPeriodSpecs(startDate, endDate, 3), [startDate, endDate]);

  function setWindowFilter(v: WindowFilter) { setWindowFilterRaw(v); if (resultWindow !== v) setFilteredResult(null); }
  function restore(saved: SavedBacktest, syncHistory = true, direction: DirectionFilter = 'ALL') {
    setUniverseMode(saved.universeMode); setSymbolsText(saved.symbolsText); setStartDate(saved.startDate); setEndDate(saved.endDate); setMinRR(saved.minRR);
    setWindowFilterRaw(saved.windowFilter); setResult(saved.baseline); setFilteredResult(saved.filtered); setResultWindow(saved.windowFilter); setDirectionFilter(direction); setError(null);
    if (syncHistory) {
      const next = [saved, ...history.filter(x => x.id !== saved.id)];
      setHistory(next); writeHistory(next);
    }
  }
  function removeSaved(id: string) { const next = history.filter(x => x.id !== id); setHistory(next); writeHistory(next); }
  function saveCompleted(baseline: BacktestResponse, filtered: BacktestResponse) {
    const saved: SavedBacktest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, createdAt: new Date().toISOString(), universeMode, symbolsText,
      startDate, endDate, minRR, windowFilter, baseline, filtered,
    };
    const next = [saved, ...history].slice(0, MAX_HISTORY);
    setHistory(next); writeHistory(next);
  }
  async function refreshMultiHistory() {
    try { setMultiHistory(await listMultiValidations<MultiPeriodResult>()); }
    catch { /* keep current in-memory history */ }
  }
  function restoreMulti(saved: SavedMultiValidation, direction: DirectionFilter = 'ALL') {
    setUniverseMode(saved.universeMode as UniverseMode); setSymbolsText(saved.symbolsText); setStartDate(saved.startDate); setEndDate(saved.endDate); setMinRR(saved.minRR);
    setMultiResults(saved.results); setMultiDirection(direction); setError(null);
  }
  async function removeMultiSaved(id: string) {
    try { await deleteMultiValidation(id); await refreshMultiHistory(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete saved multi-period validation.'); }
  }

  const displayTrades = useMemo(() => result ? byDirection(result.trades, directionFilter) : [], [result, directionFilter]);
  const displaySummary = useMemo(() => {
    const s = summarize(directionLabel(directionFilter), displayTrades);
    return { ...s, drawdown: maxDrawdown(displayTrades) };
  }, [displayTrades, directionFilter]);

  const breakdown = useMemo(() => {
    if (!result) return null;
    const trades = displayTrades;
    const bySymbolRows = [...new Set(trades.map(t => t.symbol))].map(symbol => summarize(symbol, trades.filter(t => t.symbol === symbol))).sort((a,b) => b.totalR - a.totalR);
    const byDir = ['BUY CE','BUY PE'].map(action => summarize(action, result.trades.filter(t => t.action === action)));
    const byTime = ['09:15–10:30','10:30–12:00','12:00–13:30','13:30+'].map(bucket => summarize(bucket, trades.filter(t => timeBucket(t.timestamp) === bucket)));
    const outcomes = [...new Set(trades.map(t => t.outcome))];
    const preferred = ['T2','T1','SL','EOD'];
    const byExit = [...preferred.filter(x => outcomes.includes(x)), ...outcomes.filter(x => !preferred.includes(x))].map(outcome => summarize(outcome, trades.filter(t => t.outcome === outcome)));
    return { bySymbol: bySymbolRows, byDirection: byDir, byTime, byExit };
  }, [result, displayTrades]);

  const comparison = useMemo(() => {
    if (!result || !comparisonFresh) return null;
    const baselineTrades = byDirection(result.trades, directionFilter);
    const serverFiltered = windowFilter === 'ALL' ? result.trades : (filteredResult?.trades ?? []);
    const filteredTrades = byDirection(serverFiltered, directionFilter);
    const b = summarize('Baseline', baselineTrades), f = summarize('Filtered', filteredTrades);
    return { baseline: { ...b, drawdown: maxDrawdown(baselineTrades) }, filtered: { ...f, drawdown: maxDrawdown(filteredTrades) } };
  }, [result, filteredResult, windowFilter, directionFilter, comparisonFresh]);

  const multiCombined = useMemo(() => {
    if (!multiResults.length) return null;
    const mergeScenario = (key: 'allDay' | 'before1030' | 'before1200') => {
      const trades = multiResults.flatMap(x => byDirection(x[key].trades, multiDirection)).sort((a,b) => a.timestamp.localeCompare(b.timestamp));
      const s = summarize('', trades);
      return { ...s, drawdown: maxDrawdown(trades) };
    };
    return { allDay: mergeScenario('allDay'), before1030: mergeScenario('before1030'), before1200: mergeScenario('before1200') };
  }, [multiResults, multiDirection]);

  async function runBatched(entryBefore: string | null, label: string, rangeStart = startDate, rangeEnd = endDate) {
    const rr = Number(minRR) || 1.5;
    const parts: BacktestResponse[] = [];
    for (let i = 0; i < symbols.length; i += BACKTEST_BATCH_SIZE) {
      const batch = symbols.slice(i, i + BACKTEST_BATCH_SIZE);
      setProgress(`${label}: symbols ${i + 1}–${Math.min(i + batch.length, symbols.length)} of ${symbols.length}`);
      parts.push(await runHistoricalBacktest(batch, rangeStart, rangeEnd, rr, entryBefore));
      if (i + BACKTEST_BATCH_SIZE < symbols.length) await sleep(500);
    }
    return combinedResponse(parts, { startDate: rangeStart, endDate: rangeEnd, minRR: rr, entryBefore });
  }

  async function run() {
    if (!symbols.length) return;
    setRunning(true); setError(null); setResult(null); setFilteredResult(null); setResultWindow(null); setDirectionFilter('ALL');
    try {
      const baseline = await runBatched(null, 'Baseline all-day');
      setResult(baseline);
      const cutoff = entryBeforeValue(windowFilter);
      const filtered = cutoff ? await runBatched(cutoff, `Filtered before ${cutoff}`) : baseline;
      setFilteredResult(filtered); setResultWindow(windowFilter); saveCompleted(baseline, filtered);
    } catch (e) { setError(e instanceof Error ? e.message : 'Backtest failed.'); }
    finally { setRunning(false); setProgress(''); }
  }

  async function runMultiPeriod() {
    if (!symbols.length) return;
    setMultiRunning(true); setMultiResults([]); setMultiDirection('ALL'); setError(null); setProgress('');
    const completed: MultiPeriodResult[] = [];
    const runId = `multi-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const createdAt = new Date().toISOString();
    const baseSaved: SavedMultiValidation = { id: runId, createdAt, status: 'running', universeMode, symbolsText, startDate, endDate, minRR, results: [] };
    try {
      await saveMultiValidation(baseSaved);
      await refreshMultiHistory();
      for (let i = 0; i < periodSpecs.length; i++) {
        const period = periodSpecs[i];
        const prefix = `${period.label} (${period.startDate} → ${period.endDate})`;
        setMultiProgress(`${prefix}: all-day baseline`);
        const allDay = await runBatched(null, `${prefix} · All day`, period.startDate, period.endDate);
        setMultiProgress(`${prefix}: before 10:30`);
        const before1030 = await runBatched('10:30', `${prefix} · Before 10:30`, period.startDate, period.endDate);
        setMultiProgress(`${prefix}: before 12:00`);
        const before1200 = await runBatched('12:00', `${prefix} · Before 12:00`, period.startDate, period.endDate);
        completed.push({ ...period, allDay, before1030, before1200 });
        setMultiResults([...completed]);
        await saveMultiValidation({ ...baseSaved, status: 'running', results: [...completed] });
        await refreshMultiHistory();
      }
      await saveMultiValidation({ ...baseSaved, status: 'complete', results: [...completed] });
      await refreshMultiHistory();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Multi-period validation failed.';
      setError(message);
      try { await saveMultiValidation({ ...baseSaved, status: 'failed', results: [...completed], error: message }); await refreshMultiHistory(); }
      catch { /* preserve any already-saved checkpoints */ }
    } finally { setMultiRunning(false); setMultiProgress(''); setProgress(''); }
  }

  return <div className="space-y-5">
    <div><h1 className="text-xl font-bold flex items-center gap-2"><FlaskConical size={20}/>Scanner Backtest</h1><p className="text-sm text-slate-500 mt-1">Replay AlphaPilot's technical MTF + safety logic on historical NSE candles without changing the live scanner.</p></div>

    <Card><CardHeader title="Historical test" subtitle="Phase 1 · underlying-price validation · up to 31 calendar days per run"/><CardBody>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <label className="text-xs font-medium">Universe<select className="block mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2.5 text-sm" value={universeMode} onChange={e => setUniverseMode(e.target.value as UniverseMode)}><option value="CUSTOM">Custom symbols</option><option value="FNO44">Full 44-stock F&amp;O universe</option></select></label>
        {universeMode === 'CUSTOM' ? <Input label="Symbols (comma separated)" value={symbolsText} onChange={setSymbolsText}/> : <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2.5"><p className="text-xs text-slate-500">Universe size</p><p className="text-sm font-semibold">44 stocks · batches of {BACKTEST_BATCH_SIZE}</p></div>}
        <Input label="Start date" type="date" value={startDate} onChange={setStartDate}/>
        <Input label="End date" type="date" value={endDate} onChange={setEndDate}/>
        <label className="text-xs font-medium">Comparison entry window<select className="block mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2.5 text-sm" value={windowFilter} onChange={e => setWindowFilter(e.target.value as WindowFilter)}><option value="ALL">All day</option><option value="BEFORE_1030">Before 10:30</option><option value="BEFORE_1200">Before 12:00</option></select></label>
        <div className="space-y-3"><Input label="Min Risk/Reward" type="number" value={minRR} onChange={setMinRR}/><Button variant="primary" onClick={run} disabled={running || multiRunning || symbols.length === 0}><Play size={15} className="inline mr-1.5"/>{running ? 'Running comparison...' : 'Run Backtest'}</Button></div>
      </div>
      <p className="text-[11px] text-slate-500 mt-3">Full-universe mode processes the same 44 liquid F&amp;O stocks as the live scanner in batches of {BACKTEST_BATCH_SIZE} to reduce Render/Groww load. The baseline always runs all-day; a selected cutoff triggers a separate server-side historical run.</p>
      {progress && !multiRunning && <p className="text-xs font-medium text-blue-600 mt-2">{progress}</p>}
    </CardBody></Card>

    <Card><CardHeader title="Multi-Period Validation" subtitle="Backtest-only robustness test across the selected period plus the two immediately preceding equal-length periods."/><CardBody>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">3 periods × All day / Before 10:30 / Before 12:00</p>
          <p className="text-xs text-slate-500 mt-1">{periodSpecs.map(p => `${p.startDate} → ${p.endDate}`).join(' · ')}</p>
          <p className="text-[11px] text-slate-500 mt-2">This is intentionally heavier than a normal backtest and can take several minutes for the 44-stock universe. Each completed period is checkpoint-saved automatically. Live scanner rules remain unchanged.</p>
        </div>
        <Button variant="primary" onClick={runMultiPeriod} disabled={running || multiRunning || symbols.length === 0}><Play size={15} className="inline mr-1.5"/>{multiRunning ? 'Running 3-period validation...' : 'Run 3-Period Validation'}</Button>
      </div>
      {multiProgress && <p className="text-xs font-medium text-blue-600 mt-3">{multiProgress}</p>}
    </CardBody></Card>

    {multiResults.length > 0 && <Card><CardHeader title="Multi-Period Results" subtitle="Compare whether an entry-window edge survives across different periods before changing live execution rules."/><CardBody>
      <div className="flex items-end gap-4 mb-4"><label className="text-xs font-medium">Direction<select className="block mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2" value={multiDirection} onChange={e => setMultiDirection(e.target.value as DirectionFilter)}><option value="ALL">All</option><option value="BUY CE">BUY CE</option><option value="BUY PE">BUY PE</option></select></label><p className="text-xs text-slate-500 pb-2">Recalculates from the completed historical trades; no rerun required.</p></div>
      <MultiPeriodTable results={multiResults} direction={multiDirection} combined={multiCombined}/>
    </CardBody></Card>}

    {multiHistory.length > 0 && <Card><CardHeader title="Multi-Period History" subtitle="3-period validations are stored durably in this browser, including completed trade data and partial checkpoints."/><CardBody><div className="space-y-2">{multiHistory.map(saved => <div key={saved.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><div className="flex items-center gap-2 flex-wrap"><p className="text-sm font-semibold">3-Period Validation · {saved.universeMode === 'FNO44' ? 'Full 44-stock F&O universe' : saved.symbolsText}</p><Badge variant={saved.status === 'complete' ? 'green' : saved.status === 'failed' ? 'red' : 'blue'}>{saved.status === 'complete' ? 'COMPLETE' : saved.status === 'failed' ? 'PARTIAL' : 'IN PROGRESS'}</Badge></div><p className="text-xs text-slate-500 mt-1">{saved.startDate} → {saved.endDate} · R:R {saved.minRR} · {saved.results.length}/3 periods saved · {new Date(saved.createdAt).toLocaleString('en-IN')}</p>{saved.error && <p className="text-xs text-red-500 mt-1">{saved.error}</p>}</div><div className="flex flex-wrap gap-2"><Button variant="ghost" disabled={saved.results.length === 0} onClick={() => restoreMulti(saved, 'ALL')}><RotateCcw size={14} className="inline mr-1"/>All</Button><Button variant="ghost" disabled={saved.results.length === 0} onClick={() => restoreMulti(saved, 'BUY CE')}>BUY CE</Button><Button variant="ghost" disabled={saved.results.length === 0} onClick={() => restoreMulti(saved, 'BUY PE')}>BUY PE</Button><Button variant="ghost" onClick={() => void removeMultiSaved(saved.id)}><Trash2 size={14}/></Button></div></div>)}</div><p className="text-[11px] text-slate-500 mt-3">Opening a saved validation restores the full table and direction analysis without rerunning the backend. A refresh or navigation no longer removes completed multi-period results.</p></CardBody></Card>}

    {history.length > 0 && <Card><CardHeader title="Backtest History" subtitle="Completed single-period runs are saved in this browser and can be reopened by direction without rerunning the backend."/><CardBody><div className="space-y-2">{history.map(saved => <div key={saved.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><p className="text-sm font-semibold">{saved.universeMode === 'FNO44' ? 'Full 44-stock F&O universe' : saved.symbolsText} · {windowLabel(saved.windowFilter)}</p><p className="text-xs text-slate-500 mt-1">{saved.startDate} → {saved.endDate} · R:R {saved.minRR} · {new Date(saved.createdAt).toLocaleString('en-IN')}</p><p className="text-xs mt-1">Baseline {saved.baseline.summary.trades} trades / {saved.baseline.summary.total_r > 0 ? '+' : ''}{saved.baseline.summary.total_r.toFixed(2)}R · Filtered {saved.filtered.summary.trades} trades / {saved.filtered.summary.total_r > 0 ? '+' : ''}{saved.filtered.summary.total_r.toFixed(2)}R</p></div><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => restore(saved, true, 'ALL')}><RotateCcw size={14} className="inline mr-1"/>All</Button><Button variant="ghost" onClick={() => restore(saved, true, 'BUY CE')}>BUY CE</Button><Button variant="ghost" onClick={() => restore(saved, true, 'BUY PE')}>BUY PE</Button><Button variant="ghost" onClick={() => removeSaved(saved.id)}><Trash2 size={14}/></Button></div></div>)}</div><p className="text-[11px] text-slate-500 mt-3">Open All, BUY CE or BUY PE directly. Direction views are calculated from the saved trade data and do not trigger a new historical request.</p></CardBody></Card>}

    <Card><CardBody><div className="flex items-start gap-3"><AlertTriangle className="text-amber-500 shrink-0" size={19}/><div className="text-xs text-slate-600 dark:text-slate-400"><b>Important:</b> this validates the underlying scanner strategy, not historical option-premium P&amp;L. BUY CE / BUY PE indicates historical direction. Historical option chain, IV, OI, Greeks, news/GIFT context and live F&amp;O confirmation are not reconstructed.</div></div></CardBody></Card>
    {error && <Card><CardBody><p className="font-semibold text-red-600">Backtest error</p><p className="text-sm text-slate-500 mt-1 break-words">{error}</p></CardBody></Card>}

    {result && <>
      <Card><CardHeader title="Direction Analysis" subtitle="Switch between all historical trades, BUY CE only and BUY PE only. No rerun required."/><CardBody><div className="flex items-end gap-4"><label className="text-xs font-medium">Direction<select className="block mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2" value={directionFilter} onChange={e => setDirectionFilter(e.target.value as DirectionFilter)}><option value="ALL">All</option><option value="BUY CE">BUY CE</option><option value="BUY PE">BUY PE</option></select></label><p className="text-xs text-slate-500 pb-2">Showing {directionLabel(directionFilter)} from the loaded/saved baseline.</p></div></CardBody></Card>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3"><Stat label="Trades" value={String(displaySummary.trades)}/><Stat label="Win rate" value={`${displaySummary.winRate.toFixed(1)}%`}/><Stat label="Wins / Losses" value={`${displaySummary.wins} / ${displaySummary.losses}`}/><Stat label="Total R" value={`${displaySummary.totalR > 0 ? '+' : ''}${displaySummary.totalR.toFixed(2)}R`}/><Stat label="Average R" value={`${displaySummary.avgR > 0 ? '+' : ''}${displaySummary.avgR.toFixed(2)}R`}/><Stat label="Max Drawdown" value={`${displaySummary.drawdown.toFixed(2)}R`}/></div>

      {!comparisonFresh && <Card><CardBody><p className="font-semibold">Rerun required</p><p className="text-sm text-slate-500 mt-1">The comparison window changed. Run the backtest again so the backend validates the new cutoff. Your previous completed run remains available in Backtest History.</p></CardBody></Card>}
      {comparison && <Card><CardHeader title="Strategy Filter Comparison" subtitle={`Backend-validated entry window: ${windowLabel(windowFilter)} · ${directionLabel(directionFilter)}. Live scanner rules are unchanged.`}/><CardBody>
        <CompareTable baseline={comparison.baseline} filtered={comparison.filtered}/>
      </CardBody></Card>}

      {breakdown && <Card><CardHeader title="Performance Breakdown" subtitle={`${directionLabel(directionFilter)} view. Symbol, time and exit tables follow the selected direction; By direction keeps the full baseline comparison.`}/><CardBody><div className="grid grid-cols-1 xl:grid-cols-2 gap-5"><Breakdown title="By symbol" rows={breakdown.bySymbol}/><Breakdown title="By direction" rows={breakdown.byDirection}/><Breakdown title="By entry time" rows={breakdown.byTime}/><Breakdown title="By exit type" rows={breakdown.byExit}/></div></CardBody></Card>}

      <Card><CardHeader title="Historical trades" subtitle={`${result.start_date} → ${result.end_date} · ${directionLabel(directionFilter)} · baseline all-day trades`}/><CardBody className="space-y-2">{displayTrades.length === 0 ? <p className="text-sm text-slate-500">No historical trades match this direction.</p> : displayTrades.map((t,i) => <div key={`${t.symbol}-${t.timestamp}-${i}`} className="rounded-lg border border-slate-200 dark:border-slate-800 p-4"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><div className="flex gap-2 items-center flex-wrap"><b>{i+1}. {t.symbol}</b><Badge variant={t.action === 'BUY CE' ? 'green' : 'blue'}>{t.action}</Badge><Badge variant={t.r_multiple > 0 ? 'green' : t.r_multiple < 0 ? 'red' : 'blue'}>{t.outcome}</Badge></div><p className="text-xs text-slate-500 mt-1">{new Date(t.timestamp).toLocaleString('en-IN')} · MTF Alpha {t.mtf_alpha.toFixed(1)}/100</p></div><div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-right"><Mini label="Entry" value={money(t.entry)}/><Mini label="SL" value={money(t.stop_loss)}/><Mini label="Target 1" value={money(t.target1)}/><Mini label="Target 2" value={t.target2 == null ? '—' : money(t.target2)}/><Mini label="Exit" value={money(t.exit_price)}/><Mini label="Result" value={`${t.r_multiple > 0 ? '+' : ''}${t.r_multiple.toFixed(2)}R`}/></div></div></div>)}</CardBody></Card>
      {result.errors.length > 0 && <Card><CardHeader title={`Data errors (${result.errors.length})`}/><CardBody>{result.errors.map((e,i) => <p key={`${e.symbol}-${i}`} className="text-xs text-red-500"><b>{e.symbol}:</b> {e.error}</p>)}</CardBody></Card>}
      <Card><CardHeader title="What this test does not claim"/><CardBody className="space-y-1">{result.limitations.map((x,i) => <p key={i} className="text-xs text-slate-500">• {x}</p>)}</CardBody></Card>
    </>}
  </div>;
}

function MultiPeriodTable({ results, direction, combined }: { results: MultiPeriodResult[]; direction: DirectionFilter; combined: { allDay: ReturnType<typeof scenarioStats>; before1030: ReturnType<typeof scenarioStats>; before1200: ReturnType<typeof scenarioStats> } | null }) {
  const rows = results.flatMap(period => [
    { key: `${period.label}-all`, period: period.label, range: `${period.startDate} → ${period.endDate}`, window: 'All day', stats: scenarioStats(period.allDay, direction) },
    { key: `${period.label}-1030`, period: period.label, range: `${period.startDate} → ${period.endDate}`, window: 'Before 10:30', stats: scenarioStats(period.before1030, direction) },
    { key: `${period.label}-1200`, period: period.label, range: `${period.startDate} → ${period.endDate}`, window: 'Before 12:00', stats: scenarioStats(period.before1200, direction) },
  ]);
  const fmtR = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}R`;
  return <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900 text-slate-500"><tr><th className="text-left p-2">Period</th><th className="text-left p-2">Window</th><th className="text-right p-2">Trades</th><th className="text-right p-2">Win %</th><th className="text-right p-2">Total R</th><th className="text-right p-2">Avg R</th><th className="text-right p-2">Max DD</th></tr></thead><tbody>
    {rows.map(r => <tr key={r.key} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2"><b>{r.period}</b><div className="text-[10px] text-slate-500">{r.range}</div></td><td className="p-2 font-medium">{r.window}</td><td className="p-2 text-right">{r.stats.trades}</td><td className="p-2 text-right">{r.stats.winRate.toFixed(1)}%</td><td className={`p-2 text-right font-semibold ${r.stats.totalR > 0 ? 'text-emerald-600' : r.stats.totalR < 0 ? 'text-red-600' : ''}`}>{fmtR(r.stats.totalR)}</td><td className="p-2 text-right">{fmtR(r.stats.avgR)}</td><td className="p-2 text-right">{r.stats.drawdown.toFixed(2)}R</td></tr>)}
    {combined && <>
      <tr className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/70"><td className="p-2 font-bold" rowSpan={3}>Combined<br/><span className="text-[10px] font-normal text-slate-500">{directionLabel(direction)}</span></td><td className="p-2 font-semibold">All day</td><td className="p-2 text-right">{combined.allDay.trades}</td><td className="p-2 text-right">{combined.allDay.winRate.toFixed(1)}%</td><td className="p-2 text-right font-bold">{fmtR(combined.allDay.totalR)}</td><td className="p-2 text-right">{fmtR(combined.allDay.avgR)}</td><td className="p-2 text-right">{combined.allDay.drawdown.toFixed(2)}R</td></tr>
      <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70"><td className="p-2 font-semibold">Before 10:30</td><td className="p-2 text-right">{combined.before1030.trades}</td><td className="p-2 text-right">{combined.before1030.winRate.toFixed(1)}%</td><td className="p-2 text-right font-bold">{fmtR(combined.before1030.totalR)}</td><td className="p-2 text-right">{fmtR(combined.before1030.avgR)}</td><td className="p-2 text-right">{combined.before1030.drawdown.toFixed(2)}R</td></tr>
      <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70"><td className="p-2 font-semibold">Before 12:00</td><td className="p-2 text-right">{combined.before1200.trades}</td><td className="p-2 text-right">{combined.before1200.winRate.toFixed(1)}%</td><td className="p-2 text-right font-bold">{fmtR(combined.before1200.totalR)}</td><td className="p-2 text-right">{fmtR(combined.before1200.avgR)}</td><td className="p-2 text-right">{combined.before1200.drawdown.toFixed(2)}R</td></tr>
    </>}
  </tbody></table></div>;
}

function CompareTable({ baseline, filtered }: { baseline: BreakdownRow & { drawdown:number }; filtered: BreakdownRow & { drawdown:number } }) {
  const cells = [['Trades',baseline.trades,filtered.trades],['Win rate',`${baseline.winRate.toFixed(1)}%`,`${filtered.winRate.toFixed(1)}%`],['Total R',`${baseline.totalR>0?'+':''}${baseline.totalR.toFixed(2)}R`,`${filtered.totalR>0?'+':''}${filtered.totalR.toFixed(2)}R`],['Avg R',`${baseline.avgR>0?'+':''}${baseline.avgR.toFixed(2)}R`,`${filtered.avgR>0?'+':''}${filtered.avgR.toFixed(2)}R`],['Max drawdown',`${baseline.drawdown.toFixed(2)}R`,`${filtered.drawdown.toFixed(2)}R`]];
  return <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800"><table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="text-left p-3">Metric</th><th className="text-right p-3">Baseline</th><th className="text-right p-3">Filtered</th></tr></thead><tbody>{cells.map(c => <tr key={String(c[0])} className="border-t border-slate-200 dark:border-slate-800"><td className="p-3 font-medium">{c[0]}</td><td className="p-3 text-right">{c[1]}</td><td className="p-3 text-right font-semibold">{c[2]}</td></tr>)}</tbody></table></div>;
}
function Breakdown({ title, rows }: { title:string; rows:BreakdownRow[] }) { return <div><h3 className="text-sm font-semibold mb-2">{title}</h3><div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 max-h-96"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 sticky top-0"><tr><th className="text-left p-2">Group</th><th className="text-right p-2">Trades</th><th className="text-right p-2">W/L</th><th className="text-right p-2">Win %</th><th className="text-right p-2">Total R</th><th className="text-right p-2">Avg R</th></tr></thead><tbody>{rows.map(row => <tr key={row.label} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2 font-semibold whitespace-nowrap">{row.label}</td><td className="p-2 text-right">{row.trades}</td><td className="p-2 text-right">{row.wins}/{row.losses}</td><td className="p-2 text-right">{row.winRate.toFixed(1)}%</td><td className={`p-2 text-right font-semibold ${row.totalR>0?'text-emerald-600':row.totalR<0?'text-red-600':''}`}>{row.totalR>0?'+':''}{row.totalR.toFixed(2)}R</td><td className="p-2 text-right">{row.avgR>0?'+':''}{row.avgR.toFixed(2)}R</td></tr>)}</tbody></table></div></div>; }
function Stat({label,value}:{label:string;value:string}) { return <Card><CardBody><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold mt-1">{value}</p></CardBody></Card>; }
function Mini({label,value}:{label:string;value:string}) { return <div><p className="text-[10px] text-slate-500">{label}</p><p className="text-xs font-semibold mt-0.5 whitespace-nowrap">{value}</p></div>; }
