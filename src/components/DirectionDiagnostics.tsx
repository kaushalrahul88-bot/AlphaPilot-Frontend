import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import type { BacktestResponse } from '@/lib/alphaPilotApi';

type Trade = BacktestResponse['trades'][number];
type Direction = 'BUY CE' | 'BUY PE';
type SortMode = 'BEST_R' | 'WORST_R' | 'MOST_TRADES' | 'HIGHEST_WIN';

type PeriodResult = {
  label: string;
  startDate: string;
  endDate: string;
  allDay: BacktestResponse;
  before1030: BacktestResponse;
  before1200: BacktestResponse;
};

type Row = {
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  avgR: number;
};

type SymbolRow = Row & {
  drawdown: number;
  profitablePeriods: number;
  periodCount: number;
  consistency: 'CONSISTENT' | 'MIXED' | 'WEAK';
};

const TIME_BUCKETS = ['09:15–10:30', '10:30–12:00', '12:00–13:30', '13:30+'] as const;
const EXIT_TYPES = ['T2', 'T1', 'SL', 'EOD'] as const;

function summarize(label: string, trades: Trade[]): Row {
  const wins = trades.filter(t => t.r_multiple > 0).length;
  const losses = trades.filter(t => t.r_multiple < 0).length;
  const totalR = trades.reduce((sum, t) => sum + t.r_multiple, 0);
  return {
    label,
    trades: trades.length,
    wins,
    losses,
    winRate: trades.length ? wins / trades.length * 100 : 0,
    totalR,
    avgR: trades.length ? totalR / trades.length : 0,
  };
}

function maxDrawdown(trades: Trade[]) {
  let equity = 0;
  let peak = 0;
  let dd = 0;
  for (const trade of [...trades].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    equity += trade.r_multiple;
    peak = Math.max(peak, equity);
    dd = Math.max(dd, peak - equity);
  }
  return dd;
}

function bucket(timestamp: string) {
  const d = new Date(timestamp);
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (minutes < 630) return '09:15–10:30';
  if (minutes < 720) return '10:30–12:00';
  if (minutes < 810) return '12:00–13:30';
  return '13:30+';
}

