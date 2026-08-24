import { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui';
import type { ValidationRecord } from '@/lib/liveValidation';

type Bucket = { label: string; resolved: number; wins: number; winRate: number; averageR: number };

function realisedR(row: ValidationRecord): number | null {
  const entry = Number(row.option_entry);
  const stop = Number(row.option_stop);
  const t1 = Number(row.option_target1);
  const t2 = Number(row.option_target2);
  const risk = entry - stop;
  if (!Number.isFinite(entry) || !Number.isFinite(stop) || risk <= 0) return null;
  if (row.status === 'STOP_HIT') return -1;
  if (row.status === 'TARGET2_HIT' && Number.isFinite(t2) && t2 > entry) return (t2 - entry) / risk;
  if (row.status === 'TARGET1_HIT' && Number.isFinite(t1) && t1 > entry) return (t1 - entry) / risk;
  return null;
}

function utcDay(value: string): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function captureIstDay(capturedAt: string): number | null {
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return year && month && day ? utcDay(`${year}-${month}-${day}`) : null;
}

function dte(row: ValidationRecord): number | null {
  if (!row.expiry) return null;
  const expiry = utcDay(String(row.expiry).slice(0, 10));
  const captured = captureIstDay(row.captured_at);
  if (expiry == null || captured == null) return null;
  const days = Math.round((expiry - captured) / 86_400_000);
  return days >= 0 ? days : null;
}

function summarize(label: string, rows: ValidationRecord[]): Bucket {
  const resolved = rows.filter(row => ['TARGET1_HIT', 'TARGET2_HIT', 'STOP_HIT'].includes(row.status));
  const wins = resolved.filter(row => row.status === 'TARGET1_HIT' || row.status === 'TARGET2_HIT').length;
  const r = resolved.map(realisedR).filter((v): v is number => v !== null);
  return {
    label,
    resolved: resolved.length,
    wins,
    winRate: resolved.length ? wins / resolved.length * 100 : 0,
    averageR: r.length ? r.reduce((sum, value) => sum + value, 0) / r.length : 0,
  };
}

export function ExpiryProximityPerformance({ records }: { records: ValidationRecord[] }) {
  const data = useMemo(() => {
    const valid = records.filter(row => dte(row) != null);
    return [
      summarize('0 DTE · expiry day', valid.filter(row => dte(row) === 0)),
      summarize('1 DTE', valid.filter(row => dte(row) === 1)),
      summarize('2–3 DTE', valid.filter(row => { const value = dte(row); return value != null && value >= 2 && value <= 3; })),
      summarize('4+ DTE', valid.filter(row => { const value = dte(row); return value != null && value >= 4; })),
    ];
  }, [records]);

  const sample = data.reduce((sum, row) => sum + row.resolved, 0);

  return <Card>
    <CardHeader title="Expiry-Proximity Performance" subtitle="Forward outcomes grouped by calendar days-to-expiry (DTE) at the IST capture date. Analytics only; this does not alter option selection or execution gates." />
    <CardBody className="space-y-3">
      <div className="flex items-start gap-2 text-xs text-slate-500">
        <CalendarClock size={16} className="shrink-0 mt-0.5" />
        <p>{sample} resolved setup{sample === 1 ? '' : 's'} currently have usable expiry data. Near-expiry options can behave differently because premium sensitivity and decay change quickly, but no DTE bucket should become a live filter until it has sufficient forward evidence and survives out-of-sample testing.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {data.map(row => <div key={row.label} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
          <p className="text-xs font-semibold">{row.label}</p>
          <p className="text-lg font-bold mt-1">{row.averageR.toFixed(2)}R</p>
          <p className="text-xs text-slate-500 mt-1">{row.resolved} resolved · {row.wins} wins · {row.winRate.toFixed(1)}% win</p>
        </div>)}
      </div>
    </CardBody>
  </Card>;
}
