import { useMemo, useState } from 'react';
import { CalendarRange, Play } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

type Trade = {
  symbol: string;
  option_entry_at?: string | null;
  option_exit_at?: string | null;
  option_entry?: number | null;
  option_exit?: number | null;
  option_contract?: string | null;
  premium_risk_percent?: number | null;
  net_r?: number | null;
  strike?: number | null;
};

type Result = { trades?: Trade[]; errors?: unknown[] };

type ReplayRow = Trade & {
  n: number;
  before: number;
  pnl: number;
  after: number;
  dayPnl: number;
  targetHit: boolean;
  stopHit: boolean;
};

const START = '2026-08-01';
const END = '2026-08-25';
const STARTING_CAPITAL = 12000;
const DAILY_TARGET = 3000;
const DAILY_STOP = 1800;

const GROUPS = [
  ['RELIANCE','HDFCBANK','ICICIBANK','SBIN','TCS','INFY','TATASTEEL','MARUTI'],
  ['AXISBANK','KOTAKBANK','LT','HINDALCO','ONGC','HCLTECH','JSWSTEEL','M&M'],
  ['SUNPHARMA','DRREDDY','CIPLA','ITC','TITAN','ADANIPORTS','BAJFINANCE','BHARTIARTL'],
];

function dateRanges() {
  return [
    { start: '2026-08-01', end: '2026-08-14' },
    { start: '2026-08-15', end: '2026-08-25' },
  ];
}

async function fetchBlock(symbols: string[], start: string, end: string): Promise<Result> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/research/candidate-h-option-oos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols, start_date: start, end_date: end, max_signals: 120 }),
  });
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.detail ? `: ${body.detail}` : '';
    } catch {}
    throw new Error(`API ${response.status}${detail}`);
  }
  return response.json();
}

