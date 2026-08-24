import { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Settings as SettingsIcon } from 'lucide-react';
import { useStore } from '@/store/StoreContext';
import { Card, CardHeader, CardBody, StatCard, Badge, Button, Input, Table, TableRow, TableCell, Modal } from '@/components/ui';
import { riskReport, checkTradeViolation } from '@/lib/risk';
import { formatCurrency, formatPct } from '@/lib/format';

export function RiskCenter() {
  const { positions, riskLimits, updateRiskLimits, tradingCapital, journal } = useStore();
  const [showLimits, setShowLimits] = useState(false);
  const [testLoss, setTestLoss] = useState('');

  const realizedHistory = journal.map((j) => j.pnl);
  const report = riskReport(positions, riskLimits, tradingCapital, realizedHistory);
  const openRisk = report.openRisk;
  const violation = testLoss ? checkTradeViolation(parseFloat(testLoss) || 0, tradingCapital, riskLimits, openRisk) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Risk Center</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Monitor and manage your trading risk</p>
        </div>
        <Button variant="default" onClick={() => setShowLimits(true)}><SettingsIcon size={16} className="inline mr-1.5" />Edit Limits</Button>
      </div>

      {report.violations.length > 0 && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-red-500" />
            <p className="font-semibold text-red-700 dark:text-red-400">Risk Violations Detected</p>
          </div>
          <ul className="space-y-1">
            {report.violations.map((v, i) => (
              <li key={i} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-1.5"><span className="mt-0.5">•</span>{v}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Max Risk per Trade" value={formatCurrency(report.maxRiskPerTrade, true)} subvalue={`${report.riskPerTradePct}% of capital`} accent="amber" />
        <StatCard label="Open Risk" value={formatCurrency(report.openRisk, true)} subvalue={`${report.openRiskPct.toFixed(1)}% of capital`} accent={report.openRiskPct > riskLimits.maxOpenRiskPct ? 'red' : 'green'} />
        <StatCard label="Leverage" value={`${report.leverage.toFixed(2)}x`} subvalue={`Max: ${report.maxLeverage}x`} accent={report.leverage > report.maxLeverage ? 'red' : 'green'} />
        <StatCard label="Consecutive Losses" value={String(report.consecutiveLosses)} accent={report.consecutiveLosses >= 3 ? 'red' : 'default'} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Largest Winning Trade" value={formatCurrency(report.largestWin, true)} accent="green" />
        <StatCard label="Largest Losing Trade" value={formatCurrency(report.largestLoss, true)} accent="red" />
        <StatCard label="Max Daily Loss Limit" value={`${riskLimits.maxDailyLossPct}%`} subvalue={formatCurrency(tradingCapital * riskLimits.maxDailyLossPct / 100, true)} accent="amber" />
        <StatCard label="Max Weekly Loss Limit" value={`${riskLimits.maxWeeklyLossPct}%`} subvalue={formatCurrency(tradingCapital * riskLimits.maxWeeklyLossPct / 100, true)} accent="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Portfolio Concentration" subtitle="Position sizing vs your limits" />
          <CardBody className="p-0">
            <Table headers={['Symbol', 'Allocation', 'Limit', 'Status']}>
              {report.concentration.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-slate-900 dark:text-white">{c.symbol}</TableCell>
                  <TableCell>{c.pct.toFixed(1)}%</TableCell>
                  <TableCell>{report.maxConcentrationPct}%</TableCell>
                  <TableCell>{c.exceeds ? <Badge variant="red">Exceeds</Badge> : <Badge variant="green">OK</Badge>}</TableCell>
                </TableRow>
              ))}
            </Table>
            {report.concentration.length === 0 && <p className="text-slate-400 text-sm p-6 text-center">No positions</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Trade Risk Checker" subtitle="Test if a trade violates your limits" />
          <CardBody className="space-y-3">
            <Input label="Potential Loss (₹)" type="number" value={testLoss} onChange={setTestLoss} placeholder="e.g. 5000" />
            {violation && (
              violation.violates ? (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-400">{violation.message}</p>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">This trade is within your risk limits.</p>
                </div>
              )
            )}
            {!violation && <p className="text-xs text-slate-400">Enter a potential loss amount to check against your limits.</p>}
          </CardBody>
        </Card>
      </div>

      <Modal open={showLimits} onClose={() => setShowLimits(false)} title="Edit Risk Limits">
        <div className="space-y-3">
          <Input label="Max Risk per Trade (%)" type="number" value={String(riskLimits.maxRiskPerTradePct)} onChange={(v) => updateRiskLimits({ maxRiskPerTradePct: parseFloat(v) || 0 })} />
          <Input label="Max Daily Loss (%)" type="number" value={String(riskLimits.maxDailyLossPct)} onChange={(v) => updateRiskLimits({ maxDailyLossPct: parseFloat(v) || 0 })} />
          <Input label="Max Weekly Loss (%)" type="number" value={String(riskLimits.maxWeeklyLossPct)} onChange={(v) => updateRiskLimits({ maxWeeklyLossPct: parseFloat(v) || 0 })} />
          <Input label="Max Open Risk (%)" type="number" value={String(riskLimits.maxOpenRiskPct)} onChange={(v) => updateRiskLimits({ maxOpenRiskPct: parseFloat(v) || 0 })} />
          <Input label="Max Concentration (%)" type="number" value={String(riskLimits.maxConcentrationPct)} onChange={(v) => updateRiskLimits({ maxConcentrationPct: parseFloat(v) || 0 })} />
          <Input label="Max Leverage (x)" type="number" value={String(riskLimits.maxLeverage)} onChange={(v) => updateRiskLimits({ maxLeverage: parseFloat(v) || 0 })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="primary" onClick={() => setShowLimits(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center pb-4">
        Risk calculations are deterministic. Always respect your risk limits. Not financial advice.
      </p>
    </div>
  );
}
