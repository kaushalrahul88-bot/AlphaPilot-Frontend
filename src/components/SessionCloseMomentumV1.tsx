import { useMemo, useState } from 'react';
import { Download, LockKeyhole, Play, RotateCcw } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { runSessionCloseMomentum, type SessionCloseMomentumResult, type SessionCloseVariant } from '@/lib/sessionCloseMomentumApi';

const BLOCKS = [
  { id: 'SCM-1', start: '2026-04-13', end: '2026-04-24' },
  { id: 'SCM-2', start: '2026-04-27', end: '2026-05-08' },
  { id: 'SCM-3', start: '2026-05-11', end: '2026-05-22' },
  { id: 'SCM-4', start: '2026-05-25', end: '2026-06-05' },
  { id: 'SCM-5', start: '2026-06-08', end: '2026-06-19' },
  { id: 'SCM-6', start: '2026-06-22', end: '2026-07-03' },
] as const;

const STORAGE_KEY = 'alphapilot:session-close-momentum-v1';
const VARIANTS: SessionCloseVariant[] = ['OPENING_SIGN', 'PRE_CLOSE_SIGN', 'OPENING_PRE_CLOSE_AGREEMENT'];

function readResults() {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed as Record<string, SessionCloseMomentumResult> : {};
  } catch {
    return {};
  }
}

function saveResults(results: Record<string, SessionCloseMomentumResult>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
}

function variantLabel(value: SessionCloseVariant) {
  if (value === 'OPENING_SIGN') return 'Opening 30m sign';
  if (value === 'PRE_CLOSE_SIGN') return 'Open → 15:00 sign';
  return 'Opening + pre-close agreement';
}

