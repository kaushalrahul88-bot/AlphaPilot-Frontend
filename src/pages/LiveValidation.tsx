import { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Download, RotateCcw, Target, Trash2, XCircle } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { PerformanceIntelligence } from '@/components/PerformanceIntelligence';
import { FnoManagementSimulation } from '@/components/FnoManagementSimulation';
import { TimeOfDayPerformance } from '@/components/TimeOfDayPerformance';
import { DayOfWeekPerformance } from '@/components/DayOfWeekPerformance';
import { ExpiryProximityPerformance } from '@/components/ExpiryProximityPerformance';
import { exportFullBackupJson, exportValidationCsv, exportValidationJson } from '@/lib/exportData';
import { LIVE_VALIDATION_EVENT, LIVE_VALIDATION_STORAGE_KEY, markValidationStatus, readValidationRecords, saveValidationRecords, type ValidationRecord, type ValidationStatus } from '@/lib/liveValidation';

export function LiveValidation() {
  const [records, setRecords] = useState<ValidationRecord[]>(() => readValidationRecords());

  useEffect(() => {
    const refresh = () => setRecords(readValidationRecords());
    window.addEventListener(LIVE_VALIDATION_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(LIVE_VALIDATION_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const stats = useMemo(() => {
    const wins = records.filter(r => r.status === 'TARGET1_HIT' || r.status === 'TARGET2_HIT').length;
    const losses = records.filter(r => r.status === 'STOP_HIT').length;
    const closed = wins + losses;
    return {
      total: records.length,
      open: records.filter(r => r.status === 'OPEN').length,
      t1: records.filter(r => r.status === 'TARGET1_HIT').length,
      t2: records.filter(r => r.status === 'TARGET2_HIT').length,
      losses,
      winRate: closed ? wins / closed * 100 : 0,
    };
  }, [records]);

  const setStatus = (id: string, status: ValidationStatus) => {
    const next = readValidationRecords().map(row => row.id === id ? markValidationStatus(row, status) : row);
    saveValidationRecords(next);
  };

  const undoManualStatus = (id: string) => {
    const next = readValidationRecords().map(row => row.id === id ? {
      ...row,
      status: 'OPEN' as ValidationStatus,
      resolved_at: undefined,
      resolution_source: undefined,
    } : row);
    saveValidationRecords(next);
  };

  const clear = () => {
    if (!window.confirm('Clear all live validation records from this browser?')) return;
    window.localStorage.removeItem(LIVE_VALIDATION_STORAGE_KEY);
    setRecords([]);
  };

  return <div className="space-y-5">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div><h1 className="text-xl font-bold">Live Validation</h1><p className="text-sm text-slate-500">Execution-ready BUY CE / BUY PE setups are captured globally and monitored against the live option chain.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="default" onClick={exportValidationCsv}><Download size={14} className="inline mr-1"/>CSV</Button>
        <Button variant="default" onClick={exportValidationJson}><Download size={14} className="inline mr-1"/>JSON</Button>
        <Button variant="default" onClick={exportFullBackupJson}><Download size={14} className="inline mr-1"/>Full Backup</Button>
        <Button variant="ghost" onClick={clear}><Trash2 size={15} className="inline mr-1.5"/>Clear</Button>
      </div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <Summary label="Captured" value={String(stats.total)} />
      <Summary label="Open" value={String(stats.open)} />
      <Summary label="Target 1" value={String(stats.t1)} />
      <Summary label="Target 2" value={String(stats.t2)} />
      <Summary label="Stop Hit" value={String(stats.losses)} />
      <Summary label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
    </div>

    <PerformanceIntelligence records={records} />
    <FnoManagementSimulation records={records} />
    <TimeOfDayPerformance records={records} />
    <DayOfWeekPerformance records={records} />
    <ExpiryProximityPerformance records={records} />

    <Card><CardBody><div className="flex gap-3 items-start"><Activity className="text-blue-500 shrink-0"/><div><p className="text-sm font-semibold">Automatic forward-test tracking</p><p className="text-xs text-slate-500 mt-1">AlphaPilot checks open records against the current option-chain premium about once per minute while the app is open. AUTO OBSERVED means the polled premium was seen beyond a saved target or stop. New option plans use a premium-percentage intraday risk model; each saved stop and target now shows its percentage distance from entry. It is not tick-by-tick historical proof, so transient intraminute touches can still be missed.</p></div></div></CardBody></Card>

    {records.length === 0 ? <Card><CardBody className="text-center py-12"><Target size={38} className="mx-auto text-slate-300 mb-3"/><p className="text-sm text-slate-500">No execution-ready live setups captured yet.</p></CardBody></Card> : <div className="space-y-3">{records.map(row => <RecordCard key={row.id} row={row} setStatus={setStatus} undoManualStatus={undoManualStatus} />)}</div>}
  </div>;
}

function RecordCard({ row, setStatus, undoManualStatus }: { row: ValidationRecord; setStatus: (id: string, status: ValidationStatus) => void; undoManualStatus: (id: string) => void }) {
  const isWin = row.status === 'TARGET1_HIT' || row.status === 'TARGET2_HIT';
  const variant = isWin ? 'green' : row.status === 'STOP_HIT' ? 'red' : row.status === 'OPEN' ? 'blue' : 'default';
  const label = row.status === 'TARGET1_HIT' ? 'TARGET 1 HIT' : row.status === 'TARGET2_HIT' ? 'TARGET 2 HIT' : row.status.replace('_', ' ');
  const fallbackSubtitle = `${row.expiry ?? ''} ${row.strike ?? ''} ${row.option_type ?? ''}`.trim();
  const subtitle = row.option_contract ?? (fallbackSubtitle || 'Confirmed option setup');
  const canUndoManual = row.status !== 'OPEN' && row.resolution_source === 'MANUAL';
  const stopPct = levelPercent(row.option_entry, row.option_stop, false, row.premium_risk_percent);
  const t1Pct = levelPercent(row.option_entry, row.option_target1, true, row.option_target1_percent);
  const t2Pct = levelPercent(row.option_entry, row.option_target2, true, row.option_target2_percent);
  return <Card><CardHeader title={`${row.symbol} · ${row.action}`} subtitle={subtitle} action={<Badge variant={variant}>{label}</Badge>}/><CardBody className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-8 gap-3 text-sm">
      <Metric label="Alpha" value={`${row.alpha.toFixed(1)}/100`} />
      <Metric label="Entry" value={money(row.option_entry)} />
      <Metric label="Stop" value={`${money(row.option_stop)}${stopPct != null ? ` (-${stopPct.toFixed(1)}%)` : ''}`} />
      <Metric label="Target 1" value={`${money(row.option_target1)}${t1Pct != null ? ` (+${t1Pct.toFixed(1)}%)` : ''}`} />
      <Metric label="Target 2" value={`${money(row.option_target2)}${t2Pct != null ? ` (+${t2Pct.toFixed(1)}%)` : ''}`} />
      <Metric label="Last Option LTP" value={money(row.last_option_ltp)} />
      <Metric label="Option R:R" value={row.option_rr ? `${row.option_rr.toFixed(2)}:1` : '—'} />
      <Metric label="1-Lot Capital" value={money(row.capital)} />
    </div>
    {row.risk_model === 'PREMIUM_PERCENT_INTRADAY' && <p className="text-xs text-slate-500">Premium risk model: SL uses {stopPct?.toFixed(1) ?? '—'}% premium risk; T1/T2 are expressed as percentage moves from the captured option entry.</p>}
    <div className="flex flex-wrap justify-between gap-3 items-center">
      <div className="text-xs text-slate-500 space-y-1">
        <p><Clock3 size={13} className="inline mr-1"/>Captured {new Date(row.captured_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}{row.provider ? ` · ${row.provider}` : ''}</p>
        {row.last_checked_at && <p>Last checked {new Date(row.last_checked_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}{row.resolution_source ? ` · ${row.resolution_source.replace('_', ' ')}` : ''}</p>}
      </div>
      {row.status === 'OPEN' ? <div className="flex flex-wrap gap-2"><Button variant="default" onClick={() => setStatus(row.id, 'TARGET1_HIT')}><CheckCircle2 size={14} className="inline mr-1"/>T1 Hit</Button><Button variant="default" onClick={() => setStatus(row.id, 'TARGET2_HIT')}><CheckCircle2 size={14} className="inline mr-1"/>T2 Hit</Button><Button variant="ghost" onClick={() => setStatus(row.id, 'STOP_HIT')}><XCircle size={14} className="inline mr-1"/>Stop Hit</Button></div> : canUndoManual ? <Button variant="ghost" onClick={() => undoManualStatus(row.id)}><RotateCcw size={14} className="inline mr-1"/>Undo Manual Result</Button> : null}
    </div>
  </CardBody></Card>;
}

function levelPercent(entry?: number, level?: number, upside = true, explicit?: number) {
  if (Number.isFinite(explicit)) return Math.abs(Number(explicit));
  if (!Number.isFinite(entry) || !Number.isFinite(level) || Number(entry) <= 0) return null;
  const move = upside ? Number(level) - Number(entry) : Number(entry) - Number(level);
  return move >= 0 ? move / Number(entry) * 100 : null;
}
function Summary({ label, value }: { label: string; value: string }) { return <Card><CardBody><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></CardBody></Card>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="font-semibold mt-1">{value}</p></div>; }
function money(value?: number) { return Number.isFinite(value) ? `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'; }