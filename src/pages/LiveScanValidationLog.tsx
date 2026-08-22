import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { FNO_SCAN_EVENT, type FnoScanResponse } from '@/lib/alphaPilotApi';

const STORAGE_KEY = 'alphapilot.liveScanValidationLog.v1';
const MAX_ENTRIES = 100;
const LIVE_TIMEFRAMES = ['5m', '15m', '1h'];

type ValidationEntry = {
  id: string;
  captured_at: string;
  symbol: string;
  decision: string;
  technical_score: number | null;
  fno_score: number | null;
  alpha_score: number | null;
  option_rr: number | null;
  execution_ready: boolean;
  blockers: string[];
  session_status: string;
  timeframes: Record<string, { state: string; alpha: number | null; latest_candle_at: string | null }>;
};

function loadEntries(): ValidationEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function optionRiskReward(result: FnoScanResponse) {
  const option = result.recommended_option ?? {};
  const entry = Number(option.option_entry ?? option.premium);
  const stop = Number(option.option_stop_loss);
  const target = Number(option.option_target1);
  const risk = entry - stop;
  const reward = target - entry;
  if (![entry, stop, target, risk, reward].every(Number.isFinite) || risk <= 0 || reward <= 0) return null;
  return reward / risk;
}

function optionState(value: unknown) {
  const state = String(value ?? '—').toUpperCase();
  if (state === 'LONG' || state === 'BUY CE') return 'BUY CE';
  if (state === 'SHORT' || state === 'BUY PE') return 'BUY PE';
  if (state === 'WATCH_LONG' || state === 'WATCH LONG' || state === 'WATCH BUY CE') return 'WATCH BUY CE';
  if (state === 'WATCH_SHORT' || state === 'WATCH SHORT' || state === 'WATCH BUY PE') return 'WATCH BUY PE';
  if (state === 'STRONG_LONG' || state === 'STRONG LONG') return 'STRONG BUY CE';
  if (state === 'STRONG_SHORT' || state === 'STRONG SHORT') return 'STRONG BUY PE';
  if (state === 'NO_TRADE' || state === 'NO TRADE') return 'NO TRADE';
  return String(value ?? '—').replaceAll('_', ' ');
}

function toEntry(result: FnoScanResponse): ValidationEntry {
  const tf = result.technical?.timeframes ?? {};
  const frames: ValidationEntry['timeframes'] = {};
  for (const name of LIVE_TIMEFRAMES) {
    const row = tf[name] ?? {};
    frames[name] = {
      state: optionState(row.direction ?? row.signal ?? row.market_structure ?? row.status ?? '—'),
      alpha: Number.isFinite(Number(row.alpha_score)) ? Number(row.alpha_score) : null,
      latest_candle_at: typeof row.latest_candle_at === 'string' ? row.latest_candle_at : null,
    };
  }
  const executionReady = result.execution_ready === true;
  return {
    id: `${Date.now()}-${result.symbol}`,
    captured_at: new Date().toISOString(),
    symbol: result.symbol,
    decision: optionState(executionReady ? result.signal ?? 'READY' : result.status === 'SETUP' ? 'BLOCKED SETUP' : result.signal ?? result.status ?? 'WAIT'),
    technical_score: Number.isFinite(Number(result.technical_score)) ? Number(result.technical_score) : null,
    fno_score: Number.isFinite(Number(result.fno_score)) ? Number(result.fno_score) : null,
    alpha_score: Number.isFinite(Number(result.overall_alpha_score)) ? Number(result.overall_alpha_score) : null,
    option_rr: optionRiskReward(result),
    execution_ready: executionReady,
    blockers: Array.isArray(result.execution_blockers) ? result.execution_blockers.map(String) : [],
    session_status: String(result.market_session?.status ?? result.market_session?.phase ?? (result.market_session?.is_open ? 'OPEN' : 'CLOSED')),
    timeframes: frames,
  };
}

function isOpenSession(status: string) {
  const normalized = status.toUpperCase();
  return normalized === 'OPEN' || normalized === 'CONTINUOUS';
}