function number(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

export function SessionCloseMomentumV1() {
  const [results, setResults] = useState<Record<string, SessionCloseMomentumResult>>(readResults);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const completed = Object.keys(results).filter(id => BLOCKS.some(block => block.id === id)).length;
  const observations = Object.values(results).reduce((sum, result) => sum + result.observations, 0);
  const dataErrors = Object.values(results).reduce((sum, result) => sum + result.errors.length, 0);

  const replication = useMemo(() => VARIANTS.map(variant => {
    const rows = BLOCKS.flatMap(block => results[block.id]?.summaries.filter(row => row.variant === variant) ?? []);
    const passing = rows.filter(row => row.state === 'PROMISING');
    const trades = rows.reduce((sum, row) => sum + row.trades, 0);
    const weightedR = trades ? rows.reduce((sum, row) => sum + row.average_r * row.trades, 0) / trades : 0;
    return { variant, rows, passing, trades, weightedR, replicated: passing.length >= 4 };
  }), [results]);
  const replicated = replication.filter(row => row.replicated);

  async function run() {
    setRunning(true);
    setError(null);
    let working = { ...results };
    try {
      for (const block of BLOCKS) {
        if (working[block.id]) continue;
        setCurrent(block.id);
        const result = await runSessionCloseMomentum(block.start, block.end);
        if (result.production_rules_changed || result.paper_trading_permission_changed || result.live_execution_enabled) {
          throw new Error(`${block.id} returned invalid research safety flags.`);
        }
        working = { ...working, [block.id]: result };
        setResults(working);
        saveResults(working);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Session-Close Momentum research failed.');
    } finally {
      setCurrent(null);
      setRunning(false);
    }
  }

  function reset() {
    if (!window.confirm('Reset the browser-local Session-Close Momentum v1 run? The frozen protocol will not change.')) return;
    window.localStorage.removeItem(STORAGE_KEY);
    setResults({});
    setError(null);
  }

  function exportLedger() {
    const payload = {
      schema: 'alphapilot-session-close-momentum-v1-ledger',
      exported_at: new Date().toISOString(),
      blocks: BLOCKS,
      results,
      decision: completed < 6 ? 'INCOMPLETE' : replicated.length ? 'REPLICATED_CANDIDATE' : 'NO_REPLICATED_EDGE',
      replicated_variants: replicated.map(row => row.variant),
      production_rules_changed: false,
      paper_trading_permission_changed: false,
      live_execution_enabled: false,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `alphapilot-session-close-momentum-v1-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const decision = completed < 6 ? 'INCOMPLETE' : replicated.length ? 'REPLICATED_CANDIDATE' : 'NO_REPLICATED_EDGE';
  return <Card>
    <CardHeader title="Session-Close Momentum v1 — Academic Intraday Timing" subtitle="Tests whether early-session direction predicts the final NSE half-hour. Fixed development only; no production changes." action={<LockKeyhole size={18} className="text-violet-500" />} />
    <CardBody className="space-y-4">
      <div className="flex flex-wrap gap-2"><Badge variant="blue">NEW HYPOTHESIS FAMILY</Badge><Badge variant="default">NIFTY + BANKNIFTY</Badge><Badge variant="default">6 FIXED BLOCKS</Badge><Badge variant="default">15:00 ENTRY</Badge><Badge variant="default">15:25 EXIT</Badge><Badge variant="default">4-OF-6 REPLICATION</Badge><Badge variant="default">RESEARCH ONLY</Badge></div>
      <div className="rounded-lg border border-violet-200 p-3 text-xs dark:border-violet-900">
        <p className="font-semibold">Source: Gao, Han, Li &amp; Zhou (2018), Market intraday momentum</p>
        <p className="mt-1 text-slate-500">The peer-reviewed hypothesis is that the first half-hour market return predicts the final half-hour. AlphaPilot preregisters three signals before seeing results: opening sign, open-to-15:00 sign, and their agreement. <a className="text-blue-600 underline" href="https://doi.org/10.1016/j.jfineco.2018.05.009" target="_blank" rel="noreferrer">Journal paper</a></p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-4xl text-xs text-slate-500">Every trade enters at the 15:00 IST open, uses a fixed 0.75-ATR stop and 1R target, deducts 2 bps underlying round-trip cost, and exits no later than the 15:25 close. A block passes only with ≥12 resolved trades, Avg R ≥ +0.10R, win rate ≥55% and PF ≥1.20.</p>
        <div className="flex gap-2"><Button variant="primary" onClick={() => void run()} disabled={running || completed === 6}><Play size={14} className="inline mr-1" />{running ? `Running ${current}…` : completed ? 'Resume frozen run' : 'Run frozen research'}</Button><Button variant="default" onClick={exportLedger} disabled={!completed}><Download size={14} className="inline mr-1" />Export ledger</Button><Button variant="ghost" onClick={reset} disabled={running || !completed}><RotateCcw size={14} className="inline mr-1" />Reset</Button></div>
      </div>
      {error && <div className="rounded-lg border border-red-200 p-3 text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3"><Stat label="Completed" value={`${completed}/6`} /><Stat label="Observations" value={String(observations)} /><Stat label="Data errors" value={String(dataErrors)} /><Stat label="Replicated" value={String(replicated.length)} /><div className="rounded-lg border p-3"><p className="text-xs text-slate-500">Decision</p><Badge variant={replicated.length ? 'blue' : 'default'}>{decision}</Badge></div></div>
      <div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-2 text-left">Block</th><th>Dates</th><th>Sessions</th><th>Observations</th><th>Promising</th><th>Errors</th><th>Status</th></tr></thead><tbody>{BLOCKS.map(block => { const result = results[block.id]; return <tr key={block.id} className="border-t"><td className="p-2 font-semibold">{block.id}</td><td className="text-center">{block.start} → {block.end}</td><td className="text-center">{result?.sessions ?? '—'}</td><td className="text-center">{result?.observations ?? '—'}</td><td className="text-center">{result?.summaries.filter(row => row.state === 'PROMISING').length ?? '—'}</td><td className="text-center">{result?.errors.length ?? '—'}</td><td className="text-center"><Badge variant={result ? 'green' : current === block.id ? 'blue' : 'default'}>{result ? 'COMPLETE' : current === block.id ? 'RUNNING' : 'PENDING'}</Badge></td></tr>; })}</tbody></table></div>
      {completed > 0 && <div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead><tr><th className="p-2 text-left">Frozen variant</th><th>Passing blocks</th><th>Combined trades</th><th>Weighted Avg R</th><th>Replication</th></tr></thead><tbody>{replication.map(row => <tr key={row.variant} className="border-t"><td className="p-2 font-medium">{variantLabel(row.variant)}</td><td className="text-center">{row.passing.length}/6</td><td className="text-center">{row.trades}</td><td className="text-center">{row.weightedR >= 0 ? '+' : ''}{number(row.weightedR, 3)}R</td><td className="text-center"><Badge variant={row.replicated ? 'blue' : 'default'}>{row.replicated ? 'REPLICATED' : completed === 6 ? 'REJECTED' : 'PENDING'}</Badge></td></tr>)}</tbody></table></div>}
      <p className="text-[11px] text-slate-500">No post-result magnitude, volatility, volume, weekday or news filter is permitted. Replication only nominates a frozen candidate for true CE/PE premium validation; it does not authorize paper or live trading.</p>
    </CardBody>
  </Card>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold">{value}</p></div>;
}
