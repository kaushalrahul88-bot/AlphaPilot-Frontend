import { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui';
import type { ValidationRecord } from '@/lib/liveValidation';

type DayRow = {
  label: string;
  total: number;
  wins: number;
  winRate: number;
  averageR: number;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

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

function weekdayIst(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(date);
}

function summarize(label: string, rows: ValidationRecord[]): DayRow {
  const wins = rows.filter(row => row.status === 'TARGET1_HIT' || row.status === 'TARGET2_HIT').length;
  const rValues = rows.map(realisedR).filter((value): value is number => value !== null);
  return {
    label,
    total: rows.length,
    wins,
    winRate: rows.length ? wins / rows.length * 100 : 0,
    averageR: rValues.length ? rValues.reduce((sum, value) => sum + value, 0) / rValues.length : 0,
  };
}

export function DayOfWeekPerformance({ records }: { records: ValidationRecord[] }) {
  const rows = useMemo(() => {
    const closed = records.filter(row => ['TARGET1_HIT', 'TARGET2_HIT', 'STOP_HIT'].includes(row.status));
    return DAYS.map(day => summarize(day, closed.filter(row => weekdayIst(row.captured_at) === day)));
  }, [records]);

  return <Card>
    <CardHeader
      title="Day-of-Week Performance"
      subtitle="Resolved execution-ready setups grouped by IST capture day. Evidence only; this does not alter live scanner behavior."
    />
    <CardBody className="space-y-3">
      <div className="flex items-start gap-2 text-xs text-slate-500">
        <CalendarDays size={16} className="shrink-0 mt-0.5" />
        <p>Weekday differences can easily be noise in a small sample. Do not disable or favor any trading day until each day has enough forward observations and the pattern survives an independent out-of-sample check.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
            <tr>
              <th className="text-left p-2">Day</th>
              <th className="text-right p-2">Resolved</th>
              <th className="text-right p-2">Wins</th>
              <th className="text-right p-2">Win %</th>
              <th className="text-right p-2">Avg R</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => <tr key={row.label} className="border-t border-slate-200 dark:border-slate-800">
              <td className="p-2 font-semibold">{row.label}</td>
              <td className="p-2 text-right">{row.total}</td>
              <td className="p-2 text-right">{row.wins}</td>
              <td className="p-2 text-right">{row.winRate.toFixed(1)}%</td>
              <td className="p-2 text-right font-semibold">{row.averageR.toFixed(2)}R</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </CardBody>
  </Card>;
}