function money(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function premium(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? `₹${value.toFixed(2)}` : '—';
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function tradingDay(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function CandidateHMonthReplay() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const replay = useMemo(() => {
    const trades = results
      .flatMap((x) => x.trades ?? [])
      .filter((t) => typeof t.net_r === 'number' && typeof t.premium_risk_percent === 'number')
      .sort((a, b) => String(a.option_entry_at ?? '').localeCompare(String(b.option_entry_at ?? '')));

    let capital = STARTING_CAPITAL;
    let currentDay = '';
    let dayStartCapital = capital;
    let dayPnl = 0;
    let targetDays = 0;
    let stopDays = 0;
    let skipped = 0;
    let peak = capital;
    let maxDrawdown = 0;
    let below1000At: string | null = null;
    const rows: ReplayRow[] = [];

    for (const trade of trades) {
      const day = tradingDay(trade.option_entry_at);
      if (day !== currentDay) {
        currentDay = day;
        dayStartCapital = capital;
        dayPnl = 0;
      }

      if (dayPnl >= DAILY_TARGET || dayPnl <= -DAILY_STOP) {
        skipped += 1;
        continue;
      }

      const before = capital;
      const riskFraction = Number(trade.premium_risk_percent) / 100;
      const pnl = before * riskFraction * Number(trade.net_r);
      capital = Math.max(0, before + pnl);
      dayPnl = capital - dayStartCapital;
      peak = Math.max(peak, capital);
      const drawdown = peak > 0 ? ((peak - capital) / peak) * 100 : 0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      if (!below1000At && capital < 1000 && trade.option_entry_at) below1000At = trade.option_entry_at;

      const targetHit = dayPnl >= DAILY_TARGET;
      const stopHit = dayPnl <= -DAILY_STOP;
      if (targetHit) targetDays += 1;
      if (stopHit) stopDays += 1;

      rows.push({ ...trade, n: rows.length + 1, before, pnl, after: capital, dayPnl, targetHit, stopHit });
    }

    return {
      rows,
      ending: capital,
      returnPct: ((capital / STARTING_CAPITAL) - 1) * 100,
      targetDays,
      stopDays,
      skipped,
      maxDrawdown,
      below1000At,
    };
  }, [results]);

  async function runReplay() {
    setRunning(true);
    setError(null);
    setResults([]);
    try {
      const collected: Result[] = [];
      const ranges = dateRanges();
      let step = 0;
      const total = ranges.length * GROUPS.length;
      for (const range of ranges) {
        for (const group of GROUPS) {
          step += 1;
          setProgress(`August replay ${step}/${total} · ${range.start} → ${range.end}`);
          collected.push(await fetchBlock(group, range.start, range.end));
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
      }
      setResults(collected);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Month replay failed.');
    } finally {
      setProgress('');
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Candidate H — ₹12,000 August Capital Survival"
        subtitle="1–25 Aug replay · daily target ₹3,000 · daily SL ₹1,800."
        action={<CalendarRange size={18} className="text-violet-500" />}
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="blue">01–25 AUG 2026</Badge>
          <Badge variant="default">START ₹12,000</Badge>
          <Badge variant="default">TARGET +₹3,000</Badge>
          <Badge variant="default">SL −₹1,800</Badge>
          <Badge variant="default">REAL OPTION CANDLES</Badge>
          <Badge variant="default">WHAT-IF ONLY</Badge>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Trades are replayed chronologically. Trading stops for the rest of a day after account P&L reaches +₹3,000 or −₹1,800, then resumes the next session. Buy and sell premiums come from the historical Candidate H 1R option replay.
          </p>
          <Button variant="primary" onClick={runReplay} disabled={running}>
            <Play size={14} className="inline mr-1" />
            {running ? 'Running August replay…' : 'Run 1–25 Aug ₹12k Replay'}
          </Button>
        </div>

        {progress && <div className="rounded-lg border p-3 text-xs">{progress}</div>}
        {error && <div className="rounded-lg border border-red-200 p-3 text-sm text-red-600">{error}</div>}

        {results.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Starting capital" value={money(STARTING_CAPITAL)} />
              <Stat label="Trades taken" value={String(replay.rows.length)} />
              <Stat label="Ending capital" value={money(replay.ending)} />
              <Stat label="Total return" value={`${replay.returnPct >= 0 ? '+' : ''}${replay.returnPct.toFixed(1)}%`} />
              <Stat label="Target-hit days" value={String(replay.targetDays)} />
              <Stat label="SL-hit days" value={String(replay.stopDays)} />
              <Stat label="Signals skipped after gate" value={String(replay.skipped)} />
              <Stat label="Max drawdown" value={`${replay.maxDrawdown.toFixed(1)}%`} />
              <Stat label="Capital below ₹1,000" value={replay.below1000At ? formatTime(replay.below1000At) : 'NOT REACHED'} />
            </div>

            <div className="overflow-x-auto rounded-lg border max-h-[34rem]">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left">#</th><th>Buy time</th><th>Sell time</th><th>Symbol</th><th>Contract</th><th>Buy</th><th>Sell</th><th>Net R</th><th>Trade P&L</th><th>Day P&L</th><th>Capital</th><th>Gate</th>
                  </tr>
                </thead>
                <tbody>
                  {replay.rows.map((row) => (
                    <tr className="border-t" key={`${row.n}-${row.symbol}-${row.option_entry_at ?? ''}`}>
                      <td className="p-2">{row.n}</td>
                      <td className="text-center">{formatTime(row.option_entry_at)}</td>
                      <td className="text-center">{formatTime(row.option_exit_at)}</td>
                      <td className="text-center font-medium">{row.symbol}</td>
                      <td className="text-center">{row.option_contract ?? `${row.strike ?? '—'} CE`}</td>
                      <td className="text-center font-semibold">{premium(row.option_entry)}</td>
                      <td className="text-center font-semibold">{premium(row.option_exit)}</td>
                      <td className="text-center">{Number(row.net_r) >= 0 ? '+' : ''}{Number(row.net_r).toFixed(3)}R</td>
                      <td className="text-center">{row.pnl >= 0 ? '+' : ''}{money(row.pnl)}</td>
                      <td className="text-center font-semibold">{row.dayPnl >= 0 ? '+' : ''}{money(row.dayPnl)}</td>
                      <td className="text-center font-semibold">{money(row.after)}</td>
                      <td className="text-center">{row.targetHit ? 'TARGET HIT — STOP' : row.stopHit ? 'SL HIT — STOP' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold">{value}</p></div>;
}
