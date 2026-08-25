import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, StatCard, Table, TableCell, TableRow } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { markPaperTrade, type PaperTrade } from '@/lib/paperTradeLifecycleApi';
import {
  PAPER_TRADE_LIFECYCLE_EVENT,
  paperTradeSummary,
  readPaperTrades,
  upsertPaperTrade,
} from '@/lib/paperTradeLifecycleStorage';

function formatIst(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' IST';
}

function inNseWindow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(row => row.type === type)?.value ?? '';
  const weekday = part('weekday');
  const minutes = Number(part('hour')) * 60 + Number(part('minute'));
  return !['Sat', 'Sun'].includes(weekday) && minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

function contractLabel(trade: PaperTrade) {
  return trade.symbol + ' ' + String(trade.strike) + ' ' + trade.option_type + ' · ' + trade.expiry;
}

export function PaperTradeLifecyclePanel() {
  const [trades, setTrades] = useState<PaperTrade[]>(readPaperTrades);
  const [marking, setMarking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const markingRef = useRef(false);
  const summary = useMemo(() => paperTradeSummary(trades), [trades]);
  const sessionOpen = inNseWindow();

  const reload = useCallback(() => setTrades(readPaperTrades()), []);

  const markOpenTrades = useCallback(async () => {
    if (markingRef.current || !inNseWindow() || document.visibilityState !== 'visible') return;
    const openTrades = readPaperTrades().filter(row => row.status === 'OPEN');
    if (!openTrades.length) return;
    markingRef.current = true;
    setMarking(true);
    setLastError(null);
    const failures: string[] = [];
    try {
      for (const trade of openTrades) {
        try {
          const result = await markPaperTrade(trade);
          upsertPaperTrade(result.paper_trade);
        } catch (failure) {
          failures.push(contractLabel(trade) + ': ' + (failure instanceof Error ? failure.message : 'mark failed'));
        }
      }
      reload();
      if (failures.length) setLastError(failures.join(' · '));
    } finally {
      markingRef.current = false;
      setMarking(false);
    }
  }, [reload]);

  async function manualExit(trade: PaperTrade) {
    if (markingRef.current || !inNseWindow()) return;
    markingRef.current = true;
    setMarking(true);
    setLastError(null);
    try {
      const result = await markPaperTrade(trade, true);
      upsertPaperTrade(result.paper_trade);
      reload();
    } catch (failure) {
      setLastError(failure instanceof Error ? failure.message : 'Manual paper exit failed.');
    } finally {
      markingRef.current = false;
      setMarking(false);
    }
  }

  useEffect(() => {
    const onLifecycle = () => reload();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void markOpenTrades();
    };
    window.addEventListener(PAPER_TRADE_LIFECYCLE_EVENT, onLifecycle);
    window.addEventListener('storage', onLifecycle);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => void markOpenTrades(), 60_000);
    void markOpenTrades();
    return () => {
      window.removeEventListener(PAPER_TRADE_LIFECYCLE_EVENT, onLifecycle);
      window.removeEventListener('storage', onLifecycle);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [markOpenTrades, reload]);

  return <Card>
    <CardHeader
      title="Paper Trade Lifecycle v1"
      subtitle="Exact-contract Groww LTP marking. Browser must remain open for automatic checks."
      action={<div className="flex items-center gap-2"><Badge variant="purple">PAPER ONLY</Badge><Button size="sm" onClick={() => void markOpenTrades()} disabled={marking || !sessionOpen || summary.open === 0}><RefreshCw size={14} className={'inline mr-1 ' + (marking ? 'animate-spin' : '')} />Refresh now</Button></div>}
    />
    <CardBody className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-700 dark:text-blue-300">
        <ShieldCheck size={16} className="shrink-0" />
        <p>Open positions are checked every 60 seconds only while this page is visible and within weekday 09:15–15:30 IST. The backend rechecks the NSE window and exact contract. LTP is paper evidence, not a guaranteed bid/ask fill.</p>
      </div>
      {!sessionOpen && <div className="rounded-lg border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-700 dark:text-amber-300">Automatic marking is paused outside the NSE session window. Exchange holidays still rely on the separate system-health/session gate.</div>}
      {lastError && <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 p-3 text-xs text-red-600"><AlertTriangle size={16} className="shrink-0" />{lastError}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Open paper positions" value={String(summary.open)} accent={summary.open ? 'amber' : 'default'} />
        <StatCard label="Verified closes" value={String(summary.closed)} subvalue={String(summary.wins) + ' wins · ' + String(summary.losses) + ' losses'} accent="blue" />
        <StatCard label="Realized paper P&L" value={formatCurrency(summary.realized_pnl_rupees, true)} accent={summary.realized_pnl_rupees >= 0 ? 'green' : 'red'} />
        <StatCard label="Paper win rate" value={summary.win_rate.toFixed(1) + '%'} subvalue="Not live-fill evidence" accent={summary.closed ? 'blue' : 'default'} />
      </div>

      {trades.length ? <Table headers={['Contract', 'Status', 'Entry / Last', 'Defined risk', 'P&L', 'Last mark', 'Action']}>
        {trades.slice(0, 20).map(trade => <TableRow key={trade.trade_id}>
          <TableCell className="font-medium text-slate-900 dark:text-white">{contractLabel(trade)}</TableCell>
          <TableCell><Badge variant={trade.status === 'OPEN' ? 'amber' : trade.realized_pnl_rupees !== null && trade.realized_pnl_rupees >= 0 ? 'green' : 'red'}>{trade.status === 'CLOSED' ? 'CLOSED ' + (trade.exit_reason ?? '') : 'OPEN'}</Badge></TableCell>
          <TableCell>{formatCurrency(trade.entry_price)} / {formatCurrency(trade.last_price)}</TableCell>
          <TableCell>{formatCurrency(trade.initial_risk_rupees, true)} · {trade.quantity} qty</TableCell>
          <TableCell className={(trade.status === 'CLOSED' ? trade.realized_pnl_rupees ?? 0 : trade.unrealized_pnl_rupees) >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(trade.status === 'CLOSED' ? trade.realized_pnl_rupees ?? 0 : trade.unrealized_pnl_rupees, true)}</TableCell>
          <TableCell className="text-xs">{formatIst(trade.last_observed_at)}</TableCell>
          <TableCell>{trade.status === 'OPEN' ? <Button size="sm" variant="danger" onClick={() => void manualExit(trade)} disabled={marking || !sessionOpen}>Close paper</Button> : <span className="text-xs text-slate-400">Recorded</span>}</TableCell>
        </TableRow>)}
      </Table> : <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No lifecycle paper trades yet</p>
        <p className="text-xs text-slate-500 mt-1">Evaluate a PAPER decision above, then open its exact strike and expiry within two minutes.</p>
      </div>}

      <p className="text-[11px] text-slate-500">Lifecycle records are browser-local and not tamper-evident. They can validate the paper workflow, but server-side signed persistence is still required before any future execution-capable phase.</p>
    </CardBody>
  </Card>;
}
