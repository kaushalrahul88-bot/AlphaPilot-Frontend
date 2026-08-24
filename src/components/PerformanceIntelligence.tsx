import { useMemo } from 'react';
import { BarChart3, Clock3, Sigma } from 'lucide-react';
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

function directionalStrength(row: ValidationRecord): number {
  const alpha = Number(row.alpha);
  if (!Number.isFinite(alpha)) return 50;
  return String(row.action).toUpperCase() === 'BUY PE' ? 100 - alpha : alpha;
}

function averageFinite(values: unknown[]): number {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : 0;
}

function resolutionMinutes(row: ValidationRecord): number | null {
  if (!row.resolved_at || !row.captured_at) return null;
  const start = new Date(row.captured_at).getTime();
  const end = new Date(row.resolved_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 60_000;
}

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  if (minutes < 60) return `${minutes.toFixed(0)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
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
    const winners = closed.filter(row => row.status === 'TARGET1_HIT' || row.status === 'TARGET2_HIT');
    const stopped = closed.filter(row => row.status === 'STOP_HIT');
    const t1Rows = closed.filter(row => row.status === 'TARGET1_HIT');
    const t2Rows = closed.filter(row => row.status === 'TARGET2_HIT');
    const wins = winners.length;
    const losses = stopped.length;
    const t1 = t1Rows.length;
    const t2 = t2Rows.length;
    const rValues = closed.map(realisedR).filter((value): value is number => value !== null);
    const positiveR = rValues.filter(value => value > 0).reduce((sum, value) => sum + value, 0);
    const negativeR = Math.abs(rValues.filter(value => value < 0).reduce((sum, value) => sum + value, 0));
    const totalR = rValues.reduce((sum, value) => sum + value, 0);
    const excursionRows = closed.filter(row => Number.isFinite(Number(row.mfe_r)) || Number.isFinite(Number(row.mae_r)));
    const avgMfe = averageFinite(excursionRows.map(row => row.mfe_r));
    const avgMae = averageFinite(excursionRows.map(row => row.mae_r));
    const avgWinnerMfe = averageFinite(winners.map(row => row.mfe_r));
    const avgLoserMfe = averageFinite(stopped.map(row => row.mfe_r));
    const efficiencyValues = closed.map(row => {
      const realised = realisedR(row);
      const mfe = Number(row.mfe_r);
      return realised != null && realised > 0 && Number.isFinite(mfe) && mfe > 0 ? Math.min(1, realised / mfe) : null;
    }).filter((value): value is number => value !== null);

    const stoppedWithMfe = stopped.filter(row => Number.isFinite(Number(row.mfe_r)));
    const directStops = stoppedWithMfe.filter(row => Number(row.mfe_r) < 0.25).length;
    const quarterToHalfStops = stoppedWithMfe.filter(row => Number(row.mfe_r) >= 0.25 && Number(row.mfe_r) < 0.5).length;
    const halfToOneStops = stoppedWithMfe.filter(row => Number(row.mfe_r) >= 0.5 && Number(row.mfe_r) < 1).length;
    const onePlusStops = stoppedWithMfe.filter(row => Number(row.mfe_r) >= 1).length;
    const reachedHalfBeforeStop = stoppedWithMfe.filter(row => Number(row.mfe_r) >= 0.5).length;
    const reachedOneBeforeStop = stoppedWithMfe.filter(row => Number(row.mfe_r) >= 1).length;

    const durationRows = closed.map(row => resolutionMinutes(row)).filter((value): value is number => value !== null);
    const winnerDurations = winners.map(row => resolutionMinutes(row)).filter((value): value is number => value !== null);
    const stopDurations = stopped.map(row => resolutionMinutes(row)).filter((value): value is number => value !== null);
    const t1Durations = t1Rows.map(row => resolutionMinutes(row)).filter((value): value is number => value !== null);
    const t2Durations = t2Rows.map(row => resolutionMinutes(row)).filter((value): value is number => value !== null);

    const strengthBands = [
      summarize('65–69.9', closed.filter(row => directionalStrength(row) >= 65 && directionalStrength(row) < 70)),
      summarize('70–74.9', closed.filter(row => directionalStrength(row) >= 70 && directionalStrength(row) < 75)),
      summarize('75–79.9', closed.filter(row => directionalStrength(row) >= 75 && directionalStrength(row) < 80)),
      summarize('80+', closed.filter(row => directionalStrength(row) >= 80)),
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
      avgMfe,
      avgMae,
      avgWinnerMfe,
      avgLoserMfe,
      captureEfficiency: efficiencyValues.length ? efficiencyValues.reduce((sum, value) => sum + value, 0) / efficiencyValues.length * 100 : 0,
      excursionSamples: excursionRows.length,
      stoppedMfeSamples: stoppedWithMfe.length,
      directStops,
      quarterToHalfStops,
      halfToOneStops,
      onePlusStops,
      reachedHalfBeforeStop,
      reachedOneBeforeStop,
      durationSamples: durationRows.length,
      avgResolutionMinutes: averageFinite(durationRows),
      avgWinnerMinutes: averageFinite(winnerDurations),
      avgStopMinutes: averageFinite(stopDurations),
      avgT1Minutes: averageFinite(t1Durations),
      avgT2Minutes: averageFinite(t2Durations),
      strengthBands,
      directions,
      symbols,
    };
  }, [records]);

  const evidence = analytics.closed >= 30 ? 'USABLE SAMPLE' : analytics.closed >= 10 ? 'EARLY SAMPLE' : 'INSUFFICIENT SAMPLE';
  const evidenceVariant = analytics.closed >= 30 ? 'green' : analytics.closed >= 10 ? 'amber' : 'default';
  const nextMilestone = analytics.closed >= 30 ? null : analytics.closed >= 10 ? 30 : 10;
  const milestoneStart = analytics.closed >= 10 ? 10 : 0;
  const milestoneProgress = nextMilestone == null
    ? 100
    : Math.max(0, Math.min(100, ((analytics.closed - milestoneStart) / (nextMilestone - milestoneStart)) * 100));
  const remaining = nextMilestone == null ? 0 : Math.max(0, nextMilestone - analytics.closed);

  return <Card>
    <CardHeader
      title="Performance Intelligence"
      subtitle="Forward-test evidence from resolved execution-ready setups only. Open trades are excluded from performance statistics."
      action={<Badge variant={evidenceVariant}>{evidence}</Badge>}
    />
    <CardBody className="space-y-5">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold">Forward-validation evidence gate</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {nextMilestone == null
                ? '30 resolved setups reached. The sample is large enough for a structured review before any strategy change.'
                : `${remaining} more resolved setup${remaining === 1 ? '' : 's'} needed to reach the ${nextMilestone}-trade evidence milestone.`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{analytics.closed}/30</p>
            <p className="text-[10px] text-slate-500">resolved setups</p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className="h-full bg-slate-700 dark:bg-slate-300 transition-all" style={{ width: `${milestoneProgress}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-1.5">
          <span>0 · collect only</span>
          <span>10 · early evidence</span>
          <span>30 · structured review</span>
        </div>
      </div>

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

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold">Observed excursion intelligence</p>
          <p className="text-xs text-slate-500 mt-0.5">MFE/MAE use the option LTP observations captured by the validation poller. They are not tick-perfect intraminute highs/lows.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metric label="Excursion Samples" value={String(analytics.excursionSamples)} />
          <Metric label="Avg MFE" value={`${analytics.avgMfe.toFixed(2)}R`} />
          <Metric label="Avg MAE" value={`${analytics.avgMae.toFixed(2)}R`} />
          <Metric label="Winner Avg MFE" value={`${analytics.avgWinnerMfe.toFixed(2)}R`} />
          <Metric label="Capture Efficiency" value={`${analytics.captureEfficiency.toFixed(0)}%`} />
        </div>
        <p className="text-xs text-slate-500">Stopped trades averaged <b>{analytics.avgLoserMfe.toFixed(2)}R</b> of observed favourable excursion before failing. This becomes useful for diagnosing whether profitable movement is being given back or whether stops/targets merit later testing—only after the evidence gate is met.</p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Management Efficiency Study</p>
            <p className="text-xs text-slate-500 mt-0.5">How much observed favourable movement stopped F&O trades achieved before eventually hitting the saved premium stop.</p>
          </div>
          <Badge variant={analytics.stoppedMfeSamples >= 20 ? 'green' : analytics.stoppedMfeSamples >= 5 ? 'amber' : 'default'}>{analytics.stoppedMfeSamples >= 20 ? 'USABLE SAMPLE' : analytics.stoppedMfeSamples >= 5 ? 'EARLY SIGNAL' : 'INSUFFICIENT SAMPLE'}</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Direct SL <0.25R" value={String(analytics.directStops)} />
          <Metric label="0.25–0.49R then SL" value={String(analytics.quarterToHalfStops)} />
          <Metric label="0.50–0.99R then SL" value={String(analytics.halfToOneStops)} />
          <Metric label="≥1.00R then SL" value={String(analytics.onePlusStops)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Metric label="Losers first reaching +0.50R" value={analytics.stoppedMfeSamples ? `${analytics.reachedHalfBeforeStop}/${analytics.stoppedMfeSamples} · ${(analytics.reachedHalfBeforeStop / analytics.stoppedMfeSamples * 100).toFixed(1)}%` : '0/0 · 0.0%'} />
          <Metric label="Losers first reaching +1.00R" value={analytics.stoppedMfeSamples ? `${analytics.reachedOneBeforeStop}/${analytics.stoppedMfeSamples} · ${(analytics.reachedOneBeforeStop / analytics.stoppedMfeSamples * 100).toFixed(1)}%` : '0/0 · 0.0%'} />
        </div>
        <p className="text-xs text-slate-500">This is diagnostics only. A high +0.50R-then-SL rate can justify later testing of break-even or partial-profit management, but AlphaPilot does not change the live stop, trail it, or take partial exits from this evidence.</p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Clock3 size={17} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Time-to-outcome intelligence</p>
            <p className="text-xs text-slate-500 mt-0.5">Measured from validation capture time to the recorded T1/T2/SL resolution time. Use this only as forward evidence for later stale-trade/session-timing studies.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metric label="Timing Samples" value={String(analytics.durationSamples)} />
          <Metric label="Avg Resolution" value={formatDuration(analytics.avgResolutionMinutes)} />
          <Metric label="Winners Avg" value={formatDuration(analytics.avgWinnerMinutes)} />
          <Metric label="Stops Avg" value={formatDuration(analytics.avgStopMinutes)} />
          <Metric label="T1 Avg" value={formatDuration(analytics.avgT1Minutes)} />
        </div>
        <p className="text-xs text-slate-500">T2 outcomes averaged <b>{formatDuration(analytics.avgT2Minutes)}</b>. Do not turn these durations into an automatic time-stop until the forward sample is large enough and an out-of-sample experiment supports it.</p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
        <Sigma size={17} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Total realised result: <span className="font-semibold text-slate-700 dark:text-slate-200">{analytics.totalR.toFixed(2)}R</span>. T1/T2 outcomes use the saved option entry, stop and target plan; a stop counts as −1R. Directional-strength analysis treats BUY CE strength as Alpha and BUY PE strength as 100 − Alpha, so bullish and bearish setups are compared on the same 0–100 scale. These statistics are validation evidence, not a promise of future returns.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Breakdown title="Directional-strength performance" rows={analytics.strengthBands} />
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
