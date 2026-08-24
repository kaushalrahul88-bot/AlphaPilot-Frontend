import { useMemo } from 'react';
import { BarChart3, Sigma } from 'lucide-react';
import { Badge, Card, CardBody, CardHeader } from '@/components/ui';
import type { ValidationRecord } from '@/lib/liveValidation';

type Bucket = {
  label: string;
  total: number;
  wins: number;
  losses: number;
  averageR: number;
  winRate: number;
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

function summarize(label: string, rows: ValidationRecord[]): Bucket {
  const closed = rows.filter(row => ['TARGET1_HIT', 'TARGET2_HIT', 'STOP_HIT'].includes(row.status));
  const wins = closed.filter(row => row.status === 'TARGET1_HIT' || row.status === 'TARGET2_HIT').length;
  const losses = closed.filter(row => row.status === 'STOP_HIT').length;
  const rValues = closed.map(realisedR).filter((value): value is number => value !== null);
  return {
    label,
    total: closed.length,
    wins,
    losses,
    averageR: rValues.length ? rValues.reduce((sum, value) => sum + value, 0) / rValues.length : 0,
    winRate: closed.length ? wins / closed.length * 100 : 0,
  };
}

export function PerformanceIntelligence({ records }: { records: ValidationRecord[] }) {
  const analytics = useMemo(() => {
    const closed = records.filter(row => ['TARGET1_HIT', 'TARGET2_HIT', 'STOP_HIT'].includes(row.status));
    const wins = closed.filter(row => row.status === 'TARGET1_HIT' || row.status === 'TARGET2_HIT').length;
    const losses = closed.filter(row => row.status === 'STOP_HIT').length;
    const t1 = closed.filter(row => row.status === 'TARGET1_HIT').length;
    const t2 = closed.filter(row => row.status === 'TARGET2_HIT').length;
    const rValues = closed.map(realisedR).filter((value): value is number => value !== null);
    const positiveR = rValues.filter(value => value > 0).reduce((sum, value) => sum + value, 0);
    const negativeR = Math.abs(rValues.filter(value => value < 0).reduce((sum, value) => sum + value, 0));
    const totalR = rValues.reduce((sum, value) => sum + value, 0);

    const alphaBands = [
      summarize('65–69.9', closed.filter(row => row.alpha >= 65 && row.alpha < 70)),
      summarize('70–74.9', closed.filter(row => row.alpha >= 70 && row.alpha < 75)),
      summarize('75–79.9', closed.filter(row => row.alpha >= 75 && row.alpha < 80)),
      summarize('80+', closed.filter(row => row.alpha >= 80)),
    ];

    const directions = [
      summarize('BUY CE', closed.filter(row => row.action === 'BUY CE')),
      summarize('BUY PE', closed.filter(row => row.action === 'BUY PE')),
    ];

    const bySymbol = new Map<string, ValidationRecord[]>();
    closed.forEach(row => bySymbol.set(row.symbol, [...(bySymbol.get(row.symbol) ?? []), row]));
    const symbols = [...bySymbol.entries()]
      .map(([symbol, rows]) => summarize(symbol, rows))
      .sort((a, b) => b.averageR - a.averageR || b.total - a.total)
      .slice(0, 5);

    return {
      closed: closed.length,
      open: records.filter(row => row.status === 'OPEN').length,
      wins,
      losses,
      t1,
      t2,
      winRate: closed.length ? wins / closed.length * 100 : 0,
      totalR,
      averageR: rValues.length ? totalR / rValues.length : 0,
      profitFactor: negativeR > 0 ? positiveR / negativeR : positiveR > 0 ? Infinity : 0,
      alphaBands,
      directions,
      symbols,
    };
  }, [records]);

  const evidence = analytics.closed >= 30 ? 'USABLE SAMPLE' : analytics.closed >= 10 ? 'EARLY SAMPLE' : 'INSUFFICIENT SAMPLE';
  const evidenceVariant = analytics.closed >= 30 ? 'green' : analytics.closed >= 10 ? 'amber' : 'default';

  return <Card>
    <CardHeader
      title="Performance Intelligence"
      subtitle="Forward-test evidence from resolved execution-ready setups only. Open trades are excluded from performance statistics."
      action={<Badge variant={evidenceVariant}>{evidence}</Badge>}
    />
    <CardBody className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Metric label="Resolved" value={String(analytics.closed)} />
        <Metric label="Open" value={String(analytics.open)} />
        <Metric label="Win Rate" value={`${analytics.winRate.toFixed(1)}%`} />
        <Metric label="T1 Rate" value={analytics.closed ? `${(analytics.t1 / analytics.closed * 100).toFixed(1)}%` : '0.0%'} />
        <Metric label="T2 Rate" value={analytics.closed ? `${(analytics.t2 / analytics.closed * 100).toFixed(1)}%` : '0.0%'} />
        <Metric label="Stop Rate" value={analytics.closed ? `${(analytics.losses / analytics.closed * 100).toFixed(1)}%` : '0.0%'} />
        <Metric label="Avg Realised R" value={`${analytics.averageR.toFixed(2)}R`} />
        <Metric label="Profit Factor" value={Number.isFinite(analytics.profitFactor) ? analytics.profitFactor.toFixed(2) : '∞'} />
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
        <Sigma size={17} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Total realised result: <span className="font-semibold text-slate-700 dark:text-slate-200">{analytics.totalR.toFixed(2)}R</span>. T1/T2 outcomes use the saved option entry, stop and target plan; a stop counts as −1R. These statistics are validation evidence, not a promise of future returns.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Breakdown title="Alpha band performance" rows={analytics.alphaBands} />
        <Breakdown title="CE vs PE performance" rows={analytics.directions} />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2"><BarChart3 size={16} className="text-slate-500"/><p className="text-sm font-semibold">Best symbols by realised R</p></div>
        {analytics.symbols.length === 0 ? <p className="text-xs text-slate-500">No resolved trades yet.</p> : <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">{analytics.symbols.map(row => <div key={row.label} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3"><p className="text-xs font-semibold">{row.label}</p><p className="text-lg font-bold mt-1">{row.averageR.toFixed(2)}R</p><p className="text-xs text-slate-500">{row.total} trades · {row.winRate.toFixed(0)}% wins</p></div>)}</div>}
      </div>
    </CardBody>
  </Card>;
}

function Breakdown({ title, rows }: { title: string; rows: Bucket[] }) {
  return <div>
    <p className="text-sm font-semibold mb-2">{title}</p>
    <div className="space-y-2">{rows.map(row => <div key={row.label} className="grid grid-cols-4 gap-2 items-center rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"><span className="font-medium">{row.label}</span><span>{row.total} trades</span><span>{row.winRate.toFixed(1)}% win</span><span className="font-semibold text-right">{row.averageR.toFixed(2)}R</span></div>)}</div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold mt-1">{value}</p></div>;
}
