import { Clock3 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui';
import type { ValidationRecord } from '@/lib/liveValidation';

type Row = {
  label: string;
  total: number;
  wins: number;
  winRate: number;
  avgR: number;
};

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

function istMinutes(timestamp: string): number | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
}

function summarize(label: string, rows: ValidationRecord[]): Row {
  const resolved = rows.filter(row => ['TARGET1_HIT', 'TARGET2_HIT', 'STOP_HIT'].includes(row.status));
  const wins = resolved.filter(row => row.status === 'TARGET1_HIT' || row.status === 'TARGET2_HIT').length;
  const rValues = resolved.map(realisedR).filter((value): value is number => value !== null);
  return {
    label,
    total: resolved.length,
    wins,
    winRate: resolved.length ? wins / resolved.length * 100 : 0,
    avgR: rValues.length ? rValues.reduce((sum, value) => sum + value, 0) / rValues.length : 0,
  };
}

export function TimeOfDayPerformance({ records }: { records: ValidationRecord[] }) {
  const resolved = records.filter(row => ['TARGET1_HIT', 'TARGET2_HIT', 'STOP_HIT'].includes(row.status));
  const buckets = [
    summarize('09:15–10:15', resolved.filter(row => { const m = istMinutes(row.captured_at); return m != null && m >= 555 && m < 615; })),
    summarize('10:15–11:30', resolved.filter(row => { const m = istMinutes(row.captured_at); return m != null && m >= 615 && m < 690; })),
    summarize('11:30–13:30', resolved.filter(row => { const m = istMinutes(row.captured_at); return m != null && m >= 690 && m < 810; })),
    summarize('13:30–15:30', resolved.filter(row => { const m = istMinutes(row.captured_at); return m != null && m >= 810 && m <= 930; })),
  ];

  return <Card>
    <CardHeader
      title="Time-of-Day Performance"
      subtitle="Forward outcomes grouped by the IST capture time of execution-ready setups. Analytics only; no live session filter is changed."
    />
    <CardBody className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
        <Clock3 size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500">Use these buckets only after each period has a meaningful sample. A strong-looking window based on a few trades is hypothesis generation, not a reason to alter the live scanner.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
            <tr><th className="text-left p-2">IST capture window</th><th className="text-right p-2">Resolved</th><th className="text-right p-2">Wins</th><th className="text-right p-2">Win %</th><th className="text-right p-2">Avg R</th></tr>
          </thead>
          <tbody>{buckets.map(row => <tr key={row.label} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2 font-semibold">{row.label}</td><td className="p-2 text-right">{row.total}</td><td className="p-2 text-right">{row.wins}</td><td className="p-2 text-right">{row.winRate.toFixed(1)}%</td><td className="p-2 text-right font-semibold">{row.avgR.toFixed(2)}R</td></tr>)}</tbody>
        </table>
      </div>
    </CardBody>
  </Card>;
}