function fmtR(v: number) {
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}R`;
}

function tone(v: number) {
  return v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-600' : '';
}

export function DirectionDiagnostics({ results }: { results: PeriodResult[] }) {
  const [direction, setDirection] = useState<Direction>('BUY CE');
  const [sortMode, setSortMode] = useState<SortMode>('BEST_R');

  const data = useMemo(() => {
    const trades = results
      .flatMap(period => period.allDay.trades.filter(t => t.action === direction))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const base = summarize(direction, trades);
    const summary = { ...base, drawdown: maxDrawdown(trades) };
    const symbols = [...new Set(trades.map(t => t.symbol))];

    const symbolRows: SymbolRow[] = symbols.map(symbol => {
      const symbolTrades = trades.filter(t => t.symbol === symbol);
      const row = summarize(symbol, symbolTrades);
      const profitablePeriods = results.filter(period => {
        const p = period.allDay.trades.filter(t => t.action === direction && t.symbol === symbol);
        return p.length > 0 && p.reduce((sum, t) => sum + t.r_multiple, 0) > 0;
      }).length;
      const periodCount = results.length;
      const consistency: SymbolRow['consistency'] =
        row.trades >= 10 && profitablePeriods === periodCount
          ? 'CONSISTENT'
          : profitablePeriods >= Math.ceil(periodCount * 2 / 3)
            ? 'MIXED'
            : 'WEAK';
      return { ...row, drawdown: maxDrawdown(symbolTrades), profitablePeriods, periodCount, consistency };
    });

    symbolRows.sort((a, b) => {
      if (sortMode === 'WORST_R') return a.totalR - b.totalR;
      if (sortMode === 'MOST_TRADES') return b.trades - a.trades || b.totalR - a.totalR;
      if (sortMode === 'HIGHEST_WIN') return b.winRate - a.winRate || b.trades - a.trades;
      return b.totalR - a.totalR;
    });

    const timeRows = TIME_BUCKETS.map(label => {
      const selected = trades.filter(t => bucket(t.timestamp) === label);
      return { ...summarize(label, selected), drawdown: maxDrawdown(selected) };
    });

    const exitRows = EXIT_TYPES.map(label => summarize(label, trades.filter(t => t.outcome === label)));

    const matrix = [...symbols].sort().map(symbol => ({
      symbol,
      cells: TIME_BUCKETS.map(label => summarize(label, trades.filter(t => t.symbol === symbol && bucket(t.timestamp) === label))),
    }));

    const weakest = [...symbolRows].sort((a, b) => a.totalR - b.totalR)[0];
    const strongestTime = [...timeRows].sort((a, b) => b.totalR - a.totalR)[0];
    const weakestTime = [...timeRows].sort((a, b) => a.totalR - b.totalR)[0];
    const threeWeakest = [...symbolRows].sort((a, b) => a.totalR - b.totalR).slice(0, 3);
    const withoutWeakest = summary.totalR - threeWeakest.reduce((sum, row) => sum + row.totalR, 0);

    const insights = [
      `${direction} ${summary.totalR >= 0 ? 'made' : 'lost'} ${Math.abs(summary.totalR).toFixed(2)}R across ${summary.trades} trades (${summary.winRate.toFixed(1)}% win rate).`,
      weakest ? `${weakest.label} was the weakest ${direction} symbol at ${fmtR(weakest.totalR)} across ${weakest.trades} trades${weakest.trades < 10 ? ' (LOW SAMPLE)' : ''}.` : '',
      strongestTime ? `${strongestTime.label} was the strongest entry-time bucket at ${fmtR(strongestTime.totalR)} across ${strongestTime.trades} trades.` : '',
      weakestTime && weakestTime.totalR < 0 ? `Losses were most concentrated in ${weakestTime.label}, which contributed ${fmtR(weakestTime.totalR)}.` : '',
      threeWeakest.length ? `Removing the three weakest symbols in-sample would change Total R from ${fmtR(summary.totalR)} to ${fmtR(withoutWeakest)}. This is diagnostic only, not a proposed live filter.` : '',
    ].filter(Boolean);

    return { summary, symbolRows, timeRows, exitRows, matrix, insights };
  }, [results, direction, sortMode]);

  return (
    <Card>
      <CardHeader title="Direction Diagnostics" subtitle="Identify which symbols, entry times and exit types are driving BUY CE and BUY PE performance." />
      <CardBody className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium mb-1.5">Direction</p>
            <div className="flex gap-2">
              <Button variant={direction === 'BUY CE' ? 'primary' : 'ghost'} onClick={() => setDirection('BUY CE')}>BUY CE</Button>
              <Button variant={direction === 'BUY PE' ? 'primary' : 'ghost'} onClick={() => setDirection('BUY PE')}>BUY PE</Button>
            </div>
          </div>
          <label className="text-xs font-medium">Symbol sort
            <select className="block mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2" value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)}>
              <option value="BEST_R">Best Total R</option>
              <option value="WORST_R">Worst Total R</option>
              <option value="MOST_TRADES">Most Trades</option>
              <option value="HIGHEST_WIN">Highest Win %</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metric label="Total Trades" value={String(data.summary.trades)} />
          <Metric label="Win Rate" value={`${data.summary.winRate.toFixed(1)}%`} />
          <Metric label="Total R" value={fmtR(data.summary.totalR)} />
          <Metric label="Avg R" value={fmtR(data.summary.avgR)} />
          <Metric label="Max Drawdown" value={`${data.summary.drawdown.toFixed(2)}R`} />
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200">
          <b>Diagnostics are descriptive, not execution rules.</b> Do not promote a symbol/time/direction filter to the live scanner until it remains profitable across independent periods and a sufficiently large trade sample.
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">By Symbol</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 max-h-[32rem]">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 sticky top-0"><tr><th className="text-left p-2">Symbol</th><th className="text-right p-2">Trades</th><th className="text-right p-2">W/L</th><th className="text-right p-2">Win %</th><th className="text-right p-2">Total R</th><th className="text-right p-2">Avg R</th><th className="text-right p-2">Max DD</th><th className="text-center p-2">Profitable Periods</th><th className="text-left p-2">Status</th></tr></thead>
              <tbody>{data.symbolRows.map(row => <tr key={row.label} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2 font-semibold whitespace-nowrap">{row.label}</td><td className="p-2 text-right">{row.trades}{row.trades < 10 && <span className="block text-[9px] font-semibold text-amber-600">LOW SAMPLE</span>}</td><td className="p-2 text-right">{row.wins}/{row.losses}</td><td className="p-2 text-right">{row.winRate.toFixed(1)}%</td><td className={`p-2 text-right font-semibold ${tone(row.totalR)}`}>{fmtR(row.totalR)}</td><td className="p-2 text-right">{fmtR(row.avgR)}</td><td className="p-2 text-right">{row.drawdown.toFixed(2)}R</td><td className="p-2 text-center">{row.profitablePeriods}/{row.periodCount}</td><td className="p-2"><Badge variant={row.consistency === 'CONSISTENT' ? 'green' : row.consistency === 'MIXED' ? 'blue' : 'red'}>{row.consistency}</Badge></td></tr>)}</tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div><h3 className="text-sm font-semibold mb-2">By Entry Time</h3><div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900 text-slate-500"><tr><th className="text-left p-2">Entry Time</th><th className="text-right p-2">Trades</th><th className="text-right p-2">W/L</th><th className="text-right p-2">Win %</th><th className="text-right p-2">Total R</th><th className="text-right p-2">Avg R</th><th className="text-right p-2">Max DD</th></tr></thead><tbody>{data.timeRows.map(row => <tr key={row.label} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2 font-semibold">{row.label}</td><td className="p-2 text-right">{row.trades}{row.trades > 0 && row.trades < 10 && <span className="block text-[9px] font-semibold text-amber-600">LOW SAMPLE</span>}</td><td className="p-2 text-right">{row.wins}/{row.losses}</td><td className="p-2 text-right">{row.winRate.toFixed(1)}%</td><td className={`p-2 text-right font-semibold ${tone(row.totalR)}`}>{fmtR(row.totalR)}</td><td className="p-2 text-right">{fmtR(row.avgR)}</td><td className="p-2 text-right">{row.drawdown.toFixed(2)}R</td></tr>)}</tbody></table></div></div>
          <div><h3 className="text-sm font-semibold mb-2">By Exit Type</h3><div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900 text-slate-500"><tr><th className="text-left p-2">Exit Type</th><th className="text-right p-2">Trades</th><th className="text-right p-2">Win %</th><th className="text-right p-2">Total R</th><th className="text-right p-2">Avg R</th></tr></thead><tbody>{data.exitRows.map(row => <tr key={row.label} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2 font-semibold">{row.label}</td><td className="p-2 text-right">{row.trades}{row.trades > 0 && row.trades < 10 && <span className="block text-[9px] font-semibold text-amber-600">LOW SAMPLE</span>}</td><td className="p-2 text-right">{row.winRate.toFixed(1)}%</td><td className={`p-2 text-right font-semibold ${tone(row.totalR)}`}>{fmtR(row.totalR)}</td><td className="p-2 text-right">{fmtR(row.avgR)}</td></tr>)}</tbody></table></div></div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Symbol × Entry Time</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 max-h-[34rem]"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 sticky top-0"><tr><th className="text-left p-2">Symbol</th>{TIME_BUCKETS.map(b => <th key={b} className="text-right p-2 whitespace-nowrap">{b}</th>)}</tr></thead><tbody>{data.matrix.map(row => <tr key={row.symbol} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2 font-semibold">{row.symbol}</td>{row.cells.map(cell => <td key={`${row.symbol}-${cell.label}`} className={`p-2 text-right ${tone(cell.totalR)}`}><div className="font-semibold">{fmtR(cell.totalR)}</div><div className="text-[10px] text-slate-500">({cell.trades} trades){cell.trades > 0 && cell.trades < 10 ? ' · LOW SAMPLE' : ''}</div></td>)}</tr>)}</tbody></table></div>
        </div>

        <div><h3 className="text-sm font-semibold mb-2">Diagnostic Insights</h3><div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">{data.insights.map((insight, i) => <p key={i} className="text-xs text-slate-600 dark:text-slate-400">• {insight}</p>)}</div></div>

        <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4"><AlertTriangle className="text-amber-500 shrink-0" size={18}/><p className="text-xs text-slate-600 dark:text-slate-400"><b>Small samples are labelled LOW SAMPLE.</b> A subgroup with fewer than 10 trades is not treated as a confirmed edge.</p></div>
      </CardBody>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold mt-1">{value}</p></div>;
}
