import { TrendingUp, TrendingDown, Wallet, DollarSign, Target, AlertTriangle, ScanLine } from 'lucide-react';
import { useStore } from '@/store/StoreContext';
import { Card, CardHeader, CardBody, StatCard, Badge, Table, TableRow, TableCell, Button } from '@/components/ui';
import { LineChart, DonutChart, Sparkline } from '@/components/charts';
import { portfolioSummary, allocationBySymbol, positionPnl } from '@/lib/portfolio';
import { getQuote, getOhlc } from '@/lib/marketData';
import { formatCurrency, formatPct, formatCompact } from '@/lib/format';
import type { PageKey } from '@/components/Sidebar';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

export function Dashboard({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const { positions, journal, tradingCapital } = useStore();
  const realizedHistory = journal.map((j) => j.pnl);
  const summary = portfolioSummary(positions, tradingCapital, realizedHistory);
  const alloc = allocationBySymbol(positions);
  const niftyOhlc = getOhlc('NIFTY');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Portfolio overview and market snapshot</p>
        </div>
        <Button variant="primary" onClick={() => onNavigate('trade-setup')}>
          <ScanLine size={16} className="inline mr-1.5" />
          Scan for Trades
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Portfolio Value" value={formatCurrency(summary.totalValue, true)} icon={<Wallet size={20} />} accent="blue" />
        <StatCard label="Invested Capital" value={formatCurrency(summary.investedCapital, true)} icon={<DollarSign size={20} />} />
        <StatCard label="Available Cash" value={formatCurrency(summary.availableCash, true)} icon={<Wallet size={20} />} />
        <StatCard label="Today's P&L" value={formatCurrency(summary.todayPnl, true)} subvalue={formatPct(summary.todayPnlPct)} accent={summary.todayPnl >= 0 ? 'green' : 'red'} icon={summary.todayPnl >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Realized P&L" value={formatCurrency(summary.realizedPnl, true)} accent={summary.realizedPnl >= 0 ? 'green' : 'red'} />
        <StatCard label="Unrealized P&L" value={formatCurrency(summary.unrealizedPnl, true)} accent={summary.unrealizedPnl >= 0 ? 'green' : 'red'} />
        <StatCard label="Return %" value={formatPct(summary.returnPct)} accent={summary.returnPct >= 0 ? 'green' : 'red'} icon={<TrendingUp size={20} />} />
        <StatCard label="Open Risk" value={formatCurrency(summary.openRisk, true)} subvalue={`${summary.openRiskPct.toFixed(1)}% of capital`} accent="amber" icon={<AlertTriangle size={20} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Portfolio Equity Curve" subtitle="Based on realized P&L history" />
          <CardBody>
            <LineChart data={journal.length > 0 ? journal.reduce((acc: number[], j) => {
              const prev = acc[acc.length - 1] ?? tradingCapital;
              return [...acc, prev + j.pnl];
            }, [tradingCapital]) : [tradingCapital]} height={220} color="#3b82f6" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Portfolio Allocation" subtitle="By position value" />
          <CardBody>
            {alloc.length > 0 ? (
              <DonutChart data={alloc.slice(0, 6).map((a, i) => ({ label: a.symbol, value: a.value, color: COLORS[i % COLORS.length] }))} />
            ) : (
              <p className="text-slate-400 text-sm">No positions yet</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Win Rate" value={`${summary.winRate.toFixed(0)}%`} icon={<Target size={20} />} accent="blue" />
        <StatCard label="Avg Profit" value={formatCurrency(summary.avgProfit, true)} accent="green" />
        <StatCard label="Avg Loss" value={formatCurrency(summary.avgLoss, true)} accent="red" />
        <StatCard label="Max Drawdown" value={`${summary.maxDrawdown.toFixed(2)}%`} accent="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Open Positions" subtitle={`${positions.length} positions`} action={<Button size="sm" variant="ghost" onClick={() => onNavigate('portfolio')}>View All</Button>} />
          <CardBody className="p-0">
            <Table headers={['Symbol', 'Qty', 'Avg', 'LTP', 'P&L', '']}>
              {positions.slice(0, 6).map((pos) => {
                const pnl = positionPnl(pos);
                const quote = getQuote(pos.symbol);
                return (
                  <TableRow key={pos.id}>
                    <TableCell className="font-medium text-slate-900 dark:text-white">{pos.symbol}</TableCell>
                    <TableCell>{pos.quantity}</TableCell>
                    <TableCell>₹{pos.avgPrice.toFixed(2)}</TableCell>
                    <TableCell>₹{quote?.ltp.toFixed(2) ?? pos.currentPrice.toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={pnl.unrealizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                        {formatCurrency(pnl.unrealizedPnl, true)}
                      </span>
                    </TableCell>
                    <TableCell><Sparkline data={getOhlc(pos.symbol).slice(-20)} width={60} height={24} color="auto" /></TableCell>
                  </TableRow>
                );
              })}
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Today's Trades" subtitle="From your journal" action={<Button size="sm" variant="ghost" onClick={() => onNavigate('journal')}>View All</Button>} />
          <CardBody className="p-0">
            <Table headers={['Instrument', 'Direction', 'Result', 'P&L', 'Strategy']}>
              {journal.slice(-6).reverse().map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium text-slate-900 dark:text-white">{j.instrument}</TableCell>
                  <TableCell>
                    <Badge variant={j.direction === 'BULLISH' ? 'green' : 'red'}>{j.direction}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={j.result === 'WIN' ? 'green' : j.result === 'LOSS' ? 'red' : 'default'}>{j.result}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={j.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                      {formatCurrency(j.pnl, true)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">{j.strategy ?? '-'}</TableCell>
                </TableRow>
              ))}
            </Table>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Market Snapshot" subtitle="MOCK data — NIFTY 50" />
        <CardBody>
          <LineChart data={niftyOhlc} height={160} color="auto" />
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400">NIFTY 50</span>
            <span className="font-semibold text-slate-900 dark:text-white">₹{getQuote('NIFTY').ltp.toFixed(2)}</span>
            <Badge variant={getQuote('NIFTY').changePct >= 0 ? 'green' : 'red'}>{formatPct(getQuote('NIFTY').changePct)}</Badge>
          </div>
        </CardBody>
      </Card>

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center pb-4">
        Disclaimer: AlphaPilot provides analytical information based on MOCK data. It does not guarantee returns and is not financial advice.
      </p>
    </div>
  );
}