function sameClosedSnapshot(a: ValidationEntry | undefined, b: ValidationEntry) {
  if (!a || isOpenSession(b.session_status)) return false;
  if (a.symbol !== b.symbol || a.session_status !== b.session_status) return false;
  if (optionState(a.decision) !== optionState(b.decision) || a.alpha_score !== b.alpha_score || a.technical_score !== b.technical_score || a.fno_score !== b.fno_score) return false;
  return LIVE_TIMEFRAMES.every(tf => {
    const left = a.timeframes?.[tf];
    const right = b.timeframes?.[tf];
    return left?.latest_candle_at === right?.latest_candle_at && optionState(left?.state) === optionState(right?.state) && left?.alpha === right?.alpha;
  });
}

export function LiveScanValidationLog() {
  const [entries, setEntries] = useState<ValidationEntry[]>(() => loadEntries());

  useEffect(() => {
    const onScan = (event: Event) => {
      const result = (event as CustomEvent<FnoScanResponse>).detail;
      if (!result?.symbol) return;
      setEntries(previous => {
        const entry = toEntry(result);
        if (sameClosedSnapshot(previous[0], entry)) return previous;
        const next = [entry, ...previous].slice(0, MAX_ENTRIES);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener(FNO_SCAN_EVENT, onScan);
    return () => window.removeEventListener(FNO_SCAN_EVENT, onScan);
  }, []);

  const latest = useMemo(() => entries.slice(0, 12), [entries]);
  const clear = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setEntries([]);
  };

  return (
    <Card>
      <CardHeader
        title="Live Scan Validation Log"
        subtitle="Automatically saves completed F&O scans in this browser; timeframe directions are shown as BUY CE / BUY PE actions and identical closed-session snapshots are collapsed."
        action={entries.length ? <Button size="sm" variant="ghost" onClick={clear}>Clear log</Button> : undefined}
      />
      <CardBody className="space-y-3">
        {!entries.length ? (
          <p className="text-sm text-slate-500">No scans saved yet. Run Single Symbol or Find Trade; completed F&O confirmations will appear here automatically.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span>{entries.length} scan{entries.length === 1 ? '' : 's'} saved</span>
              <span>· newest first</span>
              <span>· browser-local storage</span>
            </div>
            <div className="space-y-2">
              {latest.map(entry => (
                <div key={entry.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <b>{entry.symbol}</b>
                        <Badge variant={entry.execution_ready ? 'green' : 'blue'}>{entry.execution_ready ? 'READY' : 'WAIT'}</Badge>
                        <Badge variant={isOpenSession(entry.session_status) ? 'green' : 'red'}>{entry.session_status}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{formatTime(entry.captured_at)} · {optionState(entry.decision)}</p>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-right text-xs">
                      <Mini label="Technical" value={score(entry.technical_score)} />
                      <Mini label="F&O" value={score(entry.fno_score)} />
                      <Mini label="Alpha" value={score(entry.alpha_score)} />
                      <Mini label="Option R:R" value={entry.option_rr == null ? '—' : `${entry.option_rr.toFixed(2)}:1`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                    {LIVE_TIMEFRAMES.map(tf => {
                      const row = entry.timeframes[tf];
                      return <div key={tf} className="rounded-md bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-xs"><span className="text-slate-500">{tf}</span><p className="font-semibold mt-0.5">{optionState(row?.state)} · {score(row?.alpha ?? null)}</p><p className="text-[11px] text-slate-500 mt-0.5">{formatTime(row?.latest_candle_at)}</p></div>;
                    })}
                  </div>
                  {entry.blockers.length > 0 && <p className="text-xs text-amber-600 mt-2">Primary blocker: {entry.blockers[0]}</p>}
                </div>
              ))}
            </div>
            {entries.length > latest.length && <p className="text-xs text-slate-500">Showing latest {latest.length} of {entries.length} saved scans.</p>}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] text-slate-500">{label}</p><p className="font-semibold whitespace-nowrap">{value}</p></div>;
}

function score(value: number | null) {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}/100`;
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
}
