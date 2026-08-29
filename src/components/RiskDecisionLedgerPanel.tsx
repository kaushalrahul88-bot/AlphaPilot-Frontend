import { useEffect, useMemo, useState } from 'react';
import { Download, History, ShieldAlert } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, StatCard, Table, TableCell, TableRow } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import {
  RISK_DECISION_LEDGER_EVENT,
  exportRiskDecisionLedger,
  readRiskDecisionLedger,
  summarizeRiskDecisionLedger,
  type RiskDecisionLedgerRecord,
} from '@/lib/riskDecisionLedger';

function codeLabel(code: string) {
  return code.replace(/^ARMING_/, '').replace(/_/g, ' ').toLowerCase().replace(/^./, value => value.toUpperCase());
}

function formatIst(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' IST';
}

function contract(record: RiskDecisionLedgerRecord) {
  return record.symbol + ' ' + record.option_type;
}

export function RiskDecisionLedgerPanel() {
  const [records, setRecords] = useState<RiskDecisionLedgerRecord[]>(readRiskDecisionLedger);
  const summary = useMemo(() => summarizeRiskDecisionLedger(records), [records]);
  const latest = summary.latest;

  useEffect(() => {
    const reload = () => setRecords(readRiskDecisionLedger());
    window.addEventListener(RISK_DECISION_LEDGER_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(RISK_DECISION_LEDGER_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  return <Card>
    <CardHeader
      title="Paper Risk Ledger v1"
      subtitle="Automatic browser-local audit trail for deterministic risk evaluations."
      action={<div className="flex items-center gap-2"><Badge variant="blue">AUDIT ONLY</Badge><Button size="sm" onClick={() => exportRiskDecisionLedger(records)} disabled={records.length === 0}><Download size={14} className="inline mr-1" />Export JSON</Button></div>}
    />
    <CardBody className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-300">
        <ShieldAlert size={16} className="shrink-0" />
        <p>This ledger records evaluation snapshots only. It is not tamper-proof, cannot authorize an order, and never changes the API's PAPER TRADE ONLY or NO TRADE decision.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Evaluations" value={String(summary.total)} subvalue={String(summary.today_total) + ' today · ' + String(summary.sessions) + ' sessions'} accent="blue" />
        <StatCard label="Paper-ready" value={String(summary.paper_ready)} subvalue={String(summary.blocked) + ' blocked'} accent={summary.paper_ready > 0 ? 'green' : 'default'} />
        <StatCard label="Latest daily P&L" value={formatCurrency(latest?.risk_state.daily_pnl_rupees ?? 0, true)} subvalue={'Loss counted: ' + formatCurrency(latest?.risk_state.daily_loss_rupees ?? 0, true)} accent={(latest?.risk_state.daily_pnl_rupees ?? 0) < 0 ? 'red' : 'green'} />
        <StatCard label="Latest weekly P&L" value={formatCurrency(latest?.risk_state.weekly_pnl_rupees ?? 0, true)} subvalue={'Loss counted: ' + formatCurrency(latest?.risk_state.weekly_loss_rupees ?? 0, true)} accent={(latest?.risk_state.weekly_pnl_rupees ?? 0) < 0 ? 'red' : 'green'} />
        <StatCard label="Loss streak" value={String(latest?.risk_state.consecutive_losses ?? 0)} subvalue={latest?.risk_state.cooldown_until ? 'Cooldown to ' + formatIst(latest.risk_state.cooldown_until) : 'No active cooldown'} accent={(latest?.risk_state.consecutive_losses ?? 0) >= 3 ? 'red' : 'default'} />
        <StatCard label="Latest open risk" value={formatCurrency(latest?.risk_state.open_risk_rupees ?? 0, true)} subvalue={(latest?.risk_state.open_risk_pct ?? 0).toFixed(2) + '% of capital'} accent={(latest?.risk_state.open_risk_pct ?? 0) > 0 ? 'amber' : 'default'} />
        <StatCard label="Controlled previews" value={String(summary.controlled_live_previews)} subvalue="Live execution: always disabled" accent="amber" />
        <StatCard label="Top blocker" value={summary.top_blocker ? String(summary.top_blocker.count) : 'None'} subvalue={summary.top_blocker ? codeLabel(summary.top_blocker.code) : 'No blocker recorded'} accent={summary.top_blocker ? 'red' : 'green'} />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <History size={16} className="text-slate-400" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Recent risk evaluations</p>
        </div>
        {records.length > 0 ? <Table headers={['Time', 'Mode', 'Contract', 'Action', 'Max size', 'Open risk', 'Blockers']}>
          {records.slice(0, 12).map(record => <TableRow key={record.id}>
            <TableCell className="text-xs">{formatIst(record.captured_at)}</TableCell>
            <TableCell><Badge variant={record.mode === 'PAPER' ? 'blue' : 'amber'}>{record.mode === 'PAPER' ? 'PAPER' : 'LIVE PREVIEW'}</Badge></TableCell>
            <TableCell className="font-medium text-slate-900 dark:text-white">{contract(record)}</TableCell>
            <TableCell><Badge variant={record.final_action === 'PAPER_TRADE_ONLY' ? 'green' : 'red'}>{record.final_action.replace(/_/g, ' ')}</Badge></TableCell>
            <TableCell>{record.position_sizing.max_quantity} qty · {record.position_sizing.max_lots} lots</TableCell>
            <TableCell>{formatCurrency(record.risk_state.open_risk_rupees, true)} · {record.risk_state.open_risk_pct.toFixed(2)}%</TableCell>
            <TableCell className="max-w-xs whitespace-normal text-xs">{record.blockers.length ? codeLabel(record.blockers[0]) + (record.blockers.length > 1 ? ' +' + String(record.blockers.length - 1) : '') : 'None'}</TableCell>
          </TableRow>)}
        </Table> : <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
          <History size={22} className="mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No evaluations recorded yet</p>
          <p className="text-xs text-slate-500 mt-1">Run the hard-gate evaluator above. Successful API responses are recorded automatically.</p>
        </div>}
      </div>

      <p className="text-[11px] text-slate-500">Up to 500 snapshots are retained in this browser. Exported data may contain contract and account-risk information; handle it as private trading data.</p>
    </CardBody>
  </Card>;
}
